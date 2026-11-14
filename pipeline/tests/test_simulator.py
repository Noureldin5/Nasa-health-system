from collections import Counter
from datetime import datetime, timedelta, timezone

from pipeline import schema
from pipeline.ingest import validate
from pipeline.mission import DAY, mission_day
from pipeline.simulator import STEPS_PER_DAY, MissionPlan, generate, start_for

START = datetime(2026, 11, 1, 18, 0, tzinfo=timezone.utc)
END_OF_DAY_3 = START + 3 * DAY
PLAN = MissionPlan(seed=42, mission_start=START, days=3, crew=("a1", "a2"))


def test_same_seed_and_time_give_identical_points():
    assert generate(PLAN, END_OF_DAY_3) == generate(PLAN, END_OF_DAY_3)


def test_different_seed_gives_different_data():
    other = MissionPlan(seed=43, mission_start=START, days=3, crew=("a1", "a2"))
    assert [p.value for p in generate(PLAN, END_OF_DAY_3)] != [p.value for p in generate(other, END_OF_DAY_3)]


def test_a_later_now_only_adds_points_and_never_changes_earlier_ones():
    noon_day_2 = START + DAY + timedelta(hours=12)
    early, full = generate(PLAN, noon_day_2), generate(PLAN, END_OF_DAY_3)
    assert set(map(repr, early)) <= set(map(repr, full))
    assert len(early) < len(full)


def test_adding_a_crew_member_does_not_change_the_others():
    solo = MissionPlan(seed=42, mission_start=START, days=3, crew=("a1",))
    a1_only = [p for p in generate(PLAN, END_OF_DAY_3) if p.labels.get("crew_id") == "a1"]
    assert [p for p in generate(solo, END_OF_DAY_3) if "crew_id" in p.labels] == a1_only


def test_nothing_is_written_in_the_future():
    now = START + DAY + timedelta(hours=3, minutes=2)
    points = generate(PLAN, now)
    assert points and max(p.ts for p in points) <= now
    # Day 2 has not reached wake-up yet, so only day 1 has a sleep value.
    sleep_days = [mission_day(p.ts, START) for p in points if p.metric == "sleep_hours" and p.labels["crew_id"] == "a1"]
    assert sleep_days == [1]


def test_every_point_is_simulated_and_fits_the_schema():
    points = generate(PLAN, END_OF_DAY_3)
    for point in points:
        validate(point)
        assert point.labels["source"] == "sim"
    assert {p.metric for p in points} == set(schema.METRICS)


def test_point_counts_per_series():
    counts = Counter((p.metric, p.labels.get("crew_id") or p.labels["module"]) for p in generate(PLAN, END_OF_DAY_3))
    for crew_id in ("a1", "a2"):
        assert counts[("hr_bpm", crew_id)] == 3 * STEPS_PER_DAY
        for metric in schema.METRICS.values():
            if metric.cadence == schema.DAILY:
                assert counts[(metric.name, crew_id)] == 3, metric.name
    assert counts[("co2_ppm", "node1")] == 3 * STEPS_PER_DAY


def test_daily_metrics_have_one_point_per_mission_day():
    points = [p for p in generate(PLAN, END_OF_DAY_3) if p.metric == "mood_score" and p.labels["crew_id"] == "a1"]
    assert [mission_day(p.ts, START) for p in points] == [1, 2, 3]


def test_scales_stay_inside_their_definition():
    points = generate(MissionPlan(seed=7, mission_start=START, days=14, crew=("a1", "a2", "a3")), START + 14 * DAY)
    assert {p.value for p in points if p.metric == "mood_score"} <= {1, 2, 3, 4, 5}
    assert {p.value for p in points if p.metric == "symptom_strength"} <= {0, 1, 2, 3}


def test_start_for_puts_now_inside_the_requested_day():
    for now in (
        datetime(2026, 11, 14, 17, 59, tzinfo=timezone.utc),
        datetime(2026, 11, 14, 18, 0, tzinfo=timezone.utc),
        datetime(2026, 11, 14, 3, 30, tzinfo=timezone(timedelta(hours=6))),
    ):
        start = start_for(now, today_is_day=10)
        assert mission_day(now, start) == 10
        assert (start.hour, start.minute, start.utcoffset()) == (18, 0, timedelta(0))


# --- the 14-day story -------------------------------------------------------------------

from pathlib import Path  # noqa: E402

from pipeline.crew import CREW, module_of  # noqa: E402
from pipeline.simulator import CHECKIN_METRICS, co2_extra_ppm, daily_snapshot  # noqa: E402

MISSION = MissionPlan(seed=42, mission_start=START, days=14, crew=CREW)
MISSION_END = START + 14 * DAY
SNAPSHOT = Path(__file__).resolve().parents[2] / "data" / "simulated" / "mission_seed42_14d_daily.csv"


def daily_mean(points, metric, key, value, day):
    values = [p.value for p in points if p.metric == metric and p.labels.get(key) == value and mission_day(p.ts, START) == day]
    return sum(values) / len(values)


