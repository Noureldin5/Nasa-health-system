"""Personal baseline: the astronaut's own normal, learned from their recent days (D1, U3).

Pure functions. No I/O, no clock: `as_of` is passed in.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from domain.params import (
    BAND_K,
    BASELINE_WINDOW_DAYS,
    CALIBRATION_DAYS,
    DRIFT_WINDOW,
    MIN_SPREAD,
)
from schemas import Band, IndicatorKey


@dataclass(frozen=True)
class DailyPoint:
    day: date
    value: float
    source: str


@dataclass(frozen=True)
class Baseline:
    status: Literal["learning", "ready"]
    calibration_day: int
    band: Band | None


def compute_baseline(points: list[DailyPoint], as_of: date, key: IndicatorKey) -> Baseline:
    """Baseline from the days before `as_of`.

    Calibration counts every prior day that has a reading (with several points on one day the
    last one wins). The band itself is built from days older than the drift window, so the very
    days drift is judged on (and a developing CO2 rise or sleep debt) never widen the band they
    are compared with. Seven prior days always leave at least five days for the band.
    """
    start = as_of - timedelta(days=BASELINE_WINDOW_DAYS)
    by_day: dict[date, float] = {}
    for p in sorted(points, key=lambda p: p.day):
        if start <= p.day < as_of:
            by_day[p.day] = p.value

    n = len(by_day)
    if n < CALIBRATION_DAYS:
        return Baseline(status="learning", calibration_day=n, band=None)

    band_end = as_of - timedelta(days=DRIFT_WINDOW - 1)
    values = [v for d, v in by_day.items() if d < band_end]
    mean = statistics.fmean(values)
    half = max(BAND_K * statistics.stdev(values), MIN_SPREAD[key])
    return Baseline(
        status="ready",
        calibration_day=n,
        band=Band(low=mean - half, high=mean + half, mean=mean, demo_parameter=True),
    )
