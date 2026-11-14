from __future__ import annotations

from fastapi import APIRouter

from routes.deps import Svc
from schemas import Brief, BriefDraft, BriefIn, Reply, ReplyIn
from services import consult

router = APIRouter(tags=["briefs"])


@router.get("/astronaut/{crew_id}/briefs/draft", response_model=BriefDraft)
def brief_draft(crew_id: str, s: Svc) -> BriefDraft:
    """A suggested question with the current alert's items pinned. The astronaut can edit it."""
    return consult.draft(s, crew_id)


@router.post("/astronaut/{crew_id}/briefs", response_model=Brief, status_code=201)
def post_brief(crew_id: str, body: BriefIn, s: Svc) -> Brief:
    """Queue a brief. It goes up at the next ground link."""
    return consult.create_brief(s, crew_id, body)


@router.post("/briefs/{brief_id}/reply", response_model=Reply, status_code=201)
def post_reply(brief_id: str, body: ReplyIn, s: Svc) -> Reply:
    """Advice to a colleague, not an order. Reaches the astronaut at the next sync."""
    return consult.add_reply(s, brief_id, body)
