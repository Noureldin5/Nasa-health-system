"""Simulated ground link: what one sync carries, as a pure function (D6).

Up: the astronaut's record since the last sync (check-ins, readings, alerts, queued briefs).
Down: what ground wrote (replies, notes, flags, measurement requests). Every sync, even an empty
one, becomes one entry in the sync log the astronaut can read.
"""

from __future__ import annotations

from datetime import datetime

from schemas import Alert, Brief, GroundNote, Reply, SyncRecord


def plan_sync(
    sync_id: str,
    now: datetime,
    checkins: int,
    readings: int,
    alerts: list[Alert],
    briefs: list[Brief],
    replies: list[Reply],
    notes: list[GroundNote],
) -> SyncRecord:
    return SyncRecord(
        id=sync_id,
        at=now,
        up={
            "checkins": checkins,
            "readings": readings,
            "alerts": len(alerts),
            "briefs": len(briefs),
        },
        down={"replies": len(replies), "notes": len(notes)},
        item_ids=[x.id for x in (*alerts, *briefs, *replies, *notes)],
    )
