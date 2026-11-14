from datetime import datetime, timedelta, timezone

import pytest

from pipeline import references
from pipeline.ingest import Point, flush, write_points
from pipeline.mission import DAY
from pipeline.queries import DailyValue, Sample, baseline_window, daily, window_stats
from pipeline.queries.cabin import CAVEAT, cabin_link, hours_above, lagged_correlation, pearson

START = datetime(2026, 11, 1, 18, 0, tzinfo=timezone.utc)


def row(day, mean):
    return DailyValue(day=day, mean=mean, min=mean, max=mean, n=1, sources=("sim",))


# --- pure -------------------------------------------------------------------------------


def test_window_stats_uses_only_days_inside_the_window():
    rows = [row(1, 100.0), row(2, 7.0), row(3, 8.0), row(4, 9.0), row(5, 100.0)]
    stats = window_stats(rows, 2, 4)
    assert (stats.n_days, stats.mean, stats.sd, stats.min, stats.max) == (3, 8.0, 1.0, 7.0, 9.0)


def test_window_stats_with_too_little_data():
    assert window_stats([], 1, 7).mean is None and window_stats([], 1, 7).n_days == 0
    one = window_stats([row(3, 7.5)], 1, 7)
    assert (one.n_days, one.mean, one.sd) == (1, 7.5, None)


def test_pearson_is_undefined_without_variation_or_enough_pairs():
    assert pearson([1, 2, 3], [1, 2, 3]) is None  # fewer than 5 pairs
    assert pearson([1, 2, 3, 4, 5], [0, 0, 0, 0, 0]) is None
    assert pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) == pytest.approx(1.0)


def test_lagged_correlation_finds_the_symptom_one_day_after_the_rise():
    co2 = {day: 2600.0 for day in range(1, 13)} | {9: 4500.0, 10: 4600.0}
    symptom = {day: 0.0 for day in range(1, 13)} | {10: 2.0, 11: 2.0}  # one day behind the CO2
    lag0, lag1, lag2 = (lagged_correlation(co2, symptom, lag) for lag in (0, 1, 2))
    assert lag1.r == pytest.approx(1.0, abs=0.01) and lag1.n == 11
    assert lag1.r > lag0.r > 0 and lag1.r > lag2.r


def test_one_symptom_day_gives_no_correlation():
    co2 = {day: 2600.0 for day in range(1, 11)} | {9: 4500.0}
    symptom = {day: 0.0 for day in range(1, 11)} | {10: 2.0}
    assert lagged_correlation(co2, symptom, 1).r is None


def test_hours_above_uses_one_hour_means():
    limit = 3947
    samples = [Sample(START + timedelta(minutes=5 * i), 5000.0 if i < 12 else 3000.0, "sim") for i in range(36)]
    samples[13] = Sample(samples[13].ts, 9000.0, "sim")  # one spike does not make the hour exceed: mean is 3500
    assert hours_above(samples, START, limit) == 1


def test_co2_limit_is_cited_and_converted():
    limit = references.CO2_LIMIT
    assert limit["value_mmhg"] == 3.0 and limit["value_ppm"] == 3947
    for reference in references.ALL:
        assert reference["source"] and reference["url"].startswith("https://") and reference["accessed"]
    assert references.ppm_to_mmhg(references.mmhg_to_ppm(3.0)) == pytest.approx(3.0)


# --- against a real VictoriaMetrics -----------------------------------------------------


def recent_start() -> datetime:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return now - 12 * DAY


@pytest.mark.vm
def test_daily_aggregates_a_five_minute_metric_per_mission_day(test_id):
    start = recent_start()
    labels = {"crew_id": test_id, "source": "sim"}
    write_points(
        [Point("hr_bpm", value, start + timedelta(minutes=5 * i), labels) for i, value in enumerate([60, 62, 64])]
        + [Point("hr_bpm", 70, start + DAY + timedelta(hours=1), labels)]
        + [Point("hr_bpm", 80, start + 3 * DAY, labels)]  # day 4, outside the request
    )
    flush()

    rows = daily("hr_bpm", crew_id=test_id, first_day=1, last_day=3, mission_start=start)
    assert rows == [
        DailyValue(day=1, mean=62.0, min=60.0, max=64.0, n=3, sources=("sim",)),
        DailyValue(day=2, mean=70.0, min=70.0, max=70.0, n=1, sources=("sim",)),
    ]


@pytest.mark.vm
def test_baseline_window_over_seven_days_of_a_daily_metric(test_id):
    start = recent_start()
    labels = {"crew_id": test_id, "source": "sim"}
    hours = [7.0, 7.5, 7.0, 7.5, 7.0, 7.5, 7.0, 5.0]  # day 8 is the drop and is outside the window
    write_points([Point("sleep_hours", h, start + i * DAY + timedelta(hours=6), labels) for i, h in enumerate(hours)])
    flush()

    stats = baseline_window("sleep_hours", crew_id=test_id, through_day=7, mission_start=start)
    assert (stats.first_day, stats.last_day, stats.n_days) == (1, 7, 7)
    assert stats.mean == pytest.approx(7.214, abs=0.001) and stats.sd == pytest.approx(0.267, abs=0.001)
    assert (stats.min, stats.max) == (7.0, 7.5)

    early = baseline_window("sleep_hours", crew_id=test_id, through_day=3, mission_start=start)
    assert (early.first_day, early.n_days) == (-3, 3)  # calibration: fewer days than the window


@pytest.mark.vm
def test_cabin_link_on_a_written_story(test_id):
    start = recent_start()
    co2 = {"module": test_id, "source": "sim"}
    headache = {"crew_id": test_id, "symptom": "headache", "source": "sim"}
    points = []
    for day in range(1, 11):
        level = 4600 if day in (8, 9) else 2600
        points += [Point("co2_ppm", level, start + (day - 1) * DAY + timedelta(hours=h), co2) for h in range(24)]
        if day != 10:  # no check-in yet today
            strength = 2 if day == 9 else 0
            points.append(Point("symptom_strength", strength, start + (day - 1) * DAY + timedelta(hours=7.5), headache))
    points.append(Point("symptom_strength", 1, start + 9 * DAY + timedelta(hours=8), {**headache, "source": "manual"}))
    write_points(points)
    flush()

    link = cabin_link(test_id, through_day=10, module=test_id, mission_start=start)

    assert (link.module, link.first_day, link.last_day, link.usual_co2_ppm) == (test_id, 1, 10, 2600.0)
    assert [d.day for d in link.days if d.above_usual] == [8, 9]
    assert [d.hours_above_limit for d in link.days] == [0] * 7 + [24, 24, 0]
    assert [(d.day, d.symptom_strength, d.symptom_source) for d in link.days if d.symptom_strength] == [
        (9, 2.0, "sim"),
        (10, 1.0, "manual"),
    ]
    assert (link.symptom_days, link.symptom_days_after_high_co2) == (2, 2)
    assert link.best_lag is not None and link.best_lag.lag_days == 1 and link.best_lag.r > 0.5
    assert link.limit is references.CO2_LIMIT and link.caveat == CAVEAT


@pytest.mark.vm
def test_cabin_link_without_data_is_empty_not_an_error(test_id):
    link = cabin_link(test_id, through_day=5, module=test_id, mission_start=recent_start())
    assert link.usual_co2_ppm is None and link.best_lag is None and link.symptom_days == 0
    assert [d.co2_mean_ppm for d in link.days] == [None] * 5