def headache_by_day(points, crew_id):
    return {
        mission_day(p.ts, START): p.value
        for p in points
        if p.metric == "symptom_strength" and p.labels["crew_id"] == crew_id
    }


def test_co2_rises_in_node1_before_the_first_headache():
    points = generate(MISSION, MISSION_END)
    usual = daily_mean(points, "co2_ppm", "module", "node1", 8)
    assert daily_mean(points, "co2_ppm", "module", "node1", 9) > usual + 600  # the rise is on day 9
    headaches = headache_by_day(points, "a1")
    assert [day for day, strength in headaches.items() if strength > 0] == [10, 11]  # the headache follows on day 10
    assert headaches[10] == 2 and headaches[11] == 1


def test_co2_returns_to_its_usual_level_and_headaches_stop():
    points = generate(MISSION, MISSION_END)
    usual = daily_mean(points, "co2_ppm", "module", "node1", 8)
    assert abs(daily_mean(points, "co2_ppm", "module", "node1", 13) - usual) < 100
    assert all(headache_by_day(points, "a1")[day] == 0 for day in (12, 13, 14))


def test_the_other_module_and_its_crew_member_stay_steady():
    points = generate(MISSION, MISSION_END)
    assert module_of("a3") == "lab"
    lab = [daily_mean(points, "co2_ppm", "module", "lab", day) for day in range(1, 15)]
    assert max(lab) - min(lab) < 100
    assert set(headache_by_day(points, "a3").values()) == {0}
    assert all(co2_extra_ppm("lab", t / 10) == 0 for t in range(0, 140))


def test_sleep_debt_drifts_down_then_recovers():
    points = generate(MISSION, MISSION_END)
    sleep = {mission_day(p.ts, START): p.value for p in points if p.metric == "sleep_hours" and p.labels["crew_id"] == "a2"}
    baseline = sum(sleep[day] for day in range(1, 8)) / 7
    assert sleep[11] < baseline - 1 and sleep[12] < baseline - 1  # the debt
    assert sleep[14] > baseline - 0.5  # the recovery
    resting = lambda day: daily_mean(points, "hr_bpm", "crew_id", "a2", day)  # noqa: E731
    assert resting(12) > resting(7) + 4 and abs(resting(14) - resting(7)) < 1


def test_the_first_week_is_a_steady_baseline_for_everyone():
    points = [p for p in generate(MISSION, MISSION_END) if mission_day(p.ts, START) <= 7]
    assert {p.value for p in points if p.metric == "symptom_strength"} == {0}
    for crew_id in CREW:
        means = [daily_mean(points, "hr_bpm", "crew_id", crew_id, day) for day in range(1, 8)]
        assert max(means) - min(means) < 1


def test_live_crew_has_no_simulated_check_in_from_today():
    now = START + 9 * DAY + timedelta(hours=12)  # midday on day 10
    points = generate(MISSION, now, live_crew=("a1",), live_from_day=10)
    a1_days = {mission_day(p.ts, START) for p in points if p.metric in CHECKIN_METRICS and p.labels["crew_id"] == "a1"}
    a2_days = {mission_day(p.ts, START) for p in points if p.metric in CHECKIN_METRICS and p.labels["crew_id"] == "a2"}
    assert max(a1_days) == 9 and max(a2_days) == 10
    # Passive data for the live crew member is still there today.
    assert any(p.metric == "sleep_hours" and p.labels["crew_id"] == "a1" and mission_day(p.ts, START) == 10 for p in points)


def test_replay_adds_exactly_the_points_that_became_due():
    earlier, later = START + 9 * DAY + timedelta(hours=12), START + 9 * DAY + timedelta(hours=13)
    loaded, replayed = generate(MISSION, earlier), generate(MISSION, later, after=earlier)
    assert sorted(map(repr, loaded + replayed)) == sorted(map(repr, generate(MISSION, later)))
    assert replayed and min(p.ts for p in replayed) > earlier


def test_committed_snapshot_matches_the_generator():
    # If this fails, run: make snapshot
    text = SNAPSHOT.read_text(encoding="utf-8")
    assert text == daily_snapshot(MISSION)
    assert text.startswith("# SIMULATED DATA")
    assert len(text.splitlines()) == 2 + 14 * len(CREW)


def test_load_mission_dry_run_counts_without_writing():
    from pipeline.simulator.load import load_mission

    now = datetime(2026, 11, 14, 4, 0, tzinfo=timezone.utc)
    result = load_mission(today_is_day=10, live_crew=("a1",), now=now, dry_run=True)
    assert result.written == 0 and result.today_is_day == 10
    assert result.counts["hr_bpm"] > 0 and result.plan.crew == ("a1", "a2", "a3")
    assert mission_day(now, result.plan.mission_start) == 10


def test_load_mission_rejects_a_day_outside_the_mission():
    import pytest

    from pipeline.simulator.load import load_mission

    with pytest.raises(ValueError):
        load_mission(today_is_day=15, dry_run=True)
