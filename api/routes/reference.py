"""OSD-569 Earth reference ranges. Reference only: they never trigger an alert."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from domain.reference import osd569_from_doc
from routes.deps import Svc
from schemas import Osd569Reference

router = APIRouter(tags=["reference"])

OSD569_URL = "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569"
LABEL = "Inspiration4 crew sample, not your labs"


@router.get("/reference/osd569", response_model=Osd569Reference)
def reference_osd569(s: Svc) -> Osd569Reference:
    """Serves data/processed/osd569.json (C's ETL). Until it exists, a labeled placeholder with
    no invented numbers. A file with the wrong shape is an error, not a silent placeholder."""
    path = s.settings.osd569_path
    if not path.exists():
        return Osd569Reference(
            dataset_id="OSD-569", url=OSD569_URL, label=LABEL, placeholder=True, indicators=[]
        )
    try:
        return osd569_from_doc(json.loads(path.read_text()))
    except (ValueError, KeyError, TypeError) as err:
        raise HTTPException(
            status_code=500,
            detail=f"{path.name} does not match the expected shape ({type(err).__name__}: {err})",
        ) from err


@router.get("/reference/hazards")
def reference_hazards(s: Svc) -> dict:
    """The five NASA HRP hazards with checked quotes and links (C's data/processed/hazards.json),
    for the Environment Switcher. Served as the file is, so the quotes stay verbatim."""
    path = s.settings.hazards_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="Hazards file not found")
    try:
        doc = json.loads(path.read_text())
    except ValueError as err:
        raise HTTPException(status_code=500, detail="Hazards file is not valid JSON") from err
    if not isinstance(doc, dict) or not isinstance(doc.get("hazards"), list):
        raise HTTPException(status_code=500, detail="Hazards file has the wrong shape")
    return doc
