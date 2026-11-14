from datetime import datetime, timedelta, timezone

import pytest

from pipeline.ingest import Point, flush, write_points
from pipeline.mission import DAY
from pipeline.queries import Sample, latest, one_per_mission_day, series

START = datetime(2026, 11, 1, 18, 0, tzinfo=timezone.utc)  # mission day 1 begins here


def at(day: int, hour: float) -> datetime:
    return START + (day - 1) * DAY + timedelta(hours=hour)


def test_daily_rule_keeps_the_latest_sample_of_each_mission_day():
    samples = [
        Sample(at(1, 7.5), 4, "sim"),
        Sample(at(2, 7.5), 3, "sim"),
        Sample(at(2, 20), 2, "manual"),  # second check-in on day 2
        Sample(at(3, 7.5), 5, "sim"),
    ]
    assert one_per_mission_day(samples, START) == [samples[0], samples[2], samples[3]]


def test_daily_rule_uses_mission_days_not_calendar_dates():
    # 17:00 and 19:00 UTC are the same calendar date but different mission days (day starts 18:00).
    before, after = Sample(at(1, 23), 3, "sim"), Sample(at(2, 1), 4, "sim")
    assert before.ts.date() == after.ts.date()
    assert one_per_mission_day([before, after], START) == [before, after]


def test_daily_rule_prefers_a_typed_value_on_equal_timestamps():
    sim, manual = Sample(at(1, 7.5), 4, "sim"), Sample(at(1, 7.5), 2, "manual")
    assert one_per_mission_day([manual, sim], START) == [manual]
    assert one_per_mission_day([sim, manual], START) == [manual]


@pytest.mark.parametrize(
    "kwargs, message",
    [
        ({"metric": "hr_bpm"}, "needs exactly these labels: crew_id"),
        ({"metric": "symptom_strength", "crew_id": "a1"}, "crew_id, symptom"),
        ({"metric": "co2_ppm", "crew_id": "a1"}, "module"),
        ({"metric": "hr_bpm", "crew_id": "a1", "labels": {"source": "sim"}}, "do not filter by source"),
        ({"metric": "pulse", "crew_id": "a1"}, "unknown metric"),
        ({"metric": "hr_bpm", "crew_id": 'a1"} or {crew_id="a2'}, "must be letters"),
        ({"metric": "co2_ppm", "labels": {"module": ""}}, "must be letters"),
    ],
)
def test_series_needs_the_labels_of_one_series(kwargs, message):
    with pytest.raises(ValueError, match=message):
        series(start=START, end=START + DAY, base_url="http://127.0.0.1:1", **kwargs)


def test_naive_datetimes_are_rejected():
    with pytest.raises(ValueError, match="timezone-aware"):
        series("hr_bpm", crew_id="a1", start=datetime(2026, 11, 1), end=START, base_url="http://127.0.0.1:1")
    with pytest.raises(ValueError, match="timezone-aware"):
        latest("hr_bpm", crew_id="a1", at=datetime(2026, 11, 1), base_url="http://127.0.0.1:1")


# --- against a real VictoriaMetrics -------------------------------------------------


def recent_start() -> datetime:
    """A mission start 3 days back, so test points are inside retention and not in the future."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return now - 3 * DAY


@pytest.mark.vm
def test_series_window_is_start_inclusive_end_exclusive(test_id):
    start = recent_start()
    labels = {"crew_id": test_id, "source": "sim"}
    write_points([Point("hr_bpm", 60 + i, start + timedelta(minutes=5 * i), labels) for i in range(4)])
    flush()

    got = series("hr_bpm", crew_id=test_id, start=start + timedelta(minutes=5), end=start + timedelta(minutes=15))
    assert [s.value for s in got] == [61.0, 62.0]


@pytest.mark.vm
def test_daily_metric_merges_sources_into_one_value_per_day(test_id):
    start = recent_start()
    sim = {"crew_id": test_id, "source": "sim"}
    manual = {"crew_id": test_id, "source": "manual"}
    write_points(
        [
            Point("mood_score", 4, start + timedelta(hours=7.5), sim),
            Point("mood_score", 3, start + DAY + timedelta(hours=7.5), sim),
            Point("mood_score", 1, start + DAY + timedelta(hours=9), manual),  # typed later that day
            Point("mood_score", 5, start + 2 * DAY + timedelta(hours=7.5), sim),
        ]
    )
    flush()

    got = series("mood_score", crew_id=test_id, start=start, end=start + 3 * DAY, mission_start=start)
    assert [(s.value, s.source) for s in got] == [(4.0, "sim"), (1.0, "manual"), (5.0, "sim")]


@pytest.mark.vm
def test_five_minute_metric_is_returned_raw_across_sources(test_id):
    start = recent_start()
    write_points(
        [
            Point("co2_ppm", 2500, start, {"module": test_id, "source": "sim"}),
            Point("co2_ppm", 2600, start + timedelta(minutes=5), {"module": test_id, "source": "sim"}),
            Point("co2_ppm", 2700, start + timedelta(minutes=7), {"module": test_id, "source": "manual"}),
        ]
    )
    flush()

    got = series("co2_ppm", labels={"module": test_id}, start=start, end=start + DAY)
    assert [(s.value, s.source) for s in got] == [(2500.0, "sim"), (2600.0, "sim"), (2700.0, "manual")]


@pytest.mark.vm
def test_symptom_series_are_separate_per_symptom(test_id):
    start = recent_start()
    base = {"crew_id": test_id, "source": "sim"}
    write_points(
        [
            Point("symptom_strength", 2, start + timedelta(hours=7.5), {**base, "symptom": "headache"}),
            Point("symptom_strength", 1, start + timedelta(hours=7.5), {**base, "symptom": "nausea"}),
        ]
    )
    flush()

    got = series(
        "symptom_strength", crew_id=test_id, labels={"symptom": "headache"},
        start=start, end=start + DAY, mission_start=start,
    )
    assert [s.value for s in got] == [2.0]


@pytest.mark.vm
def test_latest_respects_at_and_finds_old_points(test_id):
    start = recent_start()
    labels = {"crew_id": test_id, "source": "sim"}
    old = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(days=20)  # outside the 2-day fast path
    write_points([Point("sleep_hours", 6.5, old, labels), Point("sleep_hours", 7.5, start, labels)])
    flush()

    assert latest("sleep_hours", crew_id=test_id).value == 7.5
    assert latest("sleep_hours", crew_id=test_id, at=start - timedelta(seconds=1)).value == 6.5
    assert latest("sleep_hours", crew_id=test_id, at=old - timedelta(seconds=1)) is None


@pytest.mark.vm
def test_empty_series_gives_empty_list_without_needing_a_mission(test_id):
    start = recent_start()
    assert series("mood_score", crew_id=test_id, start=start, end=start + DAY) == []
