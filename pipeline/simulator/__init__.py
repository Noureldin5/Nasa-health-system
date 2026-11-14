"""Simulated mission data. Every point is labeled source="sim". No real patient data.

This is the first, flat version: a steady personal baseline with noise, no story yet.
The 14-day story (CO2 rise, headaches, sleep debt, recovery) is C3 and builds on it.

Generation is pure: it never reads the clock or the network. The same plan and the
same `now` always give the same points.

Every number in this file is a **Demo parameter**: chosen to look plausible on a chart,
not taken from a medical source, and never used as a health threshold.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from pipeline.ingest import Point
from pipeline.mission import DAY

STEP = timedelta(minutes=5)
STEPS_PER_DAY = DAY // STEP

# Mission days start at this UTC hour. Demo parameter: 18:00 UTC is midnight in Bishkek,
# so "today" already has its morning data whenever the demo is run during the local day.
DAY_START_UTC_HOUR = 18

# Mission time of day (hours after the day starts) for the once-a-day values.
WAKE_HOUR = 6.0  # sleep_hours is stamped at wake-up
MEASURE_HOUR = 7.0  # blood pressure, glucose, temperature
CHECKIN_HOUR = 7.5  # mood, symptoms

DEFAULT_MODULES = ("node1",)


@dataclass(frozen=True)
class MissionPlan:
    seed: int
    mission_start: datetime  # start of mission day 1, timezone-aware
    days: int  # mission days to generate: 1..days
    crew: tuple[str, ...]
    modules: tuple[str, ...] = DEFAULT_MODULES


def start_for(now: datetime, *, today_is_day: int, day_start_utc_hour: int = DAY_START_UTC_HOUR) -> datetime:
    """Mission start such that `now` falls inside mission day `today_is_day`."""
    now = now.astimezone(timezone.utc)
    today_start = now.replace(hour=day_start_utc_hour, minute=0, second=0, microsecond=0)
    if today_start > now:
        today_start -= DAY
    return today_start - (today_is_day - 1) * DAY


def _rng(plan: MissionPlan, *parts: object) -> random.Random:
    # Seeding from a string is stable across runs and machines. One generator per
    # (series, day), so cutting the data off at `now` never changes earlier values.
    return random.Random(":".join(str(part) for part in (plan.seed, *parts)))


@dataclass(frozen=True)
class CrewBaseline:
    """One person's own normal. Demo parameters, drawn once per crew member from the seed."""

    hr_rest: float
    sleep_hours: float
    bp_systolic: float
    bp_diastolic: float
    glucose: float
    body_temp: float
    mood: float


def crew_baseline(plan: MissionPlan, crew_id: str) -> CrewBaseline:
    rng = _rng(plan, crew_id, "baseline")
    return CrewBaseline(
        hr_rest=rng.uniform(56, 66),
        sleep_hours=rng.uniform(6.8, 7.6),
        bp_systolic=rng.uniform(112, 124),
        bp_diastolic=rng.uniform(72, 80),
        glucose=rng.uniform(86, 96),
        body_temp=rng.uniform(36.5, 36.9),
        mood=rng.uniform(3.6, 4.4),
    )


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _crew_day(plan: MissionPlan, crew_id: str, base: CrewBaseline, day: int, day_start: datetime) -> list[Point]:
    labels = {"crew_id": crew_id, "source": "sim"}
    points: list[Point] = []

    rng = _rng(plan, crew_id, "hr", day)
    for step in range(STEPS_PER_DAY):
        hour = step * STEP / timedelta(hours=1)
        level = base.hr_rest - 6 if hour < WAKE_HOUR else base.hr_rest + 9  # asleep, then awake
        points.append(Point("hr_bpm", round(level + rng.gauss(0, 2.5)), day_start + step * STEP, labels))

    rng = _rng(plan, crew_id, "daily", day)
    wake = day_start + timedelta(hours=WAKE_HOUR)
    measure = day_start + timedelta(hours=MEASURE_HOUR)
    checkin = day_start + timedelta(hours=CHECKIN_HOUR)
    points += [
        Point("sleep_hours", round(_clamp(base.sleep_hours + rng.gauss(0, 0.35), 3, 10), 1), wake, labels),
        Point("bp_systolic_mmhg", round(base.bp_systolic + rng.gauss(0, 3)), measure, labels),
        Point("bp_diastolic_mmhg", round(base.bp_diastolic + rng.gauss(0, 2.5)), measure, labels),
        Point("glucose_mg_dl", round(base.glucose + rng.gauss(0, 4)), measure, labels),
        Point("body_temp_c", round(base.body_temp + rng.gauss(0, 0.12), 1), measure, labels),
        Point("mood_score", int(_clamp(round(base.mood + rng.gauss(0, 0.5)), 1, 5)), checkin, labels),
        Point("symptom_strength", 0, checkin, {**labels, "symptom": "headache"}),
    ]
    return points


def _module_day(plan: MissionPlan, module: str, level: float, day: int, day_start: datetime) -> list[Point]:
    rng = _rng(plan, module, "co2", day)
    labels = {"module": module, "source": "sim"}
    return [
        Point("co2_ppm", round(level + rng.gauss(0, 120)), day_start + step * STEP, labels)
        for step in range(STEPS_PER_DAY)
    ]


def generate(plan: MissionPlan, now: datetime) -> list[Point]:
    """All points of the plan with ts <= now. Nothing is written in the future."""
    if plan.mission_start.tzinfo is None or now.tzinfo is None:
        raise ValueError("mission_start and now must be timezone-aware")
    points: list[Point] = []
    baselines = {crew_id: crew_baseline(plan, crew_id) for crew_id in plan.crew}
    # Usual cabin CO2 level per module. Demo parameter; the cited limit comes with Cabin Link (C6, C7).
    co2_levels = {module: _rng(plan, module, "co2-level").uniform(2300, 2700) for module in plan.modules}

    for day in range(1, plan.days + 1):
        day_start = plan.mission_start + (day - 1) * DAY
        for crew_id in plan.crew:
            points += _crew_day(plan, crew_id, baselines[crew_id], day, day_start)
        for module in plan.modules:
            points += _module_day(plan, module, co2_levels[module], day, day_start)
    return [point for point in points if point.ts <= now]
