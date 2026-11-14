from datetime import date, datetime, timedelta

from domain.views import Record, build_view, daily_points
from schemas import Alert, Brief, GroundNote, ItemRef, Point, Reply

SYNC = datetime(2026, 11, 14, 8, 0)
NOW = datetime(2026, 11, 14, 9, 0)
BEFORE = SYNC - timedelta(hours=1)
AFTER = SYNC + timedelta(minutes=30)
DAY = date(2026, 11, 14)


def hr_series(n=10, end=NOW):
    """n daily heart-rate points at 07:30, one per day, the last one on `end`'s day."""
    pts = []
    for i in range(n):
        day = end.date() - timedelta(days=n - 1 - i)
        pts.append(
            Point(
                at=datetime.combine(day, datetime.min.time()) + timedelta(hours=7, minutes=30),
                value=60.0 + (i % 3),
                source="sim",
            )
        )
    return pts


def alert(id="al1", opened=BEFORE, closed=None, severity=0.9, indicator="headache"):
    return Alert(
        id=id,
        crew_id="a1",
        indicator=indicator,
        what_changed="Headaches on 2 of the last 3 days.",
        next_step="Ask for a ventilation check.",
        contact_if="Contact the flight surgeon if the headache is strong.",
        related_items=[ItemRef(indicator="co2", start=DAY, end=DAY)],
        severity=severity,
        state="closed" if closed else "open",
        opened_at=opened,
        closed_at=closed,
    )


def brief(id="b1", created=BEFORE, state="sent"):
    return Brief(
        id=id,
        crew_id="a1",
        question="Should I change anything?",
        pinned_items=[],
        state=state,
        created_at=created,
    )


def note(id="n1", delivered=None):
    return GroundNote(
        id=id,
        crew_id="a1",
        kind="note",
        text="Expected after the schedule shift.",
        author="Dr. Ruiz",
        created_at=BEFORE,
        delivered_at=delivered,
    )


def reply(id="r1", delivered=None):
    return Reply(
        id=id,
        brief_id="b1",
        author="Dr. Ruiz",
        text="Watch it.",
        created_at=BEFORE,
        delivered_at=delivered,
    )


def record(**kw):
    base = {
        "crew_id": "a1",
        "series": {"heart_rate": hr_series()},
        "alerts": [],
        "briefs": [],
        "replies": [],
        "notes": [],
        "last_sync_at": SYNC,
    }
    base.update(kw)
    return Record(**base)


def test_daily_points_keeps_last_value_per_day():
    d = DAY
    pts = [
        Point(at=datetime(2026, 11, 14, 7, 0), value=1.0, source="sim"),
        Point(at=datetime(2026, 11, 14, 9, 0), value=3.0, source="sim"),
        Point(at=datetime(2026, 11, 13, 9, 0), value=2.0, source="sim"),
    ]
    out = daily_points(pts)
    assert [(p.day, p.value) for p in out] == [(d - timedelta(days=1), 2.0), (d, 3.0)]


def test_ground_note_hidden_from_station_until_delivered():
    rec = record(notes=[note()])
    assert [n.id for n in build_view(rec, "ground", NOW).notes] == ["n1"]
    assert build_view(rec, "station", NOW).notes == []
    rec = record(notes=[note(delivered=AFTER)])
    assert [n.id for n in build_view(rec, "station", NOW).notes] == ["n1"]


def test_every_ground_item_visible_to_astronaut_after_delivery():
    rec = record(
        briefs=[brief()],
        notes=[note("n1", AFTER), note("n2", AFTER)],
        replies=[reply("r1", AFTER)],
    )
    ground = build_view(rec, "ground", NOW)
    station = build_view(rec, "station", NOW)
    assert {n.id for n in ground.notes} == {n.id for n in station.notes}
    assert {r.id for r in ground.replies} == {r.id for r in station.replies}


def test_astronaut_items_wait_for_the_next_sync():
    rec = record(
        alerts=[alert("al2", opened=AFTER)], briefs=[brief("b2", created=AFTER, state="queued")]
    )
    ground = build_view(rec, "ground", NOW)
    station = build_view(rec, "station", NOW)
    assert ground.alert is None and ground.briefs == []
    assert station.alert.id == "al2" and [b.id for b in station.briefs] == ["b2"]


def test_alert_closed_after_sync_is_still_open_on_ground():
    rec = record(alerts=[alert(closed=AFTER)])
    ground = build_view(rec, "ground", NOW)
    assert ground.alert is not None and ground.alert.state == "open"
    assert ground.alert.closed_at is None
    assert build_view(rec, "station", NOW).alert is None


def test_ground_view_is_empty_before_first_sync():
    rec = record(last_sync_at=None, alerts=[alert()], briefs=[brief()])
    ground = build_view(rec, "ground", NOW)
    assert ground.indicators == [] and ground.alert is None and ground.briefs == []
    assert ground.last_sync_at is None


def test_view_has_no_role_specific_fields():
    rec = record()
    assert set(build_view(rec, "ground", NOW).model_dump()) == set(
        build_view(rec, "station", NOW).model_dump()
    )


def test_series_after_sync_is_hidden_from_ground():
    series = hr_series() + [Point(at=AFTER, value=99.0, source="sim")]
    rec = record(series={"heart_rate": series})
    hr = lambda v: next(i for i in v.indicators if i.key == "heart_rate")
    assert hr(build_view(rec, "station", NOW)).value == 99.0
    assert hr(build_view(rec, "ground", NOW)).value != 99.0


def test_metrics_unavailable_still_returns_text_records():
    rec = record(
        series={}, metrics_available=False, notes=[note(delivered=AFTER)], alerts=[alert()]
    )
    view = build_view(rec, "station", NOW)
    assert view.indicators and all(i.status == "unavailable" for i in view.indicators)
    assert [n.id for n in view.notes] == ["n1"] and view.alert is not None


def test_brief_is_answered_only_when_the_reply_is_visible():
    rec = record(briefs=[brief(state="answered")], replies=[reply(delivered=None)])
    assert build_view(rec, "ground", NOW).briefs[0].state == "answered"
    assert build_view(rec, "station", NOW).briefs[0].state == "sent"
    rec = record(briefs=[brief(state="answered")], replies=[reply(delivered=AFTER)])
    assert build_view(rec, "station", NOW).briefs[0].state == "answered"


def test_oldest_open_alert_is_shown_the_rest_wait():
    early = alert("old", opened=BEFORE - timedelta(days=1), severity=0.3)
    late = alert("new", opened=BEFORE, severity=0.9)
    view = build_view(record(alerts=[late, early]), "station", NOW)
    assert view.alert.id == "old"
    assert [a.id for a in view.worth_checking] == ["new"]


def test_baseline_is_learning_with_few_days():
    view = build_view(record(series={"heart_rate": hr_series(3)}), "station", NOW)
    hr = next(i for i in view.indicators if i.key == "heart_rate")
    assert hr.status == "learning" and hr.calibration_day is not None
