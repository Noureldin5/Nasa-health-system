"""Crew readiness (S3): one word per person for the commander, never raw medical values.

The astronaut's own view carries the same object, so they see exactly what the commander sees.
"""

from __future__ import annotations

from schemas import Readiness, Readout

_MAP = {
    "in_range": ("ready", "In their usual range"),
    "worth_checking": ("check", "Something worth checking"),
    "contact_surgeon": ("check", "Something worth checking"),
    "learning": ("learning", "Still learning their baseline"),
    "unavailable": ("check", "Readings unavailable"),
}


def readiness_for(crew_id: str, readout: Readout) -> Readiness:
    word, reason = _MAP[readout.overall]
    return Readiness(crew_id=crew_id, readiness=word, reason=reason)  # type: ignore[arg-type]
