from datetime import date, timedelta

from domain.baseline import Baseline, DailyPoint
from domain.drift import detect_drift, status_for
from schemas import Band

AS_OF = date(2026, 11, 14)
SLEEP_BAND = Band(low=7.0, high=8.0, mean=7.5)
READY = Baseline(status="ready", calibration_day=10, band=SLEEP_BAND)
LEARNING = Baseline(status="learning", calibration_day=3, band=None)


def last3(values):
    """Values for the last three days, the final one on AS_OF."""
    return [
        DailyPoint(day=AS_OF - timedelta(days=2 - i), value=v, source="sim")
        for i, v in enumerate(values)
    ]


def test_no_drift_while_learning():
    assert detect_drift(last3([4.0, 4.0, 4.0]), LEARNING, AS_OF, "sleep_hours") is None


def test_inside_personal_band_outside_earth_range_no_alert():
    earth = Band(low=9.0, high=10.0, mean=9.5, demo_parameter=False)
    points = last3([7.4, 7.5, 7.6])
    assert detect_drift(points, READY, AS_OF, "sleep_hours") is None
    assert status_for(7.5, READY, earth) == "in_range"


def test_two_of_three_days_low_sleep_is_drift():
    d = detect_drift(last3([6.2, 7.4, 6.1]), READY, AS_OF, "sleep_hours")
    assert d is not None
    assert d.direction == "low"
    assert d.days_out == 2
    assert d.latest == 6.1
    assert d.start == AS_OF - timedelta(days=2)
    assert d.end == AS_OF


def test_single_outlier_is_not_drift():
    assert detect_drift(last3([7.4, 7.5, 6.0]), READY, AS_OF, "sleep_hours") is None


def test_opposite_directions_are_not_drift():
    assert detect_drift(last3([6.0, 7.5, 9.5]), READY, AS_OF, "sleep_hours") is None


def test_status_for_learning_and_out_of_band():
    assert status_for(7.5, LEARNING, None) == "learning"
    assert status_for(6.0, READY, None) == "worth_checking"
    assert status_for(None, READY, None) == "unavailable"
