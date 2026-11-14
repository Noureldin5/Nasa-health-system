"""OSD-569 Earth reference ranges. Reference only: they never trigger an alert."""

from __future__ import annotations

import json

from fastapi import APIRouter

from routes.deps import Svc
from schemas import Osd569Reference

router = APIRouter(tags=["reference"])

OSD569_URL = "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569"
LABEL = "Inspiration4 crew sample, not your labs"


@router.get("/reference/osd569", response_model=Osd569Reference)
def reference_osd569(s: Svc) -> Osd569Reference:
    """Serves data/processed/osd569.json (C's ETL). Until it exists, a labeled placeholder with
    no invented numbers."""
    path = s.settings.osd569_path
    if path.exists():
        return Osd569Reference.model_validate(json.loads(path.read_text()))
    return Osd569Reference(
        dataset_id="OSD-569", url=OSD569_URL, label=LABEL, placeholder=True, indicators=[]
    )
