"""Alerts: what changed, one next step, when to contact the flight surgeon (M5, U1, U4, U9).

Pure functions. No I/O, no clock: `now` and `as_of` are passed in.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from domain import copy
from domain.baseline import Baseline, DailyPoint
from domain.drift import Drift
from domain.params import (
    ALERT_CLOSE_DAYS,
    CALIBRATION_DAYS,
    DRIFT_WINDOW,
    HEADACHE_DAYS,
    UNITS,
)
from schemas import Alert, Indicator, IndicatorKey, ItemRef, Readout


@dataclass(frozen=True)
class HeadachePattern:
    days: list[date]
    co2_above_usual_days: list[date]


@dataclass(frozen=True)
class AlertDraft:
    crew_id: str
    indicator: IndicatorKey
    what_changed: str
    next_step: str
    contact_if: str
    related_items: list[ItemRef]
    severity: float
    opened_at: datetime


def detect_headache_pattern(
    headache_points: list[DailyPoint],
    co2_points: list[DailyPoint],
    co2_baseline: Baseline,
    as_of: date,
) -> HeadachePattern | None:
    """Mild or stronger headache (value 1 to 3) on HEADACHE_DAYS of the last 3 days."""
    first = as_of - timedelta(days=DRIFT_WINDOW - 1)
    days = sorted(p.day for p in headache_points if first <= p.day <= as_of and p.value >= 1)
    if len(days) < HEADACHE_DAYS:
        return None
    co2_days: list[date] = []
    if co2_baseline.status == "ready" and co2_baseline.band is not None:
        high = co2_baseline.band.high
        co2_days = sorted(p.day for p in co2_points if first <= p.day <= as_of and p.value > high)
    return HeadachePattern(days=days, co2_above_usual_days=co2_days)


def build_alert(signal: Drift | HeadachePattern, crew_id: str, now: datetime) -> AlertDraft:
    if isinstance(signal, HeadachePattern):
        return _headache_alert(signal, crew_id, now)
    return _drift_alert(signal, crew_id, now)


def _headache_alert(p: HeadachePattern, crew_id: str, now: datetime) -> AlertDraft:
    with_co2 = bool(p.co2_above_usual_days)
    items = [ItemRef(indicator="headache", start=min(p.days), end=max(p.days))]
    if with_co2:
        items.append(
            ItemRef(
                indicator="co2", start=min(p.co2_above_usual_days), end=max(p.co2_above_usual_days)
            )
        )
    template = copy.HEADACHE_WITH_CO2 if with_co2 else copy.HEADACHE_ALONE
    return AlertDraft(
        crew_id=crew_id,
        indicator="headache",
        what_changed=template.format(n=len(p.days)),
        next_step=copy.HEADACHE_STEP_WITH_CO2 if with_co2 else copy.DRIFT_NEXT_STEP["headache"],
        contact_if=copy.HEADACHE_CONTACT,
        related_items=items,
        # Demo parameter: a headache pattern ranks above a typical drift.
        severity=0.9 if with_co2 else 0.7,
        opened_at=now,
    )


def _drift_alert(d: Drift, crew_id: str, now: datetime) -> AlertDraft:
    what = copy.DRIFT_CHANGED.format(
        label=copy.LABELS[d.key],
        direction="lower" if d.direction == "low" else "higher",
        days=d.days_out,
        latest=round(d.latest, 1),
        unit=UNITS[d.key],
    )
    return AlertDraft(
        crew_id=crew_id,
        indicator=d.key,
        what_changed=what,
        next_step=copy.DRIFT_NEXT_STEP[d.key],
        contact_if=copy.DRIFT_CONTACT,
        related_items=[ItemRef(indicator=d.key, start=d.start, end=d.end)],
        # Demo parameter: severity grows with distance from the personal band, capped at 1.
        severity=min(abs(d.z) / 4.0, 1.0),
        opened_at=now,
    )


def select_daily(
    drafts: list[AlertDraft], already_shown_today: bool
) -> tuple[AlertDraft | None, list[AlertDraft]]:
    """At most one alert per day (U4). The rest wait in "Worth checking"."""
    ranked = sorted(drafts, key=lambda d: d.severity, reverse=True)
    if already_shown_today or not ranked:
        return None, ranked
    return ranked[0], ranked[1:]


def should_close(
    alert: Alert, points_since_open: list[DailyPoint], baseline: Baseline, as_of: date
) -> bool:
    """Close after ALERT_CLOSE_DAYS days in a row back to normal (U9)."""
    by_day = {p.day: p.value for p in points_since_open}
    for i in range(ALERT_CLOSE_DAYS):
        value = by_day.get(as_of - timedelta(days=i))
        if value is None:
            return False
        if alert.indicator == "headache":
            normal = value < 1
        elif baseline.status == "ready" and baseline.band is not None:
            normal = baseline.band.low <= value <= baseline.band.high
        else:
            normal = False
        if not normal:
            return False
    return True


def build_readout(indicators: list[Indicator], shown: Alert | None, worth: list[Alert]) -> Readout:
    total = (1 if shown else 0) + len(worth)
    if total:
        headline = (
            copy.HEADLINE_WORTH_ONE if total == 1 else copy.HEADLINE_WORTH_MANY.format(n=total)
        )
        lead = shown or worth[0]
        return Readout(overall="worth_checking", headline=headline, tip=lead.next_step, alert=shown)

    active = [i for i in indicators if i.status != "unavailable"]
    if not active:
        return Readout(
            overall="unavailable", headline=copy.HEADLINE_UNAVAILABLE, tip=copy.TIP_UNAVAILABLE
        )
    if all(i.status == "learning" for i in active):
        day = min(i.calibration_day or 0 for i in active)
        return Readout(
            overall="learning",
            headline=copy.HEADLINE_LEARNING.format(day=day, total=CALIBRATION_DAYS),
            tip=copy.TIP_LEARNING.format(total=CALIBRATION_DAYS),
        )
    return Readout(overall="in_range", headline=copy.HEADLINE_ALL_USUAL, tip=copy.TIP_USUAL)
