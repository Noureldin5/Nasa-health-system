from datetime import date, datetime, timedelta

TODAY = date(2026, 11, 14)
START = datetime(2026, 11, 1)


def checkin(client, crew="a1", **body):
    return client.post(f"/astronaut/{crew}/checkin", json=body)


def test_hero_alert_fires_on_seeded_day_10(client):
    resp = checkin(client, headache="moderate", mood=4)
    assert resp.status_code == 201
    out = resp.json()
    assert out["overall"] == "worth_checking"
    assert out["headline"] == "1 thing worth checking"
    alert = out["alert"]
    assert alert["indicator"] == "headache"
    assert {i["indicator"] for i in alert["related_items"]} == {"headache", "co2"}
    assert alert["contact_if"].startswith("Contact the flight surgeon if")
    assert out["disclaimer"] == "Decision support, not a diagnosis."


def test_checkin_without_symptoms_reads_all_in_range(client):
    out = checkin(client, crew="a3", headache="none", mood=4).json()
    assert out["headline"] == "All in your usual range"
    assert out["alert"] is None


def test_card_out_of_band_without_alert_is_not_all_in_range(client):
    # a1's cabin CO2 was high yesterday, but no headache pattern today, so no alert
    out = checkin(client, headache="none", mood=4).json()
    assert out["alert"] is None
    assert out["overall"] == "worth_checking"
    assert out["headline"] == "1 thing worth checking"


def test_same_as_yesterday_on_a_fresh_reset_uses_the_seeded_checkin(client, state):
    resp = checkin(client, same_as_yesterday=True)
    assert resp.status_code == 201
    saved = state.repo.get_checkins("a1", TODAY, TODAY)[0][1]
    assert saved.headache == "mild" and saved.mood == 4 and saved.rested == 4
    # yesterday's mild headache plus today's makes 2 of the last 3 days
    assert resp.json()["alert"]["indicator"] == "headache"
    calm = checkin(client, crew="a3", same_as_yesterday=True).json()
    assert calm["headline"] == "All in your usual range"


def test_checkin_answers_are_in_both_views(client, clock):
    clock.set(datetime(2026, 11, 14, 9, 5))
    checkin(client, mood=3, headache="none", vision_change=True)
    station = client.get("/astronaut/a1/view").json()
    today = next(c for c in station["checkins"] if c["day"] == "2026-11-14")
    assert today["answers"]["vision_change"] is True and today["answers"]["mood"] == 3
    ground = client.get("/ground/a1/view").json()
    assert all(c["day"] != "2026-11-14" for c in ground["checkins"])  # not synced yet
    assert any(c["day"] == "2026-11-13" for c in ground["checkins"])  # seeded history was


def test_checkin_writes_metrics_and_returns_readout(client, state):
    checkin(client, headache="none", mood=4)
    pts = state.metrics.series("a1", "mood", START, datetime(2026, 11, 15))
    assert pts[-1].value == 4 and pts[-1].at.date() == TODAY


def test_same_as_yesterday_copies_previous_answers(client, clock, state):
    clock.set(datetime(2026, 11, 13, 9, 0))
    checkin(client, mood=2, headache="none")
    clock.set(datetime(2026, 11, 14, 9, 0))
    assert checkin(client, same_as_yesterday=True).status_code == 201
    saved = state.repo.get_checkins("a1", TODAY, TODAY)[0][1]
    assert saved.mood == 2 and saved.headache == "none"
    assert state.metrics.series("a1", "mood", START, datetime(2026, 11, 15))[-1].value == 2


def test_second_checkin_same_day_replaces(client, state):
    checkin(client, mood=2)
    checkin(client, mood=5)
    rows = state.repo.get_checkins("a1", TODAY, TODAY)
    assert len(rows) == 1 and rows[0][1].mood == 5
    assert state.metrics.series("a1", "mood", START, datetime(2026, 11, 15))[-1].value == 5


def test_checkin_validation_422(client):
    resp = checkin(client, mood=9)
    assert resp.status_code == 422
    assert "mood" in str(resp.json()["detail"])


