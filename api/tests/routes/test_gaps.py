"""Endpoints the web app asked for (web/README.md, "Gaps for backend")."""

from datetime import datetime


def test_timestamps_carry_a_utc_marker(client):
    rows = client.get("/crew").json()
    assert all(r["last_sync_at"].endswith("Z") for r in rows if r["last_sync_at"])
    view = client.get("/astronaut/a1/view").json()
    assert view["as_of"] == "2026-11-14T09:00:00Z"


def test_crew_rows_have_module_and_role(client):
    rows = {r["crew_id"]: r for r in client.get("/crew").json()}
    assert rows["a1"]["module"] == "node1" and rows["a3"]["module"] == "lab"
    assert rows["a1"]["role"]


def test_mission_day_matches_the_seed(client):
    m = client.get("/mission").json()
    assert m["day"] == 10
    assert m["now"] == "2026-11-14T09:00:00Z"
    assert m["mission_start"] == "2026-11-04T18:00:00Z"  # day 1 began 9 mission days ago


def test_mission_day_rolls_over_at_1800_utc(client, clock):
    clock.set(datetime(2026, 11, 14, 18, 0))
    assert client.get("/mission").json()["day"] == 11


def test_measurements_need_no_checkin_and_change_the_series(client):
    before = client.get("/astronaut/a1/series/glucose").json()["points"]
    r = client.post("/astronaut/a1/measurements", json={"glucose": 95, "heart_rate": 64})
    assert r.status_code == 201
    after = client.get("/astronaut/a1/series/glucose").json()["points"]
    assert len(after) == len(before) + 1 and after[-1]["value"] == 95


def test_measurements_reject_empty_and_unknown_crew(client):
    assert client.post("/astronaut/a1/measurements", json={}).status_code == 422
    assert client.post("/astronaut/zz/measurements", json={"glucose": 95}).status_code == 404


def test_link_status_lists_what_waits_and_matches_the_next_sync(client, clock):
    clock.set(datetime(2026, 11, 14, 9, 5))  # the demo reset already synced at 09:00
    client.post("/astronaut/a1/checkin", json={"mood": 3})
    status = client.get("/link").json()
    assert status["pending_up"]["checkins"] >= 1
    synced = client.post("/link/sync").json()
    assert synced["up"] == status["pending_up"]
    after = client.get("/link").json()
    assert after["pending_up"]["checkins"] == 0
    assert after["last_sync_at"] == synced["at"]
    assert after["next_window_at"] > after["last_sync_at"]


def test_advance_moves_one_day_keeps_records_and_closes_cleared_alert(client):
    client.post("/demo/reset?day=10")
    client.post("/astronaut/a1/checkin", json={"headache": "moderate", "mood": 3})
    opened = client.get("/astronaut/a1/view").json()["alert"]
    assert opened is not None
    mission = None
    for _ in range(3):  # a few more days of the story, with a good morning check-in each day
        r = client.post("/demo/advance")
        assert r.status_code == 200
        mission = r.json()
        client.post("/astronaut/a1/checkin", json={"headache": "none", "mood": 4})
    assert mission["day"] == 13
    view = client.get("/astronaut/a1/view").json()
    assert view["alert"] is None
    assert any(c["answers"]["headache"] == "moderate" for c in view["checkins"])  # record stays


def test_advance_stops_at_the_last_mission_day(client):
    client.post("/demo/reset?day=14")
    assert client.post("/demo/advance").status_code == 409
