"""Astronaut-side endpoints. Thin: validation here, logic in `services` and `domain`."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from routes.deps import Svc
from schemas import Alert, CheckinIn, IndicatorKey, Readout, RecordView, Series
from services import record

router = APIRouter(tags=["astronaut"])


@router.get("/astronaut/{crew_id}/view", response_model=RecordView)
def astronaut_view(crew_id: str, s: Svc) -> RecordView:
    return record.view(s, crew_id, "station")


@router.get("/astronaut/{crew_id}/readout", response_model=Readout)
def astronaut_readout(crew_id: str, s: Svc) -> Readout:
    return record.readout(s, crew_id)


@router.get("/astronaut/{crew_id}/series/{metric}", response_model=Series)
def astronaut_series(
    crew_id: str, metric: IndicatorKey, s: Svc, days: Annotated[int, Query(ge=1, le=60)] = 7
) -> Series:
    return record.series(s, crew_id, metric, days)


@router.post("/astronaut/{crew_id}/checkin", response_model=Readout, status_code=201)
def post_checkin(crew_id: str, body: CheckinIn, s: Svc) -> Readout:
    return record.submit_checkin(s, crew_id, body, s.clock.now())


@router.post("/alerts/{alert_id}/close", response_model=Alert)
def close_alert(alert_id: str, s: Svc) -> Alert:
    found = s.repo.get_alert(alert_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    if found.state == "closed":
        return found
    closed = s.repo.close_alert(alert_id, s.clock.now())
    assert closed is not None
    return closed
