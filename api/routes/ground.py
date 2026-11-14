"""Ground-side endpoints. The ground view is the same `RecordView` the astronaut gets."""

from __future__ import annotations

from fastapi import APIRouter

from routes.deps import Svc
from schemas import GroundNote, GroundNoteIn, InboxItem, RecordView
from services import consult, record

router = APIRouter(tags=["ground"])


@router.get("/ground/{crew_id}/view", response_model=RecordView)
def ground_view(crew_id: str, s: Svc) -> RecordView:
    return record.view(s, crew_id, "ground")


@router.get("/ground/inbox", response_model=list[InboxItem])
def ground_inbox(s: Svc) -> list[InboxItem]:
    """Briefs first, then alerts that arrived with the latest sync. Empty on a normal day."""
    return consult.inbox(s)


@router.post("/ground/{crew_id}/notes", response_model=GroundNote, status_code=201)
def post_note(crew_id: str, body: GroundNoteIn, s: Svc) -> GroundNote:
    """A note, watch flag or measurement request. The astronaut sees it, word for word, after the next sync."""
    return consult.add_note(s, crew_id, body)
