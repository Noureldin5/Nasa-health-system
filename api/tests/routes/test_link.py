from datetime import datetime


def checkin(client, **body):
    return client.post("/astronaut/a1/checkin", json=body)


def sync(client):
    resp = client.post("/link/sync")
    assert resp.status_code == 200
    return resp.json()


def test_every_sync_is_logged_newest_first(client, clock):
    clock.set(datetime(2026, 11, 14, 9, 10))
    first = sync(client)
    clock.set(datetime(2026, 11, 14, 9, 20))
    second = sync(client)
    log = client.get("/link/log").json()
    assert [r["id"] for r in log][:2] == [second["id"], first["id"]]
    assert len(log) == 3  # the demo reset logged an initial sync
    assert len({r["id"] for r in log}) == 3


def test_empty_sync_still_logged_and_advances_last_sync(client, clock):
    clock.set(datetime(2026, 11, 14, 9, 30))
    rec = sync(client)
    assert rec["up"] == {"checkins": 0, "readings": 0, "alerts": 0, "briefs": 0}
    assert rec["down"] == {"replies": 0, "notes": 0}
    assert client.get("/astronaut/a1/view").json()["last_sync_at"].startswith("2026-11-14T09:30")


def test_log_lists_what_was_sent(client, clock):
    clock.set(datetime(2026, 11, 14, 9, 5))
    checkin(client, headache="moderate", mood=4)
    clock.set(datetime(2026, 11, 14, 9, 10))
    rec = sync(client)
    assert rec["up"]["checkins"] == 1
    assert rec["up"]["alerts"] == 1
    assert rec["up"]["readings"] == 2  # mood and headache written by the check-in
    assert sync(client)["up"]["checkins"] == 0  # nothing is sent twice


def test_ground_view_freezes_at_last_sync(client, clock):
    clock.set(datetime(2026, 11, 14, 9, 5))
    checkin(client, headache="moderate", mood=4, vision_change=True)
    before = client.get("/ground/a1/view").json()
    assert before["alert"] is None
    assert all(c["day"] != "2026-11-14" for c in before["checkins"])
    head = next(i for i in before["indicators"] if i["key"] == "headache")
    assert head["value"] == 1  # yesterday's reading, today's is not on the ground yet
    clock.set(datetime(2026, 11, 14, 9, 10))
    sync(client)
    after = client.get("/ground/a1/view").json()
    assert after["alert"]["indicator"] == "headache"
    assert any(c["day"] == "2026-11-14" for c in after["checkins"])
    assert next(i for i in after["indicators"] if i["key"] == "headache")["value"] == 2


def test_sync_with_metrics_down_still_logs(client, clock, state):
    state.metrics.fail = True
    clock.set(datetime(2026, 11, 14, 9, 30))
    rec = sync(client)
    assert rec["up"]["readings"] == 0
