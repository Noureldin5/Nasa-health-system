from datetime import date, datetime

from link.sync import plan_sync
from schemas import Alert, Brief, GroundNote, ItemRef, Reply

NOW = datetime(2026, 11, 14, 9, 10)
T = datetime(2026, 11, 14, 9, 5)


def alert(id):
    return Alert(
        id=id,
        crew_id="a1",
        indicator="headache",
        what_changed="x",
        next_step="y",
        contact_if="Contact the flight surgeon if z",
        related_items=[ItemRef(indicator="co2", start=date(2026, 11, 14), end=date(2026, 11, 14))],
        severity=0.9,
        state="open",
        opened_at=T,
    )


def brief(id):
    return Brief(id=id, crew_id="a1", question="q", pinned_items=[], state="queued", created_at=T)


def test_counts_and_item_ids_for_both_directions():
    rec = plan_sync(
        "sy1",
        NOW,
        checkins=2,
        readings=14,
        alerts=[alert("al1")],
        briefs=[brief("b1")],
        replies=[Reply(id="r1", brief_id="b1", author="Dr. Ruiz", text="ok", created_at=T)],
        notes=[
            GroundNote(
                id="n1", crew_id="a1", kind="note", text="t", author="Dr. Ruiz", created_at=T
            )
        ],
    )
    assert rec.id == "sy1" and rec.at == NOW
    assert rec.up == {"checkins": 2, "readings": 14, "alerts": 1, "briefs": 1}
    assert rec.down == {"replies": 1, "notes": 1}
    assert rec.item_ids == ["al1", "b1", "r1", "n1"]


def test_empty_sync_has_zero_counts_and_no_ids():
    rec = plan_sync("sy2", NOW, checkins=0, readings=0, alerts=[], briefs=[], replies=[], notes=[])
    assert rec.up == {"checkins": 0, "readings": 0, "alerts": 0, "briefs": 0}
    assert rec.down == {"replies": 0, "notes": 0}
    assert rec.item_ids == []
