"""Simulated mission data. Every point is labeled source="sim". No real patient data.

Each crew member has a steady personal baseline with noise. On top of it runs the
14-day story from docs/USER-FLOW.md ("Demo story") and docs/REQUIREMENTS.md:

  days 1-8   everyone at their own baseline
  day 9      CO2 in node1 rises (a1 and a2 live there) and stays high through day 11
  day 10     a1 reports a moderate headache, a2 a mild one: the rise comes first
  day 11     a1 still has a mild headache; CO2 starts to fall in the evening
  day 12     CO2 back to its usual level, no headaches
  days 8-12  a2 builds a sleep debt: shorter nights, resting heart rate up, mood down
  days 13-14 a2 recovers
  a3         lives in the lab module and stays steady throughout (the control)

The story is a simulated pattern for the demo. It does not claim that CO2 causes headaches.

Generation is pure: it never reads the clock or the network. The same plan and the
same `now` always give the same points.

Every number in this file is a **Demo parameter**: chosen to look plausible on a chart,
not taken from a medical source, and never used as a health threshold.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from pipeline import crew as crew_config
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

DEFAULT_MODULES = crew_config.MODULES

# --- The story. Every number is a Demo parameter. -----------------------------------

# Extra CO2 in ppm by mission time (in days since mission start; day 9 begins at 8.0).
# Piecewise linear: rises over the first half of day 9, holds, falls from the evening of day 11.
CO2_RISE_MODULE = "node1"
# Demo parameter. Chosen so no 1-hour mean passes the cited limit (about 3,947 ppm, pipeline/references.py)
# while the rise stays well above the usual level: a pattern below the alarm, not an alarm.
CO2_RISE_PPM = 1000
CO2_RISE_SHAPE = ((8.0, 0.0), (8.5, 1.0), (10.75, 1.0), (11.25, 0.0))

# symptom_strength for headache, by crew member and mission day (0 none ... 3 strong).
HEADACHE = {"a1": {10: 2, 11: 1}, "a2": {10: 1}}

# Changes to the day's values, by crew member and mission day.
SLEEP_DELTA_HOURS = {
    "a1": {10: -0.5, 11: -0.6},
    "a2": {8: -0.5, 9: -1.0, 10: -1.5, 11: -1.9, 12: -2.1, 13: -0.8},
}
HR_DELTA_BPM = {"a2": {9: 2, 10: 4, 11: 5, 12: 6, 13: 3}}
MOOD_DELTA = {"a1": {10: -1, 11: -1}, "a2": {10: -1, 11: -1, 12: -1}}

# Check-in values a person types: left out for a "live" crew member from today on,
# so the demo's own check-in is the only value for that day.
CHECKIN_METRICS = ("mood_score", "symptom_strength")


def co2_extra_ppm(module: str, mission_time_days: float) -> float:
    """Story CO2 on top of the module's usual level."""
    if module != CO2_RISE_MODULE:
        return 0.0
    shape = CO2_RISE_SHAPE
    if mission_time_days <= shape[0][0] or mission_time_days >= shape[-1][0]:
        return 0.0
    for (t0, v0), (t1, v1) in zip(shape, shape[1:]):
        if t0 <= mission_time_days <= t1:
            return CO2_RISE_PPM * (v0 + (v1 - v0) * (mission_time_days - t0) / (t1 - t0))
    return 0.0


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


