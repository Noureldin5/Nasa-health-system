from __future__ import annotations

from fastapi import APIRouter

from routes.deps import Svc
from schemas import SyncRecord
from services import link as link_service

router = APIRouter(tags=["link"])


@router.post("/link/sync", response_model=SyncRecord)
def link_sync(s: Svc) -> SyncRecord:
    """Simulated ground link, triggered by the demo. Sends the record up, brings ground notes down."""
    return link_service.do_sync(s)


@router.get("/link/log", response_model=list[SyncRecord])
def link_log(s: Svc) -> list[SyncRecord]:
    """Every sync, newest first, with what it carried."""
    return s.repo.sync_log()
