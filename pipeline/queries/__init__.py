"""Read functions over VictoriaMetrics. B calls these and never writes MetricsQL.

    from pipeline.queries import series, latest

    points = series("hr_bpm", crew_id="a1", start=week_ago, end=now)
    mood = latest("mood_score", crew_id="a1")
    headache = latest("symptom_strength", crew_id="a1", labels={"symptom": "headache"})
    co2 = series("co2_ppm", labels={"module": "node1"}, start=week_ago, end=now)

Every Sample carries its source ("sim", "nasa" or "manual") so the UI can label it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from pipeline import mission, schema, vm


@dataclass(frozen=True)
class Sample:
    ts: datetime  # UTC, timezone-aware
    value: float
    source: str


# latest() looks this far back first, then over the whole retention period.
_RECENT = timedelta(days=2)
_RETENTION = timedelta(days=90)  # matches -retentionPeriod in deploy/docker-compose.yml


def _series_labels(metric: schema.Metric, crew_id: str | None, labels: dict[str, str] | None) -> dict[str, str]:
    """Labels that pick exactly one logical series (all sources of it)."""
    chosen = dict(labels or {})
    if crew_id is not None:
        chosen["crew_id"] = crew_id
    if "source" in chosen:
        raise ValueError("do not filter by source: results are merged across sources and each Sample says its own")
    if set(chosen) != set(metric.labels):
        needed = ", ".join(metric.labels)
        raise ValueError(f"{metric.name} needs exactly these labels: {needed}. Got: {sorted(chosen)}")
    for key, value in chosen.items():
        schema.check_label_value(key, value)  # values often come from a URL; keep them out of the selector unchecked
    return chosen


def _aware(name: str, moment: datetime) -> datetime:
    if moment.tzinfo is None:
        raise ValueError(f"{name} must be a timezone-aware datetime")
    return moment


def _fetch(metric: schema.Metric, chosen: dict[str, str], start: datetime, end: datetime, base_url: str | None):
    rows = vm.export(vm.selector(metric.name, chosen), start, end, base_url=base_url)
    samples = [
        Sample(datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc), value, labels.get("source", ""))
        for labels, timestamp_ms, value in rows
    ]
    # The same point written twice (a reload without a delete) comes back twice. Keep one.
    samples = list(dict.fromkeys(samples))
    samples.sort(key=_order)
    return samples


def _order(sample: Sample) -> tuple[datetime, int]:
    return sample.ts, schema.SOURCE_PRIORITY.get(sample.source, -1)


def one_per_mission_day(samples: list[Sample], mission_start: datetime) -> list[Sample]:
    """Daily-value rule (docs/DECISIONS.md, section 3): per mission day keep the latest sample.

    On equal timestamps a value a person typed wins over a simulated one.
    """
    best: dict[int, Sample] = {}
    for sample in samples:
        day = mission.mission_day(sample.ts, mission_start)
        if day not in best or _order(sample) >= _order(best[day]):
            best[day] = sample
    return [best[day] for day in sorted(best)]


def series(
    metric: str,
    *,
    start: datetime,
    end: datetime,
    crew_id: str | None = None,
    labels: dict[str, str] | None = None,
    mission_start: datetime | None = None,
    base_url: str | None = None,
) -> list[Sample]:
    """Samples with start <= ts < end, sorted by time, merged across sources.

    Daily metrics come back as one sample per mission day. 5-minute metrics come back raw.
    `mission_start` is only needed for daily metrics; without it the stored start is read.
    """
    definition = schema.get(metric)
    chosen = _series_labels(definition, crew_id, labels)
    start, end = _aware("start", start), _aware("end", end)

    samples = [s for s in _fetch(definition, chosen, start, end, base_url) if start <= s.ts < end]
    if definition.cadence == schema.DAILY and samples:
        if mission_start is None:
            mission_start = mission.mission_start(base_url=base_url)
        samples = one_per_mission_day(samples, mission_start)
    return samples


def latest(
    metric: str,
    *,
    crew_id: str | None = None,
    labels: dict[str, str] | None = None,
    at: datetime | None = None,
    base_url: str | None = None,
) -> Sample | None:
    """The newest sample at or before `at` (default: now), or None if there is none."""
    definition = schema.get(metric)
    chosen = _series_labels(definition, crew_id, labels)
    at = _aware("at", at) if at is not None else datetime.now(timezone.utc)

    for lookback in (_RECENT, _RETENTION):
        samples = [s for s in _fetch(definition, chosen, at - lookback, at, base_url) if s.ts <= at]
        if samples:
            return samples[-1]
    return None
