"""Contract stubs for endpoints that later tasks build. Each returns 501 and is removed when its
real handler lands, so A can generate typed clients from openapi.json today.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from schemas import (
    Brief,
    BriefDraft,
    BriefIn,
    GroundNote,
    GroundNoteIn,
    InboxItem,
    Readiness,
    Reply,
    ReplyIn,
    SyncRecord,
)

router = APIRouter()


def _todo() -> None:
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/crew/readiness", response_model=list[Readiness], tags=["crew"])
def crew_readiness() -> list[Readiness]:
    _todo()


@router.get("/astronaut/{crew_id}/briefs/draft", response_model=BriefDraft, tags=["briefs"])
def brief_draft(crew_id: str) -> BriefDraft:
    _todo()


@router.post("/astronaut/{crew_id}/briefs", response_model=Brief, status_code=201, tags=["briefs"])
def post_brief(crew_id: str, body: BriefIn) -> Brief:
    _todo()


@router.post("/briefs/{brief_id}/reply", response_model=Reply, status_code=201, tags=["briefs"])
def post_reply(brief_id: str, body: ReplyIn) -> Reply:
    _todo()


@router.get("/ground/inbox", response_model=list[InboxItem], tags=["ground"])
def ground_inbox() -> list[InboxItem]:
    _todo()


@router.post("/ground/{crew_id}/notes", response_model=GroundNote, status_code=201, tags=["ground"])
def post_note(crew_id: str, body: GroundNoteIn) -> GroundNote:
    _todo()


@router.post("/link/sync", response_model=SyncRecord, tags=["link"])
def link_sync() -> SyncRecord:
    _todo()


@router.get("/link/log", response_model=list[SyncRecord], tags=["link"])
def link_log() -> list[SyncRecord]:
    _todo()
