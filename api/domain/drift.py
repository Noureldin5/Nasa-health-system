"""Drift: a reading that leaves the astronaut's own band on 2 of the last 3 days (D1).

Earth or OSD-569 ranges are accepted by `status_for` only so callers can pass them through;
they never change the result. Reference, not alarm (CLAUDE.md rule 6).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from domain.baseline import Baseline, DailyPoint
from domain.params import BAND_K, DRIFT_DAYS, DRIFT_WINDOW
from schemas import Band, IndicatorKey, Status


@dataclass(frozen=True)
class Drift:
    key: IndicatorKey
    direction: Literal["low", "high"]
    days_out: int
    latest: float
    z: float
    start: date
    end: date


def detect_drift(
    points: list[DailyPoint], baseline: Baseline, as_of: date, key: IndicatorKey
) -> Drift | None:
    """Drift in the last DRIFT_WINDOW days up to and including `as_of`, else None."""
    if baseline.status != "ready" or baseline.band is None:
        return None
    band = baseline.band
    first = as_of - timedelta(days=DRIFT_WINDOW - 1)
    recent = sorted((p for p in points if first <= p.day <= as_of), key=lambda p: p.day)
    out = [p for p in recent if p.value < band.low or p.value > band.high]
    if len(out) < DRIFT_DAYS:
        return None
    directions = {"low" if p.value < band.low else "high" for p in out}
    if len(directions) != 1:
        return None

    latest = recent[-1].value
    sd = (band.high - band.mean) / BAND_K
    return Drift(
        key=key,
        direction=directions.pop(),  # type: ignore[arg-type]
        days_out=len(out),
        latest=latest,
        z=(latest - band.mean) / sd,
        start=out[0].day,
        end=out[-1].day,
    )


def status_for(value: float | None, baseline: Baseline, earth: Band | None) -> Status:
    """Card status from the personal baseline. `earth` is reference only and is ignored."""
    if value is None:
        return "unavailable"
    if baseline.status != "ready" or baseline.band is None:
        return "learning"
    if baseline.band.low <= value <= baseline.band.high:
        return "in_range"
    return "worth_checking"
