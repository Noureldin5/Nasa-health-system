"""Repository over SQLite. One class, plain SQL, typed records from `schemas`.

No clock here: callers pass every timestamp in.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import date, datetime

from schemas import Alert, Brief, CheckinEntry, CheckinIn, GroundNote, ItemRef, Reply, SyncRecord


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _items(raw: str) -> list[ItemRef]:
    return [ItemRef.model_validate(i) for i in json.loads(raw)]


def _dump_items(items: list[ItemRef]) -> str:
    return json.dumps([i.model_dump(mode="json") for i in items])


class Repo:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn
        self.conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()

    def _run(self, sql: str, params: tuple = ()) -> None:
        with self._lock, self.conn:
            self.conn.execute(sql, params)

    def _all(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self.conn.execute(sql, params).fetchall()

    # crew
    def crew(self) -> list[dict]:
        return [dict(r) for r in self._all("SELECT id, name, module FROM crew ORDER BY id")]

    # check-ins
    def upsert_checkin(self, crew_id: str, day: date, data: CheckinIn, at: datetime) -> None:
        self._run(
            "INSERT INTO checkins (crew_id, day, data, created_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(crew_id, day) DO UPDATE SET data = excluded.data, "
            "created_at = excluded.created_at",
            (crew_id, day.isoformat(), data.model_dump_json(), at.isoformat()),
        )

    def get_checkins(self, crew_id: str, start: date, end: date) -> list[tuple[date, CheckinIn]]:
        rows = self._all(
            "SELECT day, data FROM checkins WHERE crew_id = ? AND day BETWEEN ? AND ? ORDER BY day",
            (crew_id, start.isoformat(), end.isoformat()),
        )
        return [
            (date.fromisoformat(r["day"]), CheckinIn.model_validate_json(r["data"])) for r in rows
        ]

    def checkin_entries(self, crew_id: str, start: date, end: date) -> list[CheckinEntry]:
        rows = self._all(
            "SELECT day, data, created_at FROM checkins WHERE crew_id = ? "
            "AND day BETWEEN ? AND ? ORDER BY day",
            (crew_id, start.isoformat(), end.isoformat()),
        )
        return [
            CheckinEntry(
                day=date.fromisoformat(r["day"]),
                at=datetime.fromisoformat(r["created_at"]),
                answers=CheckinIn.model_validate_json(r["data"]),
            )
            for r in rows
        ]

    # alerts
    def save_alert(self, a: Alert) -> None:
        self._run(
            "INSERT OR REPLACE INTO alerts (id, crew_id, indicator, what_changed, next_step, "
            "contact_if, related_items, severity, state, opened_at, closed_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                a.id,
                a.crew_id,
                a.indicator,
                a.what_changed,
                a.next_step,
                a.contact_if,
                _dump_items(a.related_items),
                a.severity,
                a.state,
                a.opened_at.isoformat(),
                _iso(a.closed_at),
            ),
        )

    @staticmethod
    def _alert(r: sqlite3.Row) -> Alert:
        return Alert(
            id=r["id"],
            crew_id=r["crew_id"],
            indicator=r["indicator"],
            what_changed=r["what_changed"],
            next_step=r["next_step"],
            contact_if=r["contact_if"],
            related_items=_items(r["related_items"]),
            severity=r["severity"],
            state=r["state"],
            opened_at=_dt(r["opened_at"]),
            closed_at=_dt(r["closed_at"]),
        )

    def get_alert(self, alert_id: str) -> Alert | None:
        rows = self._all("SELECT * FROM alerts WHERE id = ?", (alert_id,))
        return self._alert(rows[0]) if rows else None

    def alerts(self, crew_id: str) -> list[Alert]:
        rows = self._all("SELECT * FROM alerts WHERE crew_id = ? ORDER BY opened_at", (crew_id,))
        return [self._alert(r) for r in rows]

    def open_alerts(self, crew_id: str) -> list[Alert]:
        return [a for a in self.alerts(crew_id) if a.state == "open"]

    def close_alert(self, alert_id: str, at: datetime) -> Alert | None:
        self._run(
            "UPDATE alerts SET state = 'closed', closed_at = ? WHERE id = ?",
            (at.isoformat(), alert_id),
        )
        return self.get_alert(alert_id)

    # briefs and replies
    def create_brief(self, b: Brief) -> None:
        self._run(
            "INSERT INTO briefs (id, crew_id, alert_id, question, pinned_items, state, "
            "created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                b.id,
                b.crew_id,
                b.alert_id,
                b.question,
                _dump_items(b.pinned_items),
                b.state,
                b.created_at.isoformat(),
                _iso(b.sent_at),
            ),
        )

    @staticmethod
    def _brief(r: sqlite3.Row) -> Brief:
        return Brief(
            id=r["id"],
            crew_id=r["crew_id"],
            alert_id=r["alert_id"],
            question=r["question"],
            pinned_items=_items(r["pinned_items"]),
            state=r["state"],
            created_at=_dt(r["created_at"]),
            sent_at=_dt(r["sent_at"]),
        )

    def get_brief(self, brief_id: str) -> Brief | None:
        rows = self._all("SELECT * FROM briefs WHERE id = ?", (brief_id,))
        return self._brief(rows[0]) if rows else None

    def briefs(self, crew_id: str) -> list[Brief]:
        rows = self._all("SELECT * FROM briefs WHERE crew_id = ? ORDER BY created_at", (crew_id,))
        return [self._brief(r) for r in rows]

    def all_briefs(self) -> list[Brief]:
        return [self._brief(r) for r in self._all("SELECT * FROM briefs ORDER BY created_at")]

    def queued_briefs(self) -> list[Brief]:
        rows = self._all("SELECT * FROM briefs WHERE state = 'queued' ORDER BY created_at")
        return [self._brief(r) for r in rows]

    def mark_sent(self, brief_ids: list[str], at: datetime) -> None:
        for bid in brief_ids:
            self._run(
                "UPDATE briefs SET state = 'sent', sent_at = ? WHERE id = ? AND state = 'queued'",
                (at.isoformat(), bid),
            )

    def set_brief_state(self, brief_id: str, state: str) -> None:
        self._run("UPDATE briefs SET state = ? WHERE id = ?", (state, brief_id))

    def add_reply(self, r: Reply) -> None:
        self._run(
            "INSERT INTO replies (id, brief_id, author, text, created_at, delivered_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (r.id, r.brief_id, r.author, r.text, r.created_at.isoformat(), _iso(r.delivered_at)),
        )

    @staticmethod
    def _reply(r: sqlite3.Row) -> Reply:
        return Reply(
            id=r["id"],
            brief_id=r["brief_id"],
            author=r["author"],
            text=r["text"],
            created_at=_dt(r["created_at"]),
            delivered_at=_dt(r["delivered_at"]),
        )

    def replies(self, crew_id: str) -> list[Reply]:
        rows = self._all(
            "SELECT r.* FROM replies r JOIN briefs b ON b.id = r.brief_id "
            "WHERE b.crew_id = ? ORDER BY r.created_at",
            (crew_id,),
        )
        return [self._reply(r) for r in rows]

    # ground notes
    def add_note(self, n: GroundNote) -> None:
        self._run(
            "INSERT INTO ground_notes (id, crew_id, kind, target, text, reason, author, "
            "created_at, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                n.id,
                n.crew_id,
                n.kind,
                n.target,
                n.text,
                n.reason,
                n.author,
                n.created_at.isoformat(),
                _iso(n.delivered_at),
            ),
        )

    @staticmethod
    def _note(r: sqlite3.Row) -> GroundNote:
        return GroundNote(
            id=r["id"],
            crew_id=r["crew_id"],
            kind=r["kind"],
            target=r["target"],
            text=r["text"],
            reason=r["reason"],
            author=r["author"],
            created_at=_dt(r["created_at"]),
            delivered_at=_dt(r["delivered_at"]),
        )

    def notes(self, crew_id: str) -> list[GroundNote]:
        rows = self._all(
            "SELECT * FROM ground_notes WHERE crew_id = ? ORDER BY created_at", (crew_id,)
        )
        return [self._note(r) for r in rows]

    def undelivered_down(self) -> tuple[list[Reply], list[GroundNote]]:
        replies = self._all("SELECT * FROM replies WHERE delivered_at IS NULL ORDER BY created_at")
        notes = self._all(
            "SELECT * FROM ground_notes WHERE delivered_at IS NULL ORDER BY created_at"
        )
        return [self._reply(r) for r in replies], [self._note(r) for r in notes]

    def mark_delivered(self, ids: list[str], at: datetime) -> None:
        for item_id in ids:
            self._run("UPDATE replies SET delivered_at = ? WHERE id = ?", (at.isoformat(), item_id))
            self._run(
                "UPDATE ground_notes SET delivered_at = ? WHERE id = ?", (at.isoformat(), item_id)
            )

    # sync log
    def append_sync(self, s: SyncRecord) -> None:
        with self._lock, self.conn:
            self.conn.execute(
                "INSERT INTO sync_log (id, at, up, down, item_ids) VALUES (?, ?, ?, ?, ?)",
                (
                    s.id,
                    s.at.isoformat(),
                    json.dumps(s.up),
                    json.dumps(s.down),
                    json.dumps(s.item_ids),
                ),
            )
            self.conn.execute(
                "UPDATE link_state SET last_sync_at = ? WHERE id = 1", (s.at.isoformat(),)
            )

    def sync_log(self) -> list[SyncRecord]:
        rows = self._all("SELECT * FROM sync_log ORDER BY at DESC, rowid DESC")
        return [
            SyncRecord(
                id=r["id"],
                at=_dt(r["at"]),
                up=json.loads(r["up"]),
                down=json.loads(r["down"]),
                item_ids=json.loads(r["item_ids"]),
            )
            for r in rows
        ]

    def last_sync_at(self) -> datetime | None:
        rows = self._all("SELECT last_sync_at FROM link_state WHERE id = 1")
        return _dt(rows[0]["last_sync_at"]) if rows else None

    def reset(self) -> None:
        with self._lock, self.conn:
            for table in (
                "replies",
                "ground_notes",
                "briefs",
                "alerts",
                "checkins",
                "sync_log",
            ):
                self.conn.execute(f"DELETE FROM {table}")
            self.conn.execute("UPDATE link_state SET last_sync_at = NULL WHERE id = 1")
