"""Orchestration: load a record, evaluate alerts, save check-ins, build views.

`evaluate` is the single place that turns data into alerts. It runs after a check-in and on demo
reset. GET endpoints never evaluate, so reading cannot create or close alerts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from clock import Clock
from domain.alerts import (
    build_alert,
    build_readout,
    detect_headache_pattern,
    select_daily,
    should_close,
)
from domain.baseline import compute_baseline
from domain.drift import detect_drift
from domain.views import INDICATOR_ORDER, Record, Side, build_view, daily_points
from metrics.port import MetricsPort, MetricsUnavailable
from schemas import (
    Alert,
    CheckinIn,
    CrewRow,
    IndicatorKey,
    Readout,
    RecordView,
    Series,
    SyncRecord,
)
from settings import Settings
from store.repo import Repo, new_id

# Baseline window (14 days) plus slack for the held-out days.
LOOKBACK_DAYS = 21
HEADACHE_LEVEL = {"none": 0, "mild": 1, "moderate": 2, "strong": 3}
# Answers a "Same as yesterday" check-in copies. Weekly measurements are never copied.
COPIED_FIELDS = ("rested", "headache", "mood", "vision_change")


class CrewNotFound(Exception):
    pass


@dataclass
class Services:
    repo: Repo
    metrics: MetricsPort
    clock: Clock
    settings: Settings


def require_crew(s: Services, crew_id: str) -> dict:
    for c in s.repo.crew():
        if c["id"] == crew_id:
            return c
    raise CrewNotFound(crew_id)


def load_record(s: Services, crew_id: str, now: datetime) -> Record:
    start = now - timedelta(days=LOOKBACK_DAYS)
    series: dict[IndicatorKey, list] = {}
    available = True
    try:
        for key in INDICATOR_ORDER:
            series[key] = s.metrics.series(crew_id, key, start, now)
    except MetricsUnavailable:
        series, available = {}, False
    return Record(
        crew_id=crew_id,
        series=series,
        alerts=s.repo.alerts(crew_id),
        briefs=s.repo.briefs(crew_id),
        replies=s.repo.replies(crew_id),
        notes=s.repo.notes(crew_id),
        last_sync_at=s.repo.last_sync_at(),
        metrics_available=available,
        checkins=s.repo.checkin_entries(crew_id, now.date() - timedelta(days=14), now.date()),
    )


def view(s: Services, crew_id: str, side: Side) -> RecordView:
    require_crew(s, crew_id)
    now = s.clock.now()
    return build_view(load_record(s, crew_id, now), side, now)


def readout(s: Services, crew_id: str) -> Readout:
    v = view(s, crew_id, "station")
    return build_readout(v.indicators, v.alert, v.worth_checking)


def series(s: Services, crew_id: str, key: IndicatorKey, days: int) -> Series:
    require_crew(s, crew_id)
    now = s.clock.now()
    points = s.metrics.series(crew_id, key, now - timedelta(days=days), now)
    return Series(crew_id=crew_id, key=key, points=points)


def crew_rows(s: Services) -> list[CrewRow]:
    rows = []
    for c in s.repo.crew():
        v = view(s, c["id"], "ground")
        out = build_readout(v.indicators, v.alert, v.worth_checking)
        rows.append(
            CrewRow(
                crew_id=c["id"],
                name=c["name"],
                status=out.overall,
                open_alerts=(1 if v.alert else 0) + len(v.worth_checking),
                unanswered_briefs=sum(1 for b in v.briefs if b.state != "answered"),
                last_sync_at=v.last_sync_at,
            )
        )
    return rows


def evaluate(s: Services, crew_id: str, now: datetime) -> None:
    """Close alerts that cleared, then raise alerts for new drift or headache patterns."""
    rec = load_record(s, crew_id, now)
    if not rec.metrics_available:
        return
    as_of = now.date()
    daily = {key: daily_points(pts) for key, pts in rec.series.items()}
    baselines = {key: compute_baseline(daily[key], as_of, key) for key in INDICATOR_ORDER}

    for a in s.repo.open_alerts(crew_id):
        since = [p for p in daily[a.indicator] if p.day >= a.opened_at.date()]
        if should_close(a, since, baselines[a.indicator], as_of):
            s.repo.close_alert(a.id, now)

    signals: list = []
    for key in INDICATOR_ORDER:
        if key in ("headache", "co2"):
            continue
        drift = detect_drift(daily[key], baselines[key], as_of, key)
        if drift:
            signals.append(drift)
    pattern = detect_headache_pattern(daily["headache"], daily["co2"], baselines["co2"], as_of)
    if pattern:
        signals.append(pattern)

    open_now = s.repo.open_alerts(crew_id)
    already_open = {a.indicator for a in open_now}
    drafts = [build_alert(sig, crew_id, now) for sig in signals]
    drafts = [d for d in drafts if d.indicator not in already_open]
    shown_today = any(a.opened_at.date() == as_of for a in open_now)
    shown, worth = select_daily(drafts, shown_today)
    for d in ([shown] if shown else []) + worth:
        s.repo.save_alert(
            Alert(
                id=new_id("al"),
                crew_id=d.crew_id,
                indicator=d.indicator,
                what_changed=d.what_changed,
                next_step=d.next_step,
                contact_if=d.contact_if,
                related_items=d.related_items,
                severity=d.severity,
                state="open",
                opened_at=d.opened_at,
            )
        )


def submit_checkin(s: Services, crew_id: str, body: CheckinIn, now: datetime) -> Readout:
    require_crew(s, crew_id)
    today = now.date()
    resolved = body
    if body.same_as_yesterday:
        earlier = s.repo.get_checkins(crew_id, today - timedelta(days=7), today - timedelta(days=1))
        if earlier:
            merged = {f: getattr(earlier[-1][1], f) for f in COPIED_FIELDS}
            merged.update(
                {f: getattr(body, f) for f in COPIED_FIELDS if getattr(body, f) is not None}
            )
            resolved = body.model_copy(update=merged)
    s.repo.upsert_checkin(crew_id, today, resolved, now)

    values: dict[IndicatorKey, float] = {}
    if resolved.mood is not None:
        values["mood"] = resolved.mood
    if resolved.headache is not None:
        values["headache"] = HEADACHE_LEVEL[resolved.headache]
    for key in ("bp_systolic", "bp_diastolic", "glucose", "body_temp"):
        value = getattr(resolved, key)
        if value is not None:
            values[key] = value  # type: ignore[index]
    if values:
        try:
            s.metrics.write(crew_id, values, now)
        except MetricsUnavailable:
            pass  # the check-in record is saved; trend charts catch up when the store is back
    evaluate(s, crew_id, now)
    return readout(s, crew_id)


HEADACHE_NAME = {level: name for name, level in HEADACHE_LEVEL.items()}


def _seed_checkins(s: Services, now: datetime, day: int) -> None:
    """One saved check-in per story day, built from the seeded mood and headache readings, so
    "Same as yesterday" works on a fresh demo. Rested 4 is a simulated answer."""
    start = now - timedelta(days=day)
    for c in s.repo.crew():
        moods = s.metrics.series(c["id"], "mood", start, now)
        heads = {p.at.date(): p for p in s.metrics.series(c["id"], "headache", start, now)}
        for p in moods:
            h = heads.get(p.at.date())
            answers = CheckinIn(
                mood=round(p.value),
                headache=HEADACHE_NAME[round(h.value)] if h else None,
                rested=4,
                vision_change=False,
            )
            s.repo.upsert_checkin(c["id"], p.at.date(), answers, p.at)


def reset_demo(s: Services, day: int) -> None:
    """Reseed so real today is mission day `day`, raise alerts the history already earns, and log
    an initial sync so ground has a last sync time."""
    now = s.clock.now()
    s.repo.reset()
    s.metrics.seed(now.date(), day)
    _seed_checkins(s, now, day)
    for c in s.repo.crew():
        evaluate(s, c["id"], now)
    s.repo.append_sync(SyncRecord(id=new_id("sy"), at=now, up={}, down={}, item_ids=[]))
