"""OSD-569 Earth reference ranges for the blood-count card (M2b).

Turns C's `data/processed/osd569.json` into the API shape. Pure: no file access.
Reference only. These ranges never trigger an alert (CLAUDE.md rule 6).
"""

from __future__ import annotations

from schemas import Osd569Reference, ReferenceRange


def osd569_from_doc(doc: dict) -> Osd569Reference:
    """Raises KeyError, TypeError or pydantic.ValidationError when the file has the wrong shape."""
    indicators = []
    for raw in doc["indicators"]:
        ranges = raw.get("earth_reference_ranges", [])
        sample = raw.get("crew_sample")
        indicators.append(
            ReferenceRange(
                indicator=raw["id"],
                name=raw.get("name"),
                unit=raw["unit"],
                value=sample.get("mean") if sample else None,
                # Widest range across sexes. Sex-specific ranges are kept in earth_reference_ranges.
                range_min=min((r["min"] for r in ranges), default=None),
                range_max=max((r["max"] for r in ranges), default=None),
                earth_reference_ranges=ranges,
                crew_sample=sample,
                values=raw.get("values", []),
            )
        )
    dataset = doc["dataset"]
    return Osd569Reference(
        dataset_id=dataset["id"],
        url=dataset["url"],
        label=doc["label"],
        placeholder=False,
        indicators=indicators,
        dataset=dataset,
        notes=doc.get("notes", []),
        featured=doc.get("featured", []),
        subjects=doc.get("subjects", []),
        timepoints=doc.get("timepoints", []),
    )
