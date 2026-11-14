"""The demo as the script tells it, on the pure functions (no VictoriaMetrics).

Seed 42, today is mission day 10 at about 10:00 into the day, a1 checks in by hand.
These tests pin what the demo says on screen, not how the code is built.
"""

import statistics
from datetime import datetime, timedelta, timezone

from pipeline import mission, references
from pipeline.mission import DAY, mission_day
from pipeline.queries import DailyValue, Sample, window_stats
from pipeline.queries.cabin import hours_above, lagged_correlation
from pipeline.simulator import MissionPlan, generate, start_for

NOW = datetime(2026, 11, 14, 4, 0, tzinfo=timezone.utc)  # 10:00 in Bishkek; mission days start at 18:00 UTC
TODAY = 10
PLAN = MissionPlan(42, start_for(NOW, today_is_day=TODAY), 14, ("a1", "a2", "a3"))
POINTS = generate(PLAN, NOW, live_crew=("a1",), live_from_day=TODAY)


def values(metric, key, ident):
    return [p for p in POINTS if p.metric == metric and p.labels.get(key) == ident]


def daily_means(metric, key, ident):
    by_day: dict[int, list[float]] = {}
    for p in values(metric, key, ident):
        by_day.setdefault(mission_day(p.ts, PLAN.mission_start), []).append(p.value)
    return {day: statistics.fmean(v) for day, v in by_day.items()}


def test_today_is_a_partial_day_and_its_heart_rate_mean_is_biased():
    # Why the contract says: never average today into the baseline, never compare today's mean to it.
    a3 = daily_means("hr_bpm", "crew_id", "a3")
    rows = [DailyValue(d, m, m, m, 1, ("sim",)) for d, m in a3.items() if d < TODAY]
    baseline = window_stats(rows, 1, TODAY - 1)
    assert baseline.sd is not None and baseline.sd < 1.0
    assert abs(a3[TODAY] - baseline.mean) > 5 * baseline.sd  # the partial day looks like a huge drift


def test_the_control_crew_member_is_inside_the_baseline_on_the_last_finished_day():
    a3 = daily_means("hr_bpm", "crew_id", "a3")
    rows = [DailyValue(d, m, m, m, 1, ("sim",)) for d, m in a3.items() if d < TODAY - 1]
    baseline = window_stats(rows, 1, TODAY - 2)
    assert abs(a3[TODAY - 1] - baseline.mean) <= 3 * baseline.sd


def test_a2_sleep_debt_is_visible_against_a_clean_baseline():
    sleep = daily_means("sleep_hours", "crew_id", "a2")
    rows = [DailyValue(d, m, m, m, 1, ("sim",)) for d, m in sleep.items() if d <= 7]
    baseline = window_stats(rows, 1, 7)
    assert sleep[TODAY] < baseline.mean - 3 * baseline.sd


def test_cabin_rise_precedes_the_headache_and_stays_under_the_cited_limit():
    node1 = values("co2_ppm", "module", "node1")
    co2 = daily_means("co2_ppm", "module", "node1")
    usual = statistics.median(co2[d] for d in range(1, 9))
    assert co2[9] > usual * 1.15  # day 9: the rise, before any symptom
    assert not [p for p in values("symptom_strength", "crew_id", "a1") if mission_day(p.ts, PLAN.mission_start) <= 9 and p.value > 0]
    limit = references.CO2_LIMIT["value_ppm"]
    for day in range(1, TODAY + 1):
        day_start = PLAN.mission_start + (day - 1) * DAY
        samples = [Sample(p.ts, p.value, "sim") for p in node1 if day_start <= p.ts < day_start + DAY]
        assert hours_above(samples, day_start, limit) == 0, day  # a pattern below the alarm, not an alarm


def test_cabin_link_correlation_on_the_demo_day_is_not_available_by_design():
    # KNOWN LIMIT, see docs/HANDOFF.md open item 1: on day 10 a1 has no simulated symptom (the live
    # check-in is typed by hand), so there are fewer than 2 symptom days and r is None.
    # The UI leads with the day overlay on that day, not with r. This test fails if that changes.
    co2 = daily_means("co2_ppm", "module", "node1")
    symptom = {mission_day(p.ts, PLAN.mission_start): p.value for p in values("symptom_strength", "crew_id", "a1")}
    assert all(lagged_correlation(co2, symptom, lag).r is None for lag in (0, 1, 2))
