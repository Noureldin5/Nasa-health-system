from datetime import datetime


def at(clock, hour, minute=0):
    clock.set(datetime(2026, 11, 14, hour, minute))


def note(client, **body):
    body.setdefault("author", "Dr. Ruiz")
    return client.post("/ground/a1/notes", json=body)


def test_note_is_queued_until_the_next_sync(client, clock):
    at(clock, 9, 5)
    resp = note(
        client, kind="note", target="sleep_hours", text="Expected after the schedule shift."
    )
    assert resp.status_code == 201 and resp.json()["delivered_at"] is None
    ground = client.get("/ground/a1/view").json()["notes"]
    assert [n["text"] for n in ground] == ["Expected after the schedule shift."]
    assert client.get("/astronaut/a1/view").json()["notes"] == []
    at(clock, 9, 10)
    assert client.post("/link/sync").json()["down"]["notes"] == 1
    got = client.get("/astronaut/a1/view").json()["notes"][0]
    assert got["text"] == "Expected after the schedule shift."
    assert got["author"] == "Dr. Ruiz" and got["target"] == "sleep_hours"
    assert got["created_at"] == ground[0]["created_at"]


def test_every_ground_item_is_in_the_astronaut_view_after_sync(client, clock):
    at(clock, 9, 5)
    note(client, kind="note", text="Looks expected.")
    note(client, kind="watch_flag", target="sleep_hours", reason="Third short night", text="Watch")
    note(
        client,
        kind="measurement_request",
        target="body_temp",
        reason="Rule out a fever",
        text="Temperature on day 11",
    )
    at(clock, 9, 10)
    client.post("/link/sync")
    ground = client.get("/ground/a1/view").json()["notes"]
    station = client.get("/astronaut/a1/view").json()["notes"]
    assert len(ground) == 3
    assert {n["id"] for n in ground} == {n["id"] for n in station}
    assert {n["kind"] for n in station} == {"note", "watch_flag", "measurement_request"}
    assert {n["reason"] for n in station if n["reason"]} == {
        "Third short night",
        "Rule out a fever",
    }


def test_flags_and_requests_need_a_target_and_a_reason(client):
    assert note(client, kind="measurement_request", target="body_temp", text="t").status_code == 422
    assert note(client, kind="watch_flag", reason="r", text="t").status_code == 422
    assert note(client, kind="note", text="plain note").status_code == 201


def test_note_text_and_author_are_required(client):
    assert note(client, kind="note", text="").status_code == 422
    assert client.post("/ground/a1/notes", json={"kind": "note", "text": "x"}).status_code == 422


def test_note_on_an_unknown_crew_member_is_404(client):
    resp = client.post("/ground/zz/notes", json={"kind": "note", "text": "x", "author": "a"})
    assert resp.status_code == 404
