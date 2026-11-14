"""MetricsPort backed by VictoriaMetrics, through C's `pipeline` package.

The API never writes MetricsQL. Everything goes through `pipeline.queries` and `pipeline.ingest`
(docs/DECISIONS.md sections 5 and 10).

What this adapter decides, so the domain code stays the same as with the fake store:
- The API uses naive UTC datetimes. The pipeline wants timezone-aware ones. Converted here.
- The API expects one point per mission day. Daily metrics already come that way from the pipeline.
  5-minute metrics (heart rate, CO2) are reduced to the mean of each mission day. Days that are
  not fully inside the requested window are dropped: a partial-day mean would be biased against
  the baseline (DECISIONS section 10, row 4). Today's heart rate therefore appears tomorrow.
  The mean is used for CO2 too, not the 5-minute peak, which is not comparable to the cited limit.
- Values typed in the app are stored with source="manual" (DECISIONS OPEN 2).
"""

from __future__ import annotations

import statistics
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from metrics.port import MetricsUnavailable
from schemas import IndicatorKey, Point

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:  # the pipeline package lives at the repo root, next to api/
    sys.path.insert(0, str(_REPO_ROOT))

from pipeline import crew as pipeline_crew
from pipeline import mission as pipeline_mission
from pipeline import schema as pipeline_schema
from pipeline import vm as pipeline_vm
from pipeline.ingest import Point as VmPoint
from pipeline.ingest import flush, write_points
from pipeline.queries import series as vm_series
from pipeline.reset import demo_reset

# API indicator key -> pipeline metric name.
METRIC_OF: dict[IndicatorKey, str] = {
    "bp_systolic": "bp_systolic_mmhg",
    "bp_diastolic": "bp_diastolic_mmhg",
    "heart_rate": "hr_bpm",
    "glucose": "glucose_mg_dl",
    "body_temp": "body_temp_c",
    "sleep_hours": "sleep_hours",
    "mood": "mood_score",
    "headache": "symptom_strength",
    "co2": "co2_ppm",
}

_DAY_OFFSET = timedelta(hours=6)  # same boundary as domain.days.mission_date
_DAY = timedelta(days=1)
_ONE_US = timedelta(microseconds=1)

_UNAVAILABLE = (pipeline_vm.VMUnavailable, pipeline_vm.VMError)


def _aware(moment: datetime) -> datetime:
    return moment.replace(tzinfo=UTC)


def _naive(moment: datetime) -> datetime:
    return moment.astimezone(UTC).replace(tzinfo=None)


def _day_start(day: date) -> datetime:
    return datetime.combine(day, datetime.min.time()) - _DAY_OFFSET


def _labels(crew_id: str, key: IndicatorKey) -> dict[str, str]:
    """Labels that pick the series. CO2 belongs to a module, the rest to a person."""
    if key == "co2":
        return {"module": pipeline_crew.module_of(crew_id)}
    labels = {"crew_id": crew_id}
    if key == "headache":
        labels["symptom"] = "headache"
    return labels


class VmMetrics:
    """Time series in VictoriaMetrics. Raises MetricsUnavailable when it cannot be reached."""

    def series(
        self, crew_id: str, key: IndicatorKey, start: datetime, end: datetime
    ) -> list[Point]:
        metric = METRIC_OF[key]
        try:
            samples = vm_series(
                metric,
                start=_aware(start),
                end=_aware(end) + _ONE_US,  # the pipeline excludes `end`; the port includes it
                labels=_labels(crew_id, key),
            )
        except _UNAVAILABLE as error:
            raise MetricsUnavailable(str(error)) from error
        points = [
            Point(
                at=_naive(s.ts),
                value=s.value,
                source=s.source,  # type: ignore[arg-type]  # sim, nasa or manual
            )
            for s in samples
        ]
        if pipeline_schema.get(metric).cadence == pipeline_schema.FIVE_MIN:
            points = _daily_means(points, start, end)
        return points

    def write(self, crew_id: str, values: dict[IndicatorKey, float], at: datetime) -> None:
        points = [
            VmPoint(
                METRIC_OF[key],
                float(value),
                _aware(at),
                {**_labels(crew_id, key), "source": "manual"},
            )
            for key, value in values.items()
        ]
        try:
            write_points(points)
            flush()  # make the value readable at once (DECISIONS section 6)
        except _UNAVAILABLE as error:
            raise MetricsUnavailable(str(error)) from error

    def mission_start(self) -> datetime | None:
        try:
            return _naive(pipeline_mission.mission_start())
        except pipeline_mission.MissionNotLoaded:
            return None
        except _UNAVAILABLE as error:
            raise MetricsUnavailable(str(error)) from error

    def seed(self, today: date, day: int) -> None:
        """Demo reset: C's call clears typed values and reloads the mission with today = `day`.

        `today` is not used: the pipeline loads relative to the real clock. Takes a few seconds.
        """
        try:
            demo_reset(day)
        except _UNAVAILABLE as error:
            raise MetricsUnavailable(str(error)) from error


def _daily_means(points: list[Point], start: datetime, end: datetime) -> list[Point]:
    """One mean per mission day, for days that lie fully inside [start, end]."""
    by_day: dict[date, list[Point]] = {}
    for p in points:
        by_day.setdefault((p.at + _DAY_OFFSET).date(), []).append(p)
    out = []
    for day in sorted(by_day):
        if _day_start(day) < start or _day_start(day) + _DAY > end:
            continue
        pts = by_day[day]
        sources = {p.source for p in pts}
        out.append(
            Point(
                at=pts[-1].at,
                value=statistics.fmean(p.value for p in pts),
                source="manual" if "manual" in sources else pts[-1].source,
            )
        )
    return out
