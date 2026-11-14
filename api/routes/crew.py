from __future__ import annotations

from fastapi import APIRouter

from routes.deps import Svc
from schemas import CrewRow, Readiness
from services import record

router = APIRouter(tags=["crew"])


@router.get("/crew", response_model=list[CrewRow])
def crew(s: Svc) -> list[CrewRow]:
    """Crew list as ground sees it: status as of the last sync."""
    return record.crew_rows(s)


@router.get("/crew/readiness", response_model=list[Readiness])
def crew_readiness(s: Svc) -> list[Readiness]:
    """One word per person for the commander, no raw values. The astronaut's own view carries the
    same object."""
    rows = [record.view(s, c["id"], "station").readiness for c in s.repo.crew()]
    return [r for r in rows if r is not None]
