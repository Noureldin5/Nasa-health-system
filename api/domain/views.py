"""One function builds both sides of the open record (D3, D4).

Visibility rule, by who wrote the item:
- Astronaut-origin (series points, check-ins, alerts, briefs): the ground side sees an item only
  if it existed at `last_sync_at`. The station side sees everything.
- Ground-origin (notes, flags, requests, replies): the ground side sees them at once. The station
  side sees them once `delivered_at` is set, which happens at the next sync.
There are no ground-only fields: both sides return the same `RecordView` shape.

Pure function. No I/O, no clock: `now` is passed in.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from domain.baseline import DailyPoint, compute_baseline
from domain.drift import status_for
from domain.params import UNITS
from schemas import (
    Alert,
    Brief,
    GroundNote,
    Indicator,
    IndicatorKey,
    Point,
    Readiness,
    RecordView,
    Reply,
)

Side = Literal["station", "ground"]

INDICATOR_ORDER: tuple[IndicatorKey, ...] = (
    "bp_systolic",
    "bp_diastolic",
    "heart_rate",
    "glucose",
    "body_temp",
    "sleep_hours",
    "mood",
    "headache",
    "co2",
)


@dataclass
class Record:
    crew_id: str
    series: dict[IndicatorKey, list[Point]]
    alerts: list[Alert]
    briefs: list[Brief]
    replies: list[Reply]
    notes: list[GroundNote]
    last_sync_at: datetime | None
    metrics_available: bool = True
    readiness: Readiness | None = field(default=None)


def daily_points(points: list[Point]) -> list[DailyPoint]:
    """One value per calendar day, the latest reading of that day."""
    by_day: dict = {}
    for p in sorted(points, key=lambda p: p.at):
        by_day[p.at.date()] = p
    return [DailyPoint(day=d, value=p.value, source=p.source) for d, p in sorted(by_day.items())]


def build_view(record: Record, side: Side, now: datetime) -> RecordView:
    ground = side == "ground"
    cutoff = record.last_sync_at if ground else now
    as_of = cutoff if (ground and cutoff is not None) else now

    def astronaut_origin_visible(created: datetime) -> bool:
        return cutoff is not None and created <= cutoff

    def ground_origin_visible(delivered_at: datetime | None) -> bool:
        return True if ground else delivered_at is not None

    replies = [r for r in record.replies if ground_origin_visible(r.delivered_at)]
    notes = [n for n in record.notes if ground_origin_visible(n.delivered_at)]
    answered = {r.brief_id for r in replies}

    briefs = []
    for b in record.briefs:
        if not astronaut_origin_visible(b.created_at):
            continue
        if b.id in answered:
            state = "answered"
        elif b.state == "queued" and ground:
            state = "sent"  # ground only knows a brief once it arrived
        elif b.state == "answered":
            state = "sent"  # reply written on the ground but not delivered yet
        else:
            state = b.state
        briefs.append(b.model_copy(update={"state": state}))

    open_alerts = []
    for a in record.alerts:
        if not astronaut_origin_visible(a.opened_at):
            continue
        if a.closed_at is not None and cutoff is not None and a.closed_at <= cutoff:
            continue  # closed as of this side's picture
        open_alerts.append(a.model_copy(update={"state": "open", "closed_at": None}))
    open_alerts.sort(key=lambda a: (a.opened_at, -a.severity))

    if ground and cutoff is None:
        indicators: list[Indicator] = []
    else:
        indicators = [_indicator(record, key, cutoff, as_of) for key in INDICATOR_ORDER]

    return RecordView(
        crew_id=record.crew_id,
        side=side,
        as_of=as_of,
        indicators=indicators,
        alert=open_alerts[0] if open_alerts else None,
        worth_checking=open_alerts[1:],
        briefs=briefs,
        replies=replies,
        notes=notes,
        readiness=record.readiness,
        last_sync_at=record.last_sync_at,
    )


def _indicator(
    record: Record, key: IndicatorKey, cutoff: datetime | None, as_of: datetime
) -> Indicator:
    if not record.metrics_available:
        return Indicator(key=key, value=None, unit=UNITS[key], status="unavailable", source="sim")
    points = [p for p in record.series.get(key, []) if cutoff is None or p.at <= cutoff]
    daily = daily_points(points)
    baseline = compute_baseline(daily, as_of.date(), key)
    value = daily[-1].value if daily else None
    if value is None:
        status = "learning" if baseline.status == "learning" else "unavailable"
    else:
        status = status_for(value, baseline, None)
    return Indicator(
        key=key,
        value=value,
        unit=UNITS[key],
        status=status,
        baseline=baseline.band,
        calibration_day=baseline.calibration_day if baseline.status == "learning" else None,
        source=daily[-1].source if daily else "sim",  # type: ignore[arg-type]
    )
