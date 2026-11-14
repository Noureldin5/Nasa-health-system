"""Demo support: reseed the simulated mission so rehearsals start from a known state."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from routes.deps import Svc
from services import record

router = APIRouter(tags=["demo"])


@router.post("/demo/reset")
def demo_reset(s: Svc, day: Annotated[int, Query(ge=1, le=14)] = 10) -> dict[str, int]:
    """Real today becomes mission `day`. Day 10: one headache check-in raises the hero alert."""
    record.reset_demo(s, day)
    return {"day": day}
