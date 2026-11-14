from datetime import date, datetime

from domain.brief import SUGGESTED_QUESTION, draft_brief
from schemas import Alert, ItemRef

DAY = date(2026, 11, 14)


def alert():
    return Alert(
        id="al1",
        crew_id="a1",
        indicator="headache",
        what_changed="x",
        next_step="y",
        contact_if="Contact the flight surgeon if z",
        related_items=[
            ItemRef(indicator="headache", start=DAY, end=DAY),
            ItemRef(indicator="co2", start=DAY, end=DAY),
        ],
        severity=0.9,
        state="open",
        opened_at=datetime(2026, 11, 14, 9, 0),
    )


def test_draft_pins_the_alert_items_and_suggests_a_question():
    d = draft_brief(alert())
    assert d.alert_id == "al1"
    assert d.pinned_items == alert().related_items
    assert d.question_suggestion == SUGGESTED_QUESTION
    assert "something to watch" in SUGGESTED_QUESTION


def test_draft_without_an_alert_pins_nothing():
    d = draft_brief(None)
    assert d.alert_id is None and d.pinned_items == []
    assert d.question_suggestion == SUGGESTED_QUESTION
