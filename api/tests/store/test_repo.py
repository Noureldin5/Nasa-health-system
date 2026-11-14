import sqlite3
from datetime import date, datetime

import pytest

from schemas import Alert, Brief, CheckinIn, GroundNote, ItemRef, Reply, SyncRecord
from store.db import connect
from store.repo import Repo

T0 = datetime(2026, 11, 14, 8, 0)
T1 = datetime(2026, 11, 14, 9, 0)
DAY = date(2026, 11, 14)


@pytest.fixture
def repo():
    return Repo(connect(":memory:"))


def alert(id="al1", crew="a1", state="open"):
    return Alert(
        id=id,
        crew_id=crew,
        indicator="headache",
        what_changed="Headaches on 2 of the last 3 days.",
        next_step="Ask for a ventilation check.",
        contact_if="Contact the flight surgeon if the headache is strong.",
        related_items=[ItemRef(indicator="co2", start=DAY, end=DAY)],
        severity=0.9,
        state=state,
        opened_at=T0,
    )


def brief(id="b1", crew="a1", alert_id=None):
    return Brief(
        id=id,
        crew_id=crew,
        alert_id=alert_id,
        question="Should I change anything?",
        pinned_items=[ItemRef(indicator="headache", start=DAY, end=DAY)],
        state="queued",
        created_at=T0,
    )


def test_crew_is_seeded(repo):
    assert [c["id"] for c in repo.crew()] == ["a1", "a2", "a3"]


def test_checkin_round_trip(repo):
    repo.upsert_checkin("a1", DAY, CheckinIn(mood=4, headache="mild"), T0)
    rows = repo.get_checkins("a1", DAY, DAY)
    assert rows[0][0] == DAY
    assert rows[0][1].mood == 4


def test_checkin_upsert_same_day_replaces(repo):
    repo.upsert_checkin("a1", DAY, CheckinIn(mood=2), T0)
    repo.upsert_checkin("a1", DAY, CheckinIn(mood=5), T1)
    rows = repo.get_checkins("a1", DAY, DAY)
    assert len(rows) == 1
    assert rows[0][1].mood == 5


def test_alert_round_trip_open_and_close(repo):
    repo.save_alert(alert())
    assert [a.id for a in repo.open_alerts("a1")] == ["al1"]
    assert repo.get_alert("al1").related_items[0].indicator == "co2"
    closed = repo.close_alert("al1", T1)
    assert closed.state == "closed" and closed.closed_at == T1
    assert repo.open_alerts("a1") == []


def test_brief_round_trip_and_queue(repo):
    repo.create_brief(brief())
    assert [b.id for b in repo.queued_briefs()] == ["b1"]
    repo.mark_sent(["b1"], T1)
    got = repo.briefs("a1")[0]
    assert got.state == "sent" and got.sent_at == T1
    assert repo.queued_briefs() == []


def test_reply_requires_existing_brief(repo):
    reply = Reply(id="r1", brief_id="nope", author="Dr. Ruiz", text="ok", created_at=T0)
    with pytest.raises(sqlite3.IntegrityError):
        repo.add_reply(reply)


def test_down_items_undelivered_then_delivered(repo):
    repo.create_brief(brief())
    repo.add_reply(Reply(id="r1", brief_id="b1", author="Dr. Ruiz", text="Watch it", created_at=T0))
    repo.add_note(
        GroundNote(
            id="n1", crew_id="a1", kind="note", text="Expected.", author="Dr. Ruiz", created_at=T0
        )
    )
    replies, notes = repo.undelivered_down()
    assert [r.id for r in replies] == ["r1"] and [n.id for n in notes] == ["n1"]
    repo.mark_delivered(["r1", "n1"], T1)
    assert repo.undelivered_down() == ([], [])
    assert repo.replies("a1")[0].delivered_at == T1
    assert repo.notes("a1")[0].delivered_at == T1


def test_sync_log_newest_first_and_last_sync(repo):
    assert repo.last_sync_at() is None
    repo.append_sync(SyncRecord(id="s1", at=T0, up={"briefs": 1}, down={}, item_ids=["b1"]))
    repo.append_sync(SyncRecord(id="s2", at=T1, up={}, down={}, item_ids=[]))
    assert [s.id for s in repo.sync_log()] == ["s2", "s1"]
    assert repo.last_sync_at() == T1


def test_reset_clears_records_but_keeps_crew(repo):
    repo.save_alert(alert())
    repo.append_sync(SyncRecord(id="s1", at=T0, up={}, down={}, item_ids=[]))
    repo.reset()
    assert repo.open_alerts("a1") == []
    assert repo.sync_log() == [] and repo.last_sync_at() is None
    assert len(repo.crew()) == 3
