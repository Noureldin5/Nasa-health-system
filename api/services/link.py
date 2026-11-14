"""Run one simulated ground link: collect what is pending, deliver it, log it."""

from __future__ import annotations

from datetime import datetime, timedelta

from domain.days import mission_date
from domain.views import INDICATOR_ORDER
from link.sync import plan_sync
from metrics.port import MetricsUnavailable
from schemas import LinkStatus, SyncRecord
from services.record import LOOKBACK_DAYS, Services
from store.repo import new_id


def _after(t: datetime, since: datetime | None, now: datetime) -> bool:
    return (since is None or t > since) and t <= now


LINK_WINDOW = timedelta(minutes=90)  # Demo parameter: the simulated link opens this often.


def _collect(s: Services, now: datetime):
    """What the next sync would carry. Reads only."""
    since = s.repo.last_sync_at()
    first_day = mission_date(since) if since else mission_date(now) - timedelta(days=14)

    checkins = 0
    readings = 0
    alerts = []
    for c in s.repo.crew():
        crew_id = c["id"]
        entries = s.repo.checkin_entries(crew_id, first_day, mission_date(now))
        checkins += sum(1 for e in entries if _after(e.at, since, now))
        alerts += [a for a in s.repo.alerts(crew_id) if _after(a.opened_at, since, now)]
        try:
            window_start = since or now - timedelta(days=LOOKBACK_DAYS)
            for key in INDICATOR_ORDER:
                pts = s.metrics.series(crew_id, key, window_start, now)
                readings += sum(1 for p in pts if _after(p.at, since, now))
        except MetricsUnavailable:
            pass  # the log says 0 readings; text records still sync

    briefs = [b for b in s.repo.queued_briefs() if b.created_at <= now]
    replies, notes = s.repo.undelivered_down()
    return checkins, readings, alerts, briefs, replies, notes


def link_status(s: Services) -> LinkStatus:
    now = s.clock.now()
    since = s.repo.last_sync_at()
    planned = plan_sync("pending", now, *_collect(s, now))
    return LinkStatus(
        last_sync_at=since,
        next_window_at=max(now, since + LINK_WINDOW) if since else now,
        pending_up=planned.up,
        pending_down=planned.down,
    )


def do_sync(s: Services) -> SyncRecord:
    now = s.clock.now()
    checkins, readings, alerts, briefs, replies, notes = _collect(s, now)
    record = plan_sync(new_id("sy"), now, checkins, readings, alerts, briefs, replies, notes)
    s.repo.mark_sent([b.id for b in briefs], now)
    s.repo.mark_delivered([x.id for x in (*replies, *notes)], now)
    s.repo.append_sync(record)
    return record
