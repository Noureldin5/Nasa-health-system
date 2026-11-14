"""API contract: every record shape the web app and the domain code share.

Decision support, not diagnosis. Fields named `demo_parameter` mark numbers that have no
cited source (CLAUDE.md rule 7).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

DISCLAIMER = "Decision support, not a diagnosis."

IndicatorKey = Literal[
    "bp_systolic",
    "bp_diastolic",
    "heart_rate",
    "glucose",
    "body_temp",
    "sleep_hours",
    "mood",
    "headache",
    "co2",
]
Status = Literal["learning", "in_range", "worth_checking", "contact_surgeon", "unavailable"]
Source = Literal["sim", "nasa"]
HeadacheLevel = Literal["none", "mild", "moderate", "strong"]
NoteKind = Literal["note", "watch_flag", "measurement_request"]


class Band(BaseModel):
    low: float
    high: float
    mean: float
    demo_parameter: bool = True


class CheckinIn(BaseModel):
    same_as_yesterday: bool = False
    rested: int | None = Field(default=None, ge=1, le=5)
    headache: HeadacheLevel | None = None
    mood: int | None = Field(default=None, ge=1, le=5)
    vision_change: bool | None = None
    bp_systolic: float | None = Field(default=None, gt=0, lt=300)
    bp_diastolic: float | None = Field(default=None, gt=0, lt=200)
    glucose: float | None = Field(default=None, gt=0, lt=800)
    body_temp: float | None = Field(default=None, gt=25, lt=45)


class ItemRef(BaseModel):
    indicator: IndicatorKey
    start: date
    end: date


class Indicator(BaseModel):
    key: IndicatorKey
    value: float | None
    unit: str
    status: Status
    baseline: Band | None = None
    calibration_day: int | None = None
    source: Source
    earth_reference: Band | None = None


class Alert(BaseModel):
    id: str
    crew_id: str
    indicator: IndicatorKey
    what_changed: str
    next_step: str
    contact_if: str
    related_items: list[ItemRef]
    severity: float
    state: Literal["open", "closed"]
    opened_at: datetime
    closed_at: datetime | None = None


class Brief(BaseModel):
    id: str
    crew_id: str
    alert_id: str | None = None
    question: str
    pinned_items: list[ItemRef]
    state: Literal["queued", "sent", "answered"]
    created_at: datetime
    sent_at: datetime | None = None


class BriefIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    alert_id: str | None = None


class BriefDraft(BaseModel):
    question_suggestion: str
    pinned_items: list[ItemRef]
    alert_id: str | None = None


class ReplyIn(BaseModel):
    author: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=2000)


class Reply(BaseModel):
    id: str
    brief_id: str
    author: str
    text: str
    created_at: datetime
    delivered_at: datetime | None = None


class GroundNoteIn(BaseModel):
    kind: NoteKind
    target: IndicatorKey | None = None
    text: str = Field(min_length=1, max_length=2000)
    reason: str | None = Field(default=None, max_length=500)
    author: str = Field(min_length=1, max_length=80)


class GroundNote(BaseModel):
    id: str
    crew_id: str
    kind: NoteKind
    target: IndicatorKey | None = None
    text: str
    reason: str | None = None
    author: str
    created_at: datetime
    delivered_at: datetime | None = None


class SyncRecord(BaseModel):
    id: str
    at: datetime
    up: dict[str, int]
    down: dict[str, int]
    item_ids: list[str]


class Readiness(BaseModel):
    crew_id: str
    readiness: Literal["ready", "check", "learning"]
    reason: str


class Readout(BaseModel):
    overall: Status
    headline: str
    tip: str
    alert: Alert | None = None
    disclaimer: str = DISCLAIMER


class RecordView(BaseModel):
    crew_id: str
    side: Literal["station", "ground"]
    as_of: datetime
    indicators: list[Indicator]
    alert: Alert | None = None
    worth_checking: list[Alert] = []
    briefs: list[Brief] = []
    replies: list[Reply] = []
    notes: list[GroundNote] = []
    readiness: Readiness | None = None
    last_sync_at: datetime | None = None
    disclaimer: str = DISCLAIMER


class Point(BaseModel):
    at: datetime
    value: float
    source: Source


class Series(BaseModel):
    crew_id: str
    key: IndicatorKey
    points: list[Point]


class CrewRow(BaseModel):
    crew_id: str
    name: str
    status: Status
    open_alerts: int
    unanswered_briefs: int
    last_sync_at: datetime | None = None
    simulated: bool = True


class InboxItem(BaseModel):
    kind: Literal["brief", "alert"]
    crew_id: str
    at: datetime
    brief: Brief | None = None
    alert: Alert | None = None


class ReferenceRange(BaseModel):
    indicator: str
    value: float | None = None
    range_min: float | None = None
    range_max: float | None = None
    unit: str


class Osd569Reference(BaseModel):
    dataset_id: str
    url: str
    label: str
    placeholder: bool = False
    indicators: list[ReferenceRange]
