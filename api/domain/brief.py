"""Consult brief draft: the question the astronaut can edit, with the alert's items pinned (U5).

The pins come from the alert, never from the client, so the brief and the alert always agree.
Ground still sees the full record. Pinning only says where to look first.
"""

from __future__ import annotations

from schemas import Alert, BriefDraft

SUGGESTED_QUESTION = "Is this pattern something to watch, or should I change anything?"


def draft_brief(alert: Alert | None) -> BriefDraft:
    return BriefDraft(
        question_suggestion=SUGGESTED_QUESTION,
        pinned_items=list(alert.related_items) if alert else [],
        alert_id=alert.id if alert else None,
    )