def test_evaluate_twice_no_duplicate_alerts(client, state):
    checkin(client, headache="moderate")
    checkin(client, headache="strong")
    assert len(state.repo.open_alerts("a1")) == 1


def test_get_view_does_not_create_alerts(client, state):
    client.get("/astronaut/a1/view")
    client.get("/astronaut/a1/view")
    assert state.repo.open_alerts("a1") == []


def test_view_after_hero_checkin_shows_the_alert(client):
    checkin(client, headache="moderate")
    view = client.get("/astronaut/a1/view").json()
    assert view["alert"]["indicator"] == "headache"
    assert view["side"] == "station"
    assert {i["key"] for i in view["indicators"]} >= {"heart_rate", "sleep_hours", "mood"}


def test_metrics_down_view_still_200(client, state):
    state.metrics.fail = True
    resp = client.get("/astronaut/a1/view")
    assert resp.status_code == 200
    assert all(i["status"] == "unavailable" for i in resp.json()["indicators"])
    assert client.get("/ground/a1/view").status_code == 200


def test_checkin_is_saved_when_metrics_are_down(client, state):
    state.metrics.fail = True
    resp = checkin(client, mood=3, headache="none")
    assert resp.status_code == 201
    assert len(state.repo.get_checkins("a1", TODAY, TODAY)) == 1
    assert resp.json()["overall"] == "unavailable"


def test_unknown_crew_404(client):
    assert client.get("/astronaut/zz/view").status_code == 404
    assert client.get("/ground/zz/view").status_code == 404
    assert client.get("/astronaut/zz/readout").status_code == 404
    assert checkin(client, crew="zz", mood=3).status_code == 404


def test_reset_logs_an_initial_sync(client, state):
    assert state.repo.last_sync_at() is not None
    ground = client.get("/ground/a1/view").json()
    assert ground["last_sync_at"] is not None and ground["indicators"]


def test_views_are_equal_when_nothing_is_pending(client):
    station = client.get("/astronaut/a1/view").json()
    ground = client.get("/ground/a1/view").json()
    assert set(station) == set(ground)
    for key in ("side", "as_of"):
        station.pop(key)
        ground.pop(key)
    assert station == ground


def test_series_passes_source_through(client):
    resp = client.get("/astronaut/a1/series/heart_rate?days=7")
    assert resp.status_code == 200
    pts = resp.json()["points"]
    assert 1 <= len(pts) <= 8 and all(p["source"] == "sim" for p in pts)
    assert client.get("/astronaut/a1/series/not_a_metric").status_code == 422


def test_readout_endpoint(client):
    out = client.get("/astronaut/a1/readout").json()
    assert out["headline"] and out["disclaimer"]


def test_crew_list(client):
    rows = client.get("/crew").json()
    assert [r["crew_id"] for r in rows] == ["a1", "a2", "a3"]
    assert all(r["simulated"] for r in rows)


def test_close_alert_by_hand(client):
    checkin(client, headache="moderate")
    alert_id = client.get("/astronaut/a1/view").json()["alert"]["id"]
    closed = client.post(f"/alerts/{alert_id}/close")
    assert closed.status_code == 200 and closed.json()["state"] == "closed"
    assert client.get("/astronaut/a1/view").json()["alert"] is None
    assert client.post("/alerts/nope/close").status_code == 404


def test_demo_reset_clears_alerts(client, state):
    checkin(client, headache="moderate")
    assert client.post("/demo/reset?day=10").status_code == 200
    assert state.repo.open_alerts("a1") == []
    assert client.get("/astronaut/a1/view").json()["alert"] is None


def test_osd569_is_a_labeled_placeholder_until_the_etl_lands(client):
    ref = client.get("/reference/osd569").json()
    assert ref["dataset_id"] == "OSD-569" and "osdr.nasa.gov" in ref["url"]
    assert ref["placeholder"] is True and ref["indicators"] == []
    assert "not your labs" in ref["label"]


def test_clock_can_move_forward(client, clock):
    clock.set(datetime(2026, 11, 14, 9, 0) + timedelta(hours=1))
    assert client.get("/astronaut/a1/view").json()["as_of"].startswith("2026-11-14T10:00")
