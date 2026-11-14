from __future__ import annotations

from fastapi import APIRouter

from routes.deps import Svc
from schemas import CrewRow
from services import record

router = APIRouter(tags=["crew"])


@router.get("/crew", response_model=list[CrewRow])
def crew(s: Svc) -> list[CrewRow]:
    """Crew list as ground sees it: status as of the last sync."""
    return record.crew_rows(s)
