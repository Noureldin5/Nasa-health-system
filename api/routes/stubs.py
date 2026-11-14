"""Contract stubs (Task 0). Each later task replaces its stubs with real handlers.

Every endpoint returns 501 so A can generate typed clients from openapi.json today.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from schemas import (
    Alert,
    Brief,
    BriefDraft,
    BriefIn,
    CheckinIn,
    CrewRow,
    GroundNote,
    GroundNoteIn,
    InboxItem,
    Osd569Reference,
    Readiness,
    Readout,
    RecordView,
    Reply,
    ReplyIn,
    Series,
    SyncRecord,
)

router = APIRouter()


def _todo() -> None:
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/crew", response_model=list[CrewRow], tags=["crew"])
def crew() -> list[CrewRow]:
    _todo()


@router.get("/crew/readiness", response_model=list[Readiness], tags=["crew"])
def crew_readiness() -> list[Readiness]:
    _todo()


@router.get("/astronaut/{crew_id}/view", response_model=RecordView, tags=["astronaut"])
def astronaut_view(crew_id: str) -> RecordView:
    _todo()


@router.get("/astronaut/{crew_id}/readout", response_model=Readout, tags=["astronaut"])
def astronaut_readout(crew_id: str) -> Readout:
    _todo()


@router.get("/astronaut/{crew_id}/series/{metric}", response_model=Series, tags=["astronaut"])
def astronaut_series(crew_id: str, metric: str, days: int = 7) -> Series:
    _todo()


@router.post(
    "/astronaut/{crew_id}/checkin", response_model=Readout, status_code=201, tags=["astronaut"]
)
def post_checkin(crew_id: str, body: CheckinIn) -> Readout:
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


@router.post("/alerts/{alert_id}/close", response_model=Alert, tags=["astronaut"])
def close_alert(alert_id: str) -> Alert:
    _todo()


@router.get("/ground/inbox", response_model=list[InboxItem], tags=["ground"])
def ground_inbox() -> list[InboxItem]:
    _todo()


@router.get("/ground/{crew_id}/view", response_model=RecordView, tags=["ground"])
def ground_view(crew_id: str) -> RecordView:
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


@router.get("/reference/osd569", response_model=Osd569Reference, tags=["reference"])
def reference_osd569() -> Osd569Reference:
    _todo()


@router.post("/demo/reset", tags=["demo"])
def demo_reset(day: int = 10) -> dict[str, int]:
    _todo()