# Demo parameters: plausible resting values for a healthy adult, drawn once per crew member. Not taken from
# a source and never used as a threshold or reference range. Same for every noise width below.
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

    hr_rest = base.hr_rest + HR_DELTA_BPM.get(crew_id, {}).get(day, 0)
    rng = _rng(plan, crew_id, "hr", day)
    for step in range(STEPS_PER_DAY):
        hour = step * STEP / timedelta(hours=1)
        level = hr_rest - 6 if hour < WAKE_HOUR else hr_rest + 9  # asleep, then awake
        points.append(Point("hr_bpm", round(level + rng.gauss(0, 2.5)), day_start + step * STEP, labels))

    rng = _rng(plan, crew_id, "daily", day)
    wake = day_start + timedelta(hours=WAKE_HOUR)
    measure = day_start + timedelta(hours=MEASURE_HOUR)
    checkin = day_start + timedelta(hours=CHECKIN_HOUR)
    sleep = base.sleep_hours + SLEEP_DELTA_HOURS.get(crew_id, {}).get(day, 0)
    mood = base.mood + MOOD_DELTA.get(crew_id, {}).get(day, 0)
    headache = HEADACHE.get(crew_id, {}).get(day, 0)
    points += [
        Point("sleep_hours", round(_clamp(sleep + rng.gauss(0, 0.25), 3, 10), 1), wake, labels),
        Point("bp_systolic_mmhg", round(base.bp_systolic + rng.gauss(0, 3)), measure, labels),
        Point("bp_diastolic_mmhg", round(base.bp_diastolic + rng.gauss(0, 2.5)), measure, labels),
        Point("glucose_mg_dl", round(base.glucose + rng.gauss(0, 4)), measure, labels),
        Point("body_temp_c", round(base.body_temp + rng.gauss(0, 0.12), 1), measure, labels),
        Point("mood_score", int(_clamp(round(mood + rng.gauss(0, 0.5)), 1, 5)), checkin, labels),
        Point("symptom_strength", headache, checkin, {**labels, "symptom": "headache"}),
    ]
    return points


def _module_day(plan: MissionPlan, module: str, level: float, day: int, day_start: datetime) -> list[Point]:
    rng = _rng(plan, module, "co2", day)
    labels = {"module": module, "source": "sim"}
    points = []
    for step in range(STEPS_PER_DAY):
        mission_time = (day - 1) + step / STEPS_PER_DAY
        value = level + co2_extra_ppm(module, mission_time) + rng.gauss(0, 120)
        points.append(Point("co2_ppm", round(value), day_start + step * STEP, labels))
    return points


def generate(
    plan: MissionPlan,
    now: datetime,
    *,
    after: datetime | None = None,
    live_crew: tuple[str, ...] = (),
    live_from_day: int | None = None,
) -> list[Point]:
    """All points of the plan with ts <= now. Nothing is written in the future.

    after          only points with ts > after (used by the live replay to add what is new)
    live_crew      crew members who check in by hand in the demo: from `live_from_day` on,
                   their check-in values (mood, symptoms) are not simulated
    """
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
    def keep(point: Point) -> bool:
        if point.ts > now or (after is not None and point.ts <= after):
            return False
        if live_from_day is not None and point.metric in CHECKIN_METRICS and point.labels.get("crew_id") in live_crew:
            return (point.ts - plan.mission_start) // DAY + 1 < live_from_day
        return True

    return [point for point in points if keep(point)]


def daily_snapshot(plan: MissionPlan) -> str:
    """The whole plan as a small CSV, one row per crew member per mission day.

    For reading and for diffing the story, not an input to anything. Times are mission days,
    so the file does not depend on when it was generated.
    """
    end = plan.mission_start + plan.days * DAY
    points = generate(plan, end)
    daily = [name for name in (
        "sleep_hours", "bp_systolic_mmhg", "bp_diastolic_mmhg", "glucose_mg_dl", "body_temp_c", "mood_score",
    )]
    rows = ["# SIMULATED DATA, not real patient data. Generated by pipeline.simulator, seed %d." % plan.seed,
            "mission_day,crew_id,module,hr_bpm_mean,co2_ppm_mean," + ",".join(daily) + ",headache_strength"]
    for day in range(1, plan.days + 1):
        start, stop = plan.mission_start + (day - 1) * DAY, plan.mission_start + day * DAY
        today = [p for p in points if start <= p.ts < stop]
        for crew_id in plan.crew:
            module = crew_config.module_of(crew_id)
            mine = [p for p in today if p.labels.get("crew_id") == crew_id]
            hr = [p.value for p in mine if p.metric == "hr_bpm"]
            co2 = [p.value for p in today if p.metric == "co2_ppm" and p.labels["module"] == module]
            value = {p.metric: p.value for p in mine if p.metric != "hr_bpm"}
            cells = [str(day), crew_id, module, f"{sum(hr) / len(hr):.1f}", f"{sum(co2) / len(co2):.0f}"]
            cells += [str(value[name]) for name in daily] + [str(value["symptom_strength"])]
            rows.append(",".join(cells))
    return "\n".join(rows) + "\n"
