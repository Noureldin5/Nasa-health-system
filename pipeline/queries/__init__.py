"""Read functions over VictoriaMetrics. B calls these and never writes MetricsQL.

    from pipeline.queries import series, latest

    points = series("hr_bpm", crew_id="a1", start=week_ago, end=now)
    mood = latest("mood_score", crew_id="a1")
    headache = latest("symptom_strength", crew_id="a1", labels={"symptom": "headache"})
    co2 = series("co2_ppm", labels={"module": "node1"}, start=week_ago, end=now)
    days = daily("hr_bpm", crew_id="a1", first_day=3, last_day=9)          # one row per mission day
    window = baseline_window("sleep_hours", crew_id="a1", through_day=9)   # mean and spread of 7 days

Cabin Link (CO2 against a symptom, with lag) is in pipeline.queries.cabin.

Every Sample carries its source ("sim", "nasa" or "manual") so the UI can label it.
"""

from __future__ import annotations

import statistics
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


@dataclass(frozen=True)
class DailyValue:
    """One mission day of a metric. For a daily metric mean, min and max are the same value."""

    day: int
    mean: float
    min: float
    max: float
    n: int  # samples that day
    sources: tuple[str, ...]  # for example ("sim",) or ("manual", "sim")
    # False for a 5-minute metric whose day is not over yet (today). A partial day is biased:
    # the simulated heart rate is lower at night, so a morning mean sits below a full-day mean.
    complete: bool = True


@dataclass(frozen=True)
class WindowStats:
    """Statistics over the daily means of a window of mission days. Input for B's baseline."""

    first_day: int
    last_day: int
    n_days: int  # days in the window that have data
    mean: float | None  # None when no day has data
    sd: float | None  # sample standard deviation of the daily means; None with fewer than 2 days
    min: float | None
    max: float | None


def daily(
    metric: str,
    *,
    first_day: int,
    last_day: int,
    crew_id: str | None = None,
    labels: dict[str, str] | None = None,
    mission_start: datetime | None = None,
    now: datetime | None = None,
    base_url: str | None = None,
) -> list[DailyValue]:
    """One row per mission day from first_day to last_day (both included). Days without data are left out.

    5-minute metrics are aggregated per mission day. Daily metrics follow the daily-value rule.
    """
    if first_day > last_day:
        raise ValueError("first_day must not be after last_day")
    if mission_start is None:
        mission_start = mission.mission_start(base_url=base_url)
    start, _ = mission.day_window(first_day, mission_start)
    _, end = mission.day_window(last_day, mission_start)
    samples = series(
        metric, start=start, end=end, crew_id=crew_id, labels=labels, mission_start=mission_start, base_url=base_url
    )
    by_day: dict[int, list[Sample]] = {}
    for sample in samples:
        by_day.setdefault(mission.mission_day(sample.ts, mission_start), []).append(sample)
    now = _aware("now", now) if now is not None else datetime.now(timezone.utc)
    five_min = schema.get(metric).cadence == schema.FIVE_MIN
    rows = []
    for day in sorted(by_day):
        values = [sample.value for sample in by_day[day]]
        rows.append(
            DailyValue(
                day=day,
                mean=statistics.fmean(values),
                min=min(values),
                max=max(values),
                n=len(values),
                sources=tuple(sorted({sample.source for sample in by_day[day]})),
                complete=not five_min or mission.day_window(day, mission_start)[1] <= now,
            )
        )
    return rows


def window_stats(rows: list[DailyValue], first_day: int, last_day: int) -> WindowStats:
    """Pure: statistics over the daily means of the rows inside the window."""
    means = [row.mean for row in rows if first_day <= row.day <= last_day]
    return WindowStats(
        first_day=first_day,
        last_day=last_day,
        n_days=len(means),
        mean=statistics.fmean(means) if means else None,
        sd=statistics.stdev(means) if len(means) >= 2 else None,
        min=min(means) if means else None,
        max=max(means) if means else None,
    )


def baseline_window(
    metric: str,
    *,
    through_day: int,
    days: int = 7,
    crew_id: str | None = None,
    labels: dict[str, str] | None = None,
    mission_start: datetime | None = None,
    complete_only: bool = True,
    now: datetime | None = None,
    base_url: str | None = None,
) -> WindowStats:
    """Mean and spread of the `days` mission days that end with `through_day` (included).

    A day that is not over yet (today, for a 5-minute metric) is left out unless `complete_only=False`,
    so `n_days` counts finished days only. This only measures the window. What counts as drift is B's decision in api/domain/.
    The default of 7 days matches the calibration period in docs/REQUIREMENTS.md U3 (Demo parameter).
    """
    if days < 1:
        raise ValueError("days must be at least 1")
    first_day = through_day - days + 1
    rows = daily(
        metric, first_day=first_day, last_day=through_day, crew_id=crew_id, labels=labels,
        mission_start=mission_start, now=now, base_url=base_url,
    )
    if complete_only:
        rows = [row for row in rows if row.complete]
    return window_stats(rows, first_day, through_day)
