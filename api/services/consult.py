"""Consult layer: briefs, replies, the ground inbox and surgeon notes.

Everything ground writes starts with `delivered_at = None` and reaches the astronaut at the next
sync, word for word. There are no ground-only fields.
"""

from __future__ import annotations

from domain.brief import draft_brief
from schemas import Brief, BriefDraft, BriefIn, GroundNote, GroundNoteIn, InboxItem, Reply, ReplyIn
from services import record
from services.record import Conflict, NotFound, Services, require_crew
from store.repo import new_id


def draft(s: Services, crew_id: str) -> BriefDraft:
    return draft_brief(record.view(s, crew_id, "station").alert)


def create_brief(s: Services, crew_id: str, body: BriefIn) -> Brief:
    require_crew(s, crew_id)
    alert = None
    if body.alert_id is not None:
        alert = s.repo.get_alert(body.alert_id)
        if alert is None or alert.crew_id != crew_id:
            raise NotFound("Alert not found")
    brief = Brief(
        id=new_id("b"),
        crew_id=crew_id,
        alert_id=body.alert_id,
        question=body.question,
        pinned_items=draft_brief(alert).pinned_items,
        state="queued",
        created_at=s.clock.now(),
    )
    s.repo.create_brief(brief)
    return brief


def add_reply(s: Services, brief_id: str, body: ReplyIn) -> Reply:
    brief = s.repo.get_brief(brief_id)
    if brief is None:
        raise NotFound("Brief not found")
    if brief.state == "queued":
        raise Conflict("This brief has not reached ground yet. It goes up at the next sync.")
    reply = Reply(
        id=new_id("r"),
        brief_id=brief_id,
        author=body.author,
        text=body.text,
        created_at=s.clock.now(),
    )
    s.repo.add_reply(reply)
    s.repo.set_brief_state(brief_id, "answered")
    return reply


def add_note(s: Services, crew_id: str, body: GroundNoteIn) -> GroundNote:
    require_crew(s, crew_id)
    note = GroundNote(
        id=new_id("n"),
        crew_id=crew_id,
        kind=body.kind,
        target=body.target,
        text=body.text,
        reason=body.reason,
        author=body.author,
        created_at=s.clock.now(),
    )
    s.repo.add_note(note)
    return note


def inbox(s: Services) -> list[InboxItem]:
    """Briefs first (unanswered, newest first), then alerts that arrived with the latest sync."""
    log = s.repo.sync_log()
    latest = log[0].at if log else None
    previous = log[1].at if len(log) > 1 else None
    briefs: list[InboxItem] = []
    alerts: list[InboxItem] = []
    for c in s.repo.crew():
        v = record.view(s, c["id"], "ground")
        briefs += [
            InboxItem(kind="brief", crew_id=c["id"], at=b.created_at, brief=b)
            for b in v.briefs
            if b.state != "answered"
        ]
        for a in ([v.alert] if v.alert else []) + v.worth_checking:
            arrived = latest is not None and a.opened_at <= latest
            if arrived and (previous is None or a.opened_at > previous):
                alerts.append(InboxItem(kind="alert", crew_id=c["id"], at=a.opened_at, alert=a))
    briefs.sort(key=lambda i: i.at, reverse=True)
    alerts.sort(key=lambda i: i.at, reverse=True)
    return briefs + alerts
