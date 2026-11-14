from datetime import datetime

T0 = datetime(2026, 11, 14, 9, 0)


def at(clock, hour, minute=0):
    clock.set(datetime(2026, 11, 14, hour, minute))


def hero(client, clock):
    at(clock, 9, 5)
    return client.post("/astronaut/a1/checkin", json={"headache": "moderate", "mood": 4}).json()


def send_brief(client, alert_id=None, question="Is this something to watch?"):
    body = {"question": question}
    if alert_id:
        body["alert_id"] = alert_id
    return client.post("/astronaut/a1/briefs", json=body)


def sync(client):
    return client.post("/link/sync").json()


def test_draft_pins_the_items_of_the_current_alert(client, clock):
    alert = hero(client, clock)["alert"]
    draft = client.get("/astronaut/a1/briefs/draft").json()
    assert {i["indicator"] for i in draft["pinned_items"]} == {"headache", "co2"}
    assert draft["alert_id"] == alert["id"]
    assert "watch" in draft["question_suggestion"].lower()


def test_draft_without_an_alert_has_no_pins(client):
    draft = client.get("/astronaut/a1/briefs/draft").json()
    assert draft["pinned_items"] == [] and draft["alert_id"] is None
    assert draft["question_suggestion"]


def test_pinned_items_match_the_alert(client, clock):
    alert = hero(client, clock)["alert"]
    resp = send_brief(client, alert["id"])
    assert resp.status_code == 201
    brief = resp.json()
    assert brief["pinned_items"] == alert["related_items"]
    assert brief["state"] == "queued" and brief["alert_id"] == alert["id"]


def test_brief_without_an_alert_has_no_pins_and_needs_a_question(client):
    ok = send_brief(client)
    assert ok.status_code == 201 and ok.json()["pinned_items"] == []
    bad = client.post("/astronaut/a1/briefs", json={"question": ""})
    assert bad.status_code == 422


def test_brief_with_unknown_alert_or_crew_is_404(client):
    assert send_brief(client, "nope").status_code == 404
    assert client.post("/astronaut/zz/briefs", json={"question": "q"}).status_code == 404


def test_brief_is_queued_then_sent_on_sync(client, clock):
    alert = hero(client, clock)["alert"]
    send_brief(client, alert["id"])
    assert client.get("/ground/a1/view").json()["briefs"] == []
    assert client.get("/astronaut/a1/view").json()["briefs"][0]["state"] == "queued"
    at(clock, 9, 10)
    assert sync(client)["up"]["briefs"] == 1
    ground = client.get("/ground/a1/view").json()["briefs"]
    assert ground[0]["state"] == "sent" and ground[0]["pinned_items"]
    assert client.get("/astronaut/a1/view").json()["briefs"][0]["state"] == "sent"


def test_reply_waits_until_the_brief_reached_ground(client, clock):
    brief = send_brief(client).json()
    resp = client.post(f"/briefs/{brief['id']}/reply", json={"author": "Dr. Ruiz", "text": "ok"})
    assert resp.status_code == 409
    assert client.post("/briefs/nope/reply", json={"author": "a", "text": "b"}).status_code == 404


def test_reply_is_linked_and_reaches_the_astronaut_on_the_next_sync(client, clock):
    brief = send_brief(client).json()
    at(clock, 9, 10)
    sync(client)
    at(clock, 9, 20)
    resp = client.post(
        f"/briefs/{brief['id']}/reply", json={"author": "Dr. Ruiz", "text": "Keep an eye on it."}
    )
    assert resp.status_code == 201 and resp.json()["brief_id"] == brief["id"]
    assert resp.json()["delivered_at"] is None
    ground = client.get("/ground/a1/view").json()
    assert [r["text"] for r in ground["replies"]] == ["Keep an eye on it."]
    assert ground["briefs"][0]["state"] == "answered"
    station = client.get("/astronaut/a1/view").json()
    assert station["replies"] == [] and station["briefs"][0]["state"] == "sent"
    at(clock, 9, 30)
    assert sync(client)["down"]["replies"] == 1
    station = client.get("/astronaut/a1/view").json()
    assert station["replies"][0]["author"] == "Dr. Ruiz"
    assert station["replies"][0]["text"] == "Keep an eye on it."
    assert station["briefs"][0]["state"] == "answered"


def test_inbox_is_empty_on_a_normal_day(client):
    assert client.get("/ground/inbox").json() == []


def test_inbox_lists_briefs_before_alerts_and_drops_answered_briefs(client, clock):
    alert = hero(client, clock)["alert"]
    brief = send_brief(client, alert["id"]).json()
    at(clock, 9, 10)
    sync(client)
    inbox = client.get("/ground/inbox").json()
    assert [i["kind"] for i in inbox] == ["brief", "alert"]
    assert inbox[0]["brief"]["id"] == brief["id"] and inbox[0]["brief"]["pinned_items"]
    assert inbox[1]["alert"]["id"] == alert["id"]
    at(clock, 9, 20)
    client.post(f"/briefs/{brief['id']}/reply", json={"author": "Dr. Ruiz", "text": "ok"})
    assert [i["kind"] for i in client.get("/ground/inbox").json()] == ["alert"]
