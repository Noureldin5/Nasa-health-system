"""The record assistant route: rules before the model, a guard after it, no key in any response."""

import pytest

from routes import ai

FACTS = {
    "mission_day": 14,
    "crew": "Astronaut A (simulated)",
    "metrics": [
        {
            "key": "sleep",
            "label": "Sleep",
            "unit": "h",
            "status": "watch",
            "status_text": "Below your usual for 4 nights",
            "usual": "6.5 to 7.3",
            "values": {"12": "5.5", "13": "5.6"},
        }
    ],
    "checkins": [{"day": 13, "headache": "mild"}],
    "cabin": {"module": "Node 1", "unit": "ppm", "usual": "2,130 to 2,560", "daily_mean": {}},
}


@pytest.fixture(autouse=True)
def isolated(monkeypatch, tmp_path):
    """No real key, no real network and no shared cache file in any test."""
    cfg = {
        "provider": "gemini",
        "key": "",
        "model": "test-model",
        "base": "https://example.invalid",
        "extra": {},
        "timeout": 1.0,
        "cache_path": tmp_path / "cache.json",
    }
    monkeypatch.setattr(ai, "config", lambda: cfg)
    monkeypatch.setattr(ai, "_cache", {})
    monkeypatch.setattr(ai, "_cache_loaded_from", None)
    return cfg


def ask(client, question="How was my sleep this week?", **extra):
    body = {"feature": "ask", "question": question, "facts": FACTS, **extra}
    return client.post("/ai/complete", json=body)


def test_without_a_key_the_app_is_told_to_use_its_canned_answer(client):
    out = ask(client).json()
    assert out["source"] == "unavailable"
    assert out["reason"] == "no_key"
    assert out["text"] == ""


def test_red_flag_question_gets_the_rule_text_and_never_reaches_the_model(client, isolated):
    isolated["key"] = "k"
    called = []
    ai_call = ai.call_provider
    try:
        ai.call_provider = lambda *a: called.append(a) or "{}"
        out = ask(client, "I have chest pain, is it my sleep?").json()
    finally:
        ai.call_provider = ai_call
    assert out["source"] == "rule"
    assert "flight surgeon" in out["text"]
    assert called == []


@pytest.mark.parametrize(
    "question",
    [
        "My chest hurts, is my heart OK?",
        "I have chest tightness",
        "I have trouble breathing at night",
        "I can’t breathe well",
        "I feel dizzy, is it my sleep?",
        "Could this be a heart attack or a stroke?",
        "I want to die",
        "There is pain behind my eyes",
    ],
)
def test_symptom_questions_get_the_rule_text(client, question):
    out = ask(client, question).json()
    assert (out["source"], out["reason"]) == ("rule", "red_flag")


@pytest.mark.parametrize(
    "question",
    [
        "What number was my heart rate on day 12?",
        "Does the crew tablet show my sleep?",
        "Is my resting heart rate different from my usual?",
        "Is it true that I slept less on day 12?",
    ],
)
def test_ordinary_questions_do_not_trip_the_rules(client, question):
    assert ask(client, question).json()["reason"] == "no_key"  # went on to the model path


def test_ground_side_and_dropped_features_are_rejected(client):
    ground = {**FACTS, "perspective": "ground"}
    assert client.post("/ai/complete", json={"feature": "ask", "facts": ground}).status_code == 422
    assert (
        client.post("/ai/complete", json={"feature": "digest", "facts": FACTS}).status_code == 422
    )


@pytest.mark.parametrize(
    "question", ["Am I getting sick?", "Is it serious?", "Do I have a fever?", "Am I okay?"]
)
def test_a_request_for_an_assessment_gets_the_rule_text(client, question):
    out = ask(client, question).json()
    assert (out["source"], out["reason"]) == ("rule", "assessment")


def test_medicine_question_gets_the_rule_text(client):
    out = ask(client, "What dose of ibuprofen should I take?").json()
    assert out["source"] == "rule"
    assert out["reason"] == "medicine"


