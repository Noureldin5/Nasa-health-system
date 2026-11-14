"""Ground-side endpoints. The ground view is the same `RecordView` the astronaut gets."""

from __future__ import annotations

from fastapi import APIRouter

from routes.deps import Svc
from schemas import RecordView
from services import record

router = APIRouter(tags=["ground"])


@router.get("/ground/{crew_id}/view", response_model=RecordView)
def ground_view(crew_id: str, s: Svc) -> RecordView:
    return record.view(s, crew_id, "ground")
