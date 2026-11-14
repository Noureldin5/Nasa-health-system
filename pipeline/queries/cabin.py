"""Cabin Link (S1): cabin CO2 against a symptom, day by day, with a lag.

    from pipeline.queries.cabin import cabin_link

    link = cabin_link("a1", through_day=10)
    link.days            # one row per mission day: CO2 of the person's module and the symptom
    link.lags            # correlation when the symptom is compared with CO2 0, 1, 2 days earlier
    link.limit           # the cited CO2 limit (pipeline/references.py)

Decision support, not diagnosis: this shows a pattern to check. A correlation over a few
days does not show that CO2 caused the symptom. CAVEAT must travel with the numbers to the UI.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta

from pipeline import crew as crew_config
from pipeline import mission, references
from pipeline.queries import Sample, daily, series

CAVEAT = "A pattern to check, not a cause. Decision support, not a diagnosis."

# A day counts as "above usual" when its mean CO2 is this much above the median day of the
# window. Demo parameter: there is no cited threshold for "unusual for this module".
ABOVE_USUAL_RATIO = 1.15
# Fewer paired days than this and no correlation is reported. Demo parameter.
MIN_PAIRS = 5
# A correlation built on a single day with the symptom says nothing. Demo parameter.
MIN_SYMPTOM_DAYS = 2
HOUR = timedelta(hours=1)


@dataclass(frozen=True)
class CabinDay:
    day: int
    co2_mean_ppm: float | None  # None when the module has no CO2 data that day
    co2_max_ppm: float | None
    hours_above_limit: int  # mission hours whose 1-hour mean was above the cited limit
    above_usual: bool
    symptom_strength: float | None  # None when there was no check-in that day
    symptom_source: str | None


@dataclass(frozen=True)
class LagResult:
    lag_days: int  # symptom on day D is compared with CO2 on day D - lag_days
    r: float | None  # Pearson correlation; None when it cannot be computed
    n: int  # paired days


@dataclass(frozen=True)
class CabinLink:
    crew_id: str
    module: str
    symptom: str
    first_day: int
    last_day: int
    usual_co2_ppm: float | None  # median daily mean over the window
    days: list[CabinDay]
    lags: list[LagResult]
    best_lag: LagResult | None  # the lag with the strongest positive correlation, if any
    symptom_days: int  # days with the symptom reported
    symptom_days_after_high_co2: int  # of those, days with CO2 above usual that day or the day before
    limit: dict  # references.CO2_LIMIT
    study: dict  # references.CO2_HEADACHE_STUDY
    caveat: str


def pearson(xs: list[float], ys: list[float]) -> float | None:
    """Pearson correlation, or None when it is undefined (too few pairs, or no variation)."""
    if len(xs) != len(ys) or len(xs) < MIN_PAIRS:
        return None
    if len(set(xs)) < 2 or len(set(ys)) < 2:
        return None
    return statistics.correlation(xs, ys)


def lagged_correlation(co2_by_day: dict[int, float], symptom_by_day: dict[int, float], lag_days: int) -> LagResult:
    """Pure: correlate the symptom on day D with CO2 on day D - lag_days."""
    pairs = [
        (co2_by_day[day - lag_days], strength)
        for day, strength in sorted(symptom_by_day.items())
        if day - lag_days in co2_by_day
    ]
    if sum(1 for _, strength in pairs if strength > 0) < MIN_SYMPTOM_DAYS:
        return LagResult(lag_days=lag_days, r=None, n=len(pairs))
    r = pearson([co2 for co2, _ in pairs], [strength for _, strength in pairs])
    return LagResult(lag_days=lag_days, r=None if r is None else round(r, 3), n=len(pairs))


def hours_above(samples: list[Sample], day_start: datetime, limit_ppm: float) -> int:
    """Pure: how many hours of the mission day had a 1-hour mean above the limit."""
    buckets: dict[int, list[float]] = {}
    for sample in samples:
        buckets.setdefault((sample.ts - day_start) // HOUR, []).append(sample.value)
    return sum(1 for hour, values in buckets.items() if 0 <= hour < 24 and statistics.fmean(values) > limit_ppm)


def cabin_link(
    crew_id: str,
    *,
    through_day: int,
    days: int = 14,
    symptom: str = "headache",
    max_lag_days: int = 2,
    module: str | None = None,
    mission_start: datetime | None = None,
    base_url: str | None = None,
) -> CabinLink:
    """CO2 of the person's module against their symptom for the `days` mission days ending with `through_day`."""
    if days < 1 or max_lag_days < 0:
        raise ValueError("days must be at least 1 and max_lag_days must not be negative")
    if mission_start is None:
        mission_start = mission.mission_start(base_url=base_url)
    module = module or crew_config.module_of(crew_id)
    first_day = max(1, through_day - days + 1)
    limit_ppm = references.CO2_LIMIT["value_ppm"]

    start, _ = mission.day_window(first_day, mission_start)
    _, end = mission.day_window(through_day, mission_start)
    co2_samples = series("co2_ppm", labels={"module": module}, start=start, end=end, base_url=base_url)
    co2_days: dict[int, list[Sample]] = {}
    for sample in co2_samples:
        co2_days.setdefault(mission.mission_day(sample.ts, mission_start), []).append(sample)
    co2_mean = {day: statistics.fmean(s.value for s in samples) for day, samples in co2_days.items()}

    symptom_rows = daily(
        "symptom_strength", first_day=first_day, last_day=through_day, crew_id=crew_id,
        labels={"symptom": symptom}, mission_start=mission_start, base_url=base_url,
    )
    symptom_by_day = {row.day: row.mean for row in symptom_rows}
    symptom_source = {row.day: row.sources[-1] if len(row.sources) == 1 else "mixed" for row in symptom_rows}

    usual = statistics.median(co2_mean.values()) if co2_mean else None
    high = {day for day, mean in co2_mean.items() if usual is not None and mean > usual * ABOVE_USUAL_RATIO}

    rows = []
    for day in range(first_day, through_day + 1):
        samples = co2_days.get(day, [])
        rows.append(
            CabinDay(
                day=day,
                co2_mean_ppm=round(co2_mean[day], 1) if day in co2_mean else None,
                co2_max_ppm=max(s.value for s in samples) if samples else None,
                hours_above_limit=hours_above(samples, mission.day_window(day, mission_start)[0], limit_ppm),
                above_usual=day in high,
                symptom_strength=symptom_by_day.get(day),
                symptom_source=symptom_source.get(day),
            )
        )

    lags = [lagged_correlation(co2_mean, symptom_by_day, lag) for lag in range(max_lag_days + 1)]
    positive = [lag for lag in lags if lag.r is not None and lag.r > 0]
    symptom_days = [day for day, strength in symptom_by_day.items() if strength > 0]

    return CabinLink(
        crew_id=crew_id,
        module=module,
        symptom=symptom,
        first_day=first_day,
        last_day=through_day,
        usual_co2_ppm=None if usual is None else round(usual, 1),
        days=rows,
        lags=lags,
        best_lag=max(positive, key=lambda lag: lag.r) if positive else None,
        symptom_days=len(symptom_days),
        symptom_days_after_high_co2=sum(1 for day in symptom_days if day in high or day - 1 in high),
        limit=references.CO2_LIMIT,
        study=references.CO2_HEADACHE_STUDY,
        caveat=CAVEAT,
    )
