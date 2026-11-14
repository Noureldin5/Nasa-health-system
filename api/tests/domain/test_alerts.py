from datetime import date, datetime, timedelta

import pytest

from domain.alerts import (
    AlertDraft,
    HeadachePattern,
    build_alert,
    build_readout,
    detect_headache_pattern,
    select_daily,
    should_close,
)
from domain.baseline import Baseline, DailyPoint
from domain.drift import Drift
from schemas import Alert, Band, Indicator, ItemRef

AS_OF = date(2026, 11, 14)
NOW = datetime(2026, 11, 14, 8, 0)
BAND = Band(low=7.0, high=8.0, mean=7.5)
READY = Baseline(status="ready", calibration_day=10, band=BAND)
FORBIDDEN = ["you have", "diagnos", "disease"]

SLEEP_DRIFT = Drift(
    key="sleep_hours",
    direction="low",
    days_out=2,
    latest=6.1,
    z=-2.8,
    start=AS_OF - timedelta(days=2),
    end=AS_OF,
)
HEADACHE = HeadachePattern(
    days=[AS_OF - timedelta(days=1), AS_OF],
    co2_above_usual_days=[AS_OF - timedelta(days=2), AS_OF - timedelta(days=1)],
)


def texts(a):
    return [a.what_changed, a.next_step, a.contact_if]


def make_alert(draft: AlertDraft, id="al1", state="open") -> Alert:
    return Alert(
        id=id,
        crew_id=draft.crew_id,
        indicator=draft.indicator,
        what_changed=draft.what_changed,
        next_step=draft.next_step,
        contact_if=draft.contact_if,
        related_items=draft.related_items,
        severity=draft.severity,
        state=state,
        opened_at=draft.opened_at,
    )


def day_points(values, end=AS_OF):
    n = len(values)
    return [
        DailyPoint(day=end - timedelta(days=n - 1 - i), value=v, source="sim")
        for i, v in enumerate(values)
    ]


def indicator(key="heart_rate", status="in_range", day=None):
    return Indicator(
        key=key, value=60.0, unit="bpm", status=status, calibration_day=day, source="sim"
    )


def test_alert_has_three_parts():
    for signal in (SLEEP_DRIFT, HEADACHE):
        a = build_alert(signal, "a1", NOW)
        assert all(t.strip() for t in texts(a))
        assert a.contact_if.startswith("Contact the flight surgeon if")


def test_no_diagnosis_words():
    for signal in (SLEEP_DRIFT, HEADACHE):
        a = build_alert(signal, "a1", NOW)
        for t in texts(a):
            assert not any(w in t.lower() for w in FORBIDDEN)


def test_headache_pattern_pins_headache_and_co2():
    a = build_alert(HEADACHE, "a1", NOW)
    assert {i.indicator for i in a.related_items} == {"headache", "co2"}
    start = min(i.start for i in a.related_items)
    end = max(i.end for i in a.related_items)
    assert start <= min(HEADACHE.days) and end >= max(HEADACHE.days)
    assert "not a cause" in a.what_changed


def test_headache_pattern_needs_two_of_three_days():
    head = day_points([0, 1, 0])
    co2 = day_points([800, 1500, 1500])
    co2_base = Baseline(status="ready", calibration_day=10, band=Band(low=600, high=1000, mean=800))
    assert detect_headache_pattern(head, co2, co2_base, AS_OF) is None
    p = detect_headache_pattern(day_points([0, 1, 2]), co2, co2_base, AS_OF)
    assert p is not None
    assert p.days == [AS_OF - timedelta(days=1), AS_OF]
    assert p.co2_above_usual_days == [AS_OF - timedelta(days=1), AS_OF]


def test_one_alert_per_day():
    drafts = [
        build_alert(SLEEP_DRIFT, "a1", NOW),
        build_alert(HEADACHE, "a1", NOW),
        build_alert(Drift("heart_rate", "high", 2, 90.0, 3.0, AS_OF, AS_OF), "a1", NOW),
    ]
    shown, worth = select_daily(drafts, already_shown_today=False)
    assert shown.severity == max(d.severity for d in drafts)
    assert len(worth) == 2
    shown2, worth2 = select_daily(drafts, already_shown_today=True)
    assert shown2 is None
    assert len(worth2) == 3


def test_closes_after_2_days_back_in_band():
    alert = make_alert(build_alert(SLEEP_DRIFT, "a1", NOW))
    assert should_close(alert, day_points([6.1, 7.4, 7.6]), READY, AS_OF) is True


def test_stays_open_after_1_day():
    alert = make_alert(build_alert(SLEEP_DRIFT, "a1", NOW))
    assert should_close(alert, day_points([6.1, 6.0, 7.6]), READY, AS_OF) is False


def test_headache_alert_closes_after_2_days_without_headache():
    alert = make_alert(build_alert(HEADACHE, "a1", NOW))
    assert should_close(alert, day_points([2, 0, 0]), READY, AS_OF) is True
    assert should_close(alert, day_points([0, 2, 0]), READY, AS_OF) is False


def test_readout_all_in_range():
    r = build_readout([indicator(), indicator("mood")], None, [])
    assert r.overall == "in_range"
    assert r.headline == "All in your usual range"
    assert r.tip.strip()
    assert r.disclaimer == "Decision support, not a diagnosis."


def test_readout_with_alert():
    shown = make_alert(build_alert(SLEEP_DRIFT, "a1", NOW))
    r = build_readout([indicator(status="worth_checking")], shown, [])
    assert r.overall == "worth_checking"
    assert r.headline == "1 thing worth checking"
    assert r.alert == shown
    assert r.tip == shown.next_step


def test_readout_counts_worth_checking_too():
    shown = make_alert(build_alert(SLEEP_DRIFT, "a1", NOW))
    other = make_alert(build_alert(HEADACHE, "a1", NOW), id="al2")
    r = build_readout([indicator()], shown, [other])
    assert r.headline == "2 things worth checking"


def test_readout_while_learning():
    r = build_readout(
        [indicator(status="learning", day=3), indicator("mood", "learning", 5)], None, []
    )
    assert r.overall == "learning"
    assert r.headline == "Learning your baseline: day 3 of 7"


def test_readout_text_has_no_diagnosis_words():
    shown = make_alert(build_alert(HEADACHE, "a1", NOW))
    r = build_readout([indicator()], shown, [])
    for t in (r.headline, r.tip):
        assert not any(w in t.lower() for w in FORBIDDEN)


@pytest.mark.parametrize("n", [0, 1])
def test_build_alert_severity_between_0_and_1(n):
    d = Drift("sleep_hours", "low", 2, 6.1, -2.8 * (n + 1), AS_OF, AS_OF)
    assert 0 <= build_alert(d, "a1", NOW).severity <= 1


def test_item_ref_is_used_for_drift():
    a = build_alert(SLEEP_DRIFT, "a1", NOW)
    assert a.related_items == [ItemRef(indicator="sleep_hours", start=SLEEP_DRIFT.start, end=AS_OF)]
