from datetime import date, datetime

import pytest

from metrics.fake import FakeMetrics
from metrics.port import MetricsUnavailable

TODAY = date(2026, 11, 14)
START = datetime(2026, 11, 1)
END = datetime(2026, 11, 14, 9, 0)


def seeded(day=10):
    m = FakeMetrics()
    m.seed(TODAY, day)
    return m


def test_seed_day_10_has_nine_days_of_history():
    pts = seeded().series("a1", "heart_rate", START, END)
    assert len(pts) == 9
    assert pts[-1].at.date() == date(2026, 11, 13)
    assert all(p.source == "sim" for p in pts)


def test_seed_is_deterministic():
    a = seeded().series("a1", "sleep_hours", START, END)
    b = seeded().series("a1", "sleep_hours", START, END)
    assert [(p.at, p.value) for p in a] == [(p.at, p.value) for p in b]


def test_story_has_headache_and_high_co2_before_day_10():
    m = seeded()
    head = {p.at.date(): p.value for p in m.series("a1", "headache", START, END)}
    co2 = {p.at.date(): p.value for p in m.series("a1", "co2", START, END)}
    assert head[date(2026, 11, 13)] == 1
    assert head[date(2026, 11, 12)] == 0
    assert co2[date(2026, 11, 12)] > 1000 and co2[date(2026, 11, 13)] > 1000
    assert co2[date(2026, 11, 5)] < 900


def test_other_crew_have_no_headache_story():
    head = seeded().series("a2", "headache", START, END)
    assert all(p.value == 0 for p in head)


def test_write_appends_points_labeled_sim():
    m = seeded()
    m.write("a1", {"mood": 3.0, "headache": 2.0}, END)
    assert m.series("a1", "mood", START, END)[-1].value == 3.0
    assert m.series("a1", "headache", START, END)[-1].source == "sim"


def test_series_respects_start_and_end():
    pts = seeded().series("a1", "heart_rate", datetime(2026, 11, 12), datetime(2026, 11, 13, 23))
    assert [p.at.date() for p in pts] == [date(2026, 11, 12), date(2026, 11, 13)]


def test_unavailable_raises():
    m = seeded()
    m.fail = True
    with pytest.raises(MetricsUnavailable):
        m.series("a1", "mood", START, END)
    with pytest.raises(MetricsUnavailable):
        m.write("a1", {"mood": 3.0}, END)
