import statistics
from datetime import date, timedelta

import pytest

from domain.baseline import DailyPoint, compute_baseline

AS_OF = date(2026, 11, 14)


def pts(values, end=AS_OF - timedelta(days=3)):
    """One point per day, the last value on `end`, going back one day per value.

    Default `end` is 3 days before AS_OF: old enough to be inside the baseline, which holds out
    the 2 days just before today (they are the days drift is judged on).
    """
    n = len(values)
    return [
        DailyPoint(day=end - timedelta(days=n - 1 - i), value=v, source="sim")
        for i, v in enumerate(values)
    ]


def test_learning_until_7_days():
    b = compute_baseline(pts([60, 61, 62]), AS_OF, "heart_rate")
    assert b.status == "learning"
    assert b.calibration_day == 3
    assert b.band is None


def test_band_mean_plus_minus_2sd():
    values = [55, 65, 60, 70, 50, 60, 60]
    b = compute_baseline(pts(values), AS_OF, "heart_rate")
    sd = statistics.stdev(values)
    assert b.status == "ready"
    assert b.band.mean == pytest.approx(60.0)
    assert b.band.low == pytest.approx(60.0 - 2 * sd)
    assert b.band.high == pytest.approx(60.0 + 2 * sd)
    assert b.band.demo_parameter is True


def test_min_spread_floor():
    b = compute_baseline(pts([7.0] * 7), AS_OF, "sleep_hours")
    assert b.band.high - b.band.low >= 1.0


def test_gaps_count_only_days_with_data():
    # 10 calendar days, only 6 have a reading
    end = AS_OF - timedelta(days=1)
    points = [
        DailyPoint(day=end - timedelta(days=d), value=7.0, source="sim") for d in (0, 1, 3, 5, 7, 9)
    ]
    b = compute_baseline(points, AS_OF, "sleep_hours")
    assert b.status == "learning"
    assert b.calibration_day == 6


def test_ignores_points_on_or_after_as_of():
    points = pts([60] * 7) + [DailyPoint(day=AS_OF, value=999, source="sim")]
    b = compute_baseline(points, AS_OF, "heart_rate")
    assert b.band.mean == pytest.approx(60.0)


def test_recent_days_do_not_dilute_the_band():
    # 7 steady days, then the 2 most recent days jump. The band must describe the steady days.
    steady = pts([60] * 7, end=AS_OF - timedelta(days=3))
    recent = pts([90, 90], end=AS_OF - timedelta(days=1))  # AS_OF-2 and AS_OF-1
    b = compute_baseline(steady + recent, AS_OF, "heart_rate")
    assert b.status == "ready"
    assert b.band.mean == pytest.approx(60.0)


def test_ready_on_day_8_even_though_the_last_2_days_are_held_out():
    # days 1..7 recorded, day 8 is today: usual range comes from days 1..5
    b = compute_baseline(
        pts([60, 61, 62, 61, 60, 62, 61], end=AS_OF - timedelta(days=1)), AS_OF, "heart_rate"
    )
    assert b.status == "ready"
    assert b.calibration_day == 7


def test_empty_list_is_learning_day_0():
    b = compute_baseline([], AS_OF, "heart_rate")
    assert b.status == "learning"
    assert b.calibration_day == 0
    assert b.band is None


def test_window_drops_points_older_than_14_days():
    old = [
        DailyPoint(day=AS_OF - timedelta(days=30 + i), value=200, source="sim") for i in range(5)
    ]
    b = compute_baseline(old + pts([60] * 7), AS_OF, "heart_rate")
    assert b.band.mean == pytest.approx(60.0)