def test_act_alert_is_explained_by_the_rule_not_the_model(client):
    facts = {
        **FACTS,
        "alert": {
            "day": 14,
            "severity": "act",
            "state": "open",
            "title": "You reported a strong headache today",
            "what_changed": "You reported a strong headache in today's check-in.",
            "next_step": "Rest and send a consult brief now.",
            "contact_if": "now.",
        },
    }
    out = client.post("/ai/complete", json={"feature": "explain_alert", "facts": facts}).json()
    assert out["source"] == "rule"
    assert out["reason"] == "act_alert"


def test_model_answer_keeps_only_cites_that_exist_in_the_facts_then_is_cached(
    client, isolated, monkeypatch
):
    isolated["key"] = "k"
    raw = (
        '```json\n{"answer": "You slept 5.5 h on day 12.", "cites": ['
        '{"metric": "sleep", "day": 12}, {"metric": "sleep", "day": 3}, '
        '{"metric": "glucose", "day": 12}, {"metric": "headache", "day": 13}]}\n```'
    )
    calls = []
    monkeypatch.setattr(ai, "call_provider", lambda *a: calls.append(1) or raw)
    first = ask(client).json()
    assert first["source"] == "model"
    assert first["text"] == "You slept 5.5 h on day 12."
    assert first["cites"] == [{"metric": "sleep", "day": 12}, {"metric": "headache", "day": 13}]
    second = ask(client).json()
    assert second["source"] == "cache"
    assert second["text"] == first["text"]
    assert len(calls) == 1


@pytest.mark.parametrize(
    "bad",
    [
        "Take 400 mg of something before sleep.",
        "This looks like a diagnosis of insomnia.",
        "You probably have a migraine.",
        "Your short sleep is caused by the cabin air.",
        "This is nothing to worry about.",
    ],
)
def test_dose_or_diagnosis_wording_from_the_model_is_dropped(client, isolated, monkeypatch, bad):
    isolated["key"] = "k"
    monkeypatch.setattr(ai, "call_provider", lambda *a: f'{{"answer": "{bad}", "cites": []}}')
    out = ask(client).json()
    assert out["source"] == "unavailable"
    assert out["reason"] == "guard"
    assert out["text"] == ""


@pytest.mark.parametrize(
    "fine",
    [
        "Blood sugar was 92 mg/dL on day 10, inside your usual 80 to 101 mg/dL.",
        "A pattern to check, not a cause. This is not a diagnosis.",
        "You have a fluctuating resting heart rate between day 11 and day 14.",
    ],
)
def test_the_apps_own_wording_passes_the_guard(client, isolated, monkeypatch, fine):
    isolated["key"] = "k"
    monkeypatch.setattr(ai, "call_provider", lambda *a: f'{{"answer": "{fine}", "cites": []}}')
    out = ask(client).json()
    assert out["source"] == "model"
    assert out["text"] == fine


def test_a_question_about_a_reading_in_mg_per_dl_is_not_a_medicine_question(client):
    out = ask(client, "Is 92 mg/dL usual for me?").json()
    assert out["reason"] == "no_key"  # reached the model path, not the medicine rule


def test_provider_failure_is_reported_as_unavailable(client, isolated, monkeypatch):
    isolated["key"] = "k"

    def boom(*_):
        raise ai.ProviderError("network")

    monkeypatch.setattr(ai, "call_provider", boom)
    out = ask(client).json()
    assert out == {**out, "source": "unavailable", "reason": "network"}


def test_unknown_fields_and_oversized_input_are_rejected(client):
    assert ask(client, anything="else").status_code == 422
    assert ask(client, "x" * 401).status_code == 422
    big = {**FACTS, "metrics": [FACTS["metrics"][0]] * 9}
    resp = client.post("/ai/complete", json={"feature": "ask", "question": "q", "facts": big})
    assert resp.status_code == 422


def test_status_never_returns_the_key(client, isolated):
    isolated["key"] = "secret-key"
    body = client.get("/ai/status")
    assert body.json()["configured"] is True
    assert "secret-key" not in body.text
