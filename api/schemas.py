"""API contract: every record shape the web app and the domain code share.

Decision support, not diagnosis. Fields named `demo_parameter` mark numbers that have no
cited source (CLAUDE.md rule 7).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, model_validator


def _as_utc(moment: datetime) -> str:
    """Stored times are naive UTC (docs/DECISIONS.md section 4). Send them with a `Z`."""
    if moment.tzinfo is not None:
        moment = moment.astimezone(UTC).replace(tzinfo=None)
    return moment.isoformat() + "Z"


UtcDatetime = Annotated[datetime, PlainSerializer(_as_utc, return_type=str, when_used="json")]

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
Source = Literal["sim", "nasa", "manual"]
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


class CheckinEntry(BaseModel):
    """A saved check-in as both sides see it, including answers no chart shows (vision change)."""

    day: date
    at: UtcDatetime
    answers: CheckinIn


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
    opened_at: UtcDatetime
    closed_at: UtcDatetime | None = None


class Brief(BaseModel):
    id: str
    crew_id: str
    alert_id: str | None = None
    question: str
    pinned_items: list[ItemRef]
    state: Literal["queued", "sent", "answered"]
    created_at: UtcDatetime
    sent_at: UtcDatetime | None = None


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
    created_at: UtcDatetime
    delivered_at: UtcDatetime | None = None


class GroundNoteIn(BaseModel):
    kind: NoteKind
    target: IndicatorKey | None = None
    text: str = Field(min_length=1, max_length=2000)
    reason: str | None = Field(default=None, max_length=500)
    author: str = Field(min_length=1, max_length=80)

    @model_validator(mode="after")
    def _flags_and_requests_need_target_and_reason(self) -> GroundNoteIn:
        needs_both = self.kind in ("watch_flag", "measurement_request")
        if needs_both and (self.target is None or not (self.reason and self.reason.strip())):
            raise ValueError("a watch flag or measurement request needs a target and a reason")
        return self


class GroundNote(BaseModel):
    id: str
    crew_id: str
    kind: NoteKind
    target: IndicatorKey | None = None
    text: str
    reason: str | None = None
    author: str
    created_at: UtcDatetime
    delivered_at: UtcDatetime | None = None


class SyncRecord(BaseModel):
    id: str
    at: UtcDatetime
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
    as_of: UtcDatetime
    indicators: list[Indicator]
    alert: Alert | None = None
    worth_checking: list[Alert] = []
    checkins: list[CheckinEntry] = []
    briefs: list[Brief] = []
    replies: list[Reply] = []
    notes: list[GroundNote] = []
    readiness: Readiness | None = None
    last_sync_at: UtcDatetime | None = None
    disclaimer: str = DISCLAIMER


class Point(BaseModel):
    at: UtcDatetime
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
    last_sync_at: UtcDatetime | None = None
    simulated: bool = True
    module: str
    role: str = "Crew member"


class InboxItem(BaseModel):
    kind: Literal["brief", "alert"]
    crew_id: str
    at: UtcDatetime
    brief: Brief | None = None
    alert: Alert | None = None


class EarthRange(BaseModel):
    """A lab reference range for healthy adults on Earth. Reference only, never an alarm."""

    sex: str | None = None
    min: float
    max: float
    rows: int | None = None


class CrewSample(BaseModel):
    min: float | None = None
    max: float | None = None
    mean: float | None = None
    n: int


class SampleValue(BaseModel):
    """One Inspiration4 blood-count value. `quality` "suspect" values have no usable range."""

    subject: str
    timepoint: str
    value: float | None = None
    quality: str
    range_min: float | None = None
    range_max: float | None = None
    vs_range: str | None = None


class ReferenceRange(BaseModel):
    """One blood-count indicator. `indicator`, `value`, `range_min`, `range_max` and `unit` are the
    flat fields the web adapter reads: `value` is the crew sample mean and the range is the widest
    Earth range across sexes. The fields below them carry everything C's file has."""

    indicator: str
    value: float | None = None
    range_min: float | None = None
    range_max: float | None = None
    unit: str
    name: str | None = None
    earth_reference_ranges: list[EarthRange] = []
    crew_sample: CrewSample | None = None
    values: list[SampleValue] = []


class OsdSubject(BaseModel):
    id: str
    sex: str | None = None


class OsdTimepoint(BaseModel):
    id: str
    label: str | None = None
    phase: str | None = None
    day: int | None = None
    relative_to: str | None = None


class Osd569Reference(BaseModel):
    dataset_id: str
    url: str
    label: str
    placeholder: bool = False
    indicators: list[ReferenceRange]
    dataset: dict | None = None  # citation, DOI, files and access date, as C's ETL wrote them
    notes: list[str] = []
    featured: list[str] = []
    subjects: list[OsdSubject] = []
    timepoints: list[OsdTimepoint] = []


class Mission(BaseModel):
    mission_start: UtcDatetime
    day: int
    now: UtcDatetime


class LinkStatus(BaseModel):
    """What waits for the next ground link, so the astronaut can see it before it leaves."""

    last_sync_at: UtcDatetime | None = None
    next_window_at: UtcDatetime
    window_is_demo_parameter: bool = True
    pending_up: dict[str, int]
    pending_down: dict[str, int]


class MeasurementIn(BaseModel):
    """Readings taken on their own, without answering the check-in again."""

    heart_rate: float | None = Field(default=None, gt=20, lt=250)
    bp_systolic: float | None = Field(default=None, gt=0, lt=300)
    bp_diastolic: float | None = Field(default=None, gt=0, lt=200)
    glucose: float | None = Field(default=None, gt=0, lt=800)
    body_temp: float | None = Field(default=None, gt=25, lt=45)

    @model_validator(mode="after")
    def at_least_one(self) -> MeasurementIn:
        if all(v is None for v in self.model_dump().values()):
            raise ValueError("send at least one reading")
        return self
