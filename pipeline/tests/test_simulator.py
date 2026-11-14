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
