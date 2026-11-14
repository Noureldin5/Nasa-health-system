import re


def test_readiness_has_a_word_per_person_and_no_raw_values(client):
    rows = client.get("/crew/readiness").json()
    assert [r["crew_id"] for r in rows] == ["a1", "a2", "a3"]
    for r in rows:
        assert set(r) == {"crew_id", "readiness", "reason"}
        assert not re.search(r"\d", r["reason"])
    by_id = {r["crew_id"]: r["readiness"] for r in rows}
    assert by_id["a3"] == "ready"
    assert by_id["a1"] == "check"  # cabin CO2 was high yesterday


def test_the_astronaut_sees_the_same_readiness_the_commander_sees(client):
    rows = {r["crew_id"]: r for r in client.get("/crew/readiness").json()}
    for crew_id, row in rows.items():
        assert client.get(f"/astronaut/{crew_id}/view").json()["readiness"] == row


def test_readiness_is_learning_before_the_baseline_is_ready(client):
    client.post("/demo/reset?day=4")
    rows = client.get("/crew/readiness").json()
    assert {r["readiness"] for r in rows} == {"learning"}
