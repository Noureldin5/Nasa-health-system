"""Contract stubs for endpoints that later tasks build. Each returns 501 and is removed when its
real handler lands, so A can generate typed clients from openapi.json today.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from schemas import Readiness

router = APIRouter()


def _todo() -> None:
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/crew/readiness", response_model=list[Readiness], tags=["crew"])
def crew_readiness() -> list[Readiness]:
    _todo()
