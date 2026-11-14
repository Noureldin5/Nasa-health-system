"""Write points to VictoriaMetrics. Used by the simulator and by B's check-in endpoint.

    from datetime import datetime, timezone
    from pipeline.ingest import Point, write_points, flush

    write_points([
        Point("mood_score", 4, datetime.now(timezone.utc), {"crew_id": "a1", "source": "manual"}),
    ])
    flush()   # after a live check-in, before reading the chart back

Checks are structural only. A value is never rejected for being outside a health range.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

from pipeline import schema, vm

# Kept under this name for callers: VictoriaMetrics could not be reached.
IngestUnavailable = vm.VMUnavailable

_BATCH_POINTS = 5000
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
_MILLISECOND = timedelta(milliseconds=1)


def timestamp_ms(ts: datetime) -> int:
    """Milliseconds since the epoch, rounded down with integer arithmetic.

    Rounded down, never up: a point written at `now` must not be stored later than `now`,
    or reading it back with the same `now` would miss it.
    """
    return (ts - _EPOCH) // _MILLISECOND


class IngestError(ValueError):
    """A point does not fit the metric schema. Nothing from that call was written."""


@dataclass(frozen=True)
class Point:
    metric: str
    value: float
    ts: datetime  # timezone-aware
    labels: dict[str, str]  # must include "source" and the metric's required labels


def validate(point: Point) -> None:
    try:
        metric = schema.get(point.metric)
    except ValueError as error:
        raise IngestError(str(error)) from None

    expected = set(metric.labels) | {"source"}
    got = set(point.labels)
    if got != expected:
        missing = ", ".join(sorted(expected - got)) or "none"
        extra = ", ".join(sorted(got - expected)) or "none"
        raise IngestError(
            f"{point.metric}: labels must be exactly {sorted(expected)} (missing: {missing}; not allowed: {extra})"
        )
    for key, value in point.labels.items():
        try:
            schema.check_label_value(key, value)
        except ValueError as error:
            raise IngestError(f"{point.metric}: {error}") from None
    if point.labels["source"] not in schema.SOURCES:
        raise IngestError(f"{point.metric}: source must be one of {schema.SOURCES}, got {point.labels['source']!r}")

    if isinstance(point.value, bool) or not isinstance(point.value, (int, float)) or not math.isfinite(point.value):
        raise IngestError(f"{point.metric}: value must be a finite number, got {point.value!r}")
    if not isinstance(point.ts, datetime) or point.ts.tzinfo is None or point.ts.utcoffset() is None:
        raise IngestError(f"{point.metric}: ts must be a timezone-aware datetime, got {point.ts!r}")


def to_import_lines(points: Iterable[Point]) -> list[str]:
    """Validate the points and turn them into JSON lines for /api/v1/import, one line per series."""
    grouped: dict[tuple, tuple[dict[str, str], list[float], list[int]]] = {}
    for point in points:
        validate(point)
        key = (point.metric, tuple(sorted(point.labels.items())))
        if key not in grouped:
            grouped[key] = ({"__name__": point.metric, **point.labels}, [], [])
        _, values, timestamps = grouped[key]
        values.append(point.value)
        timestamps.append(timestamp_ms(point.ts))
    return [
        json.dumps({"metric": metric, "values": values, "timestamps": timestamps}, sort_keys=True)
        for metric, values, timestamps in grouped.values()
    ]


def write_points(points: Iterable[Point], *, base_url: str | None = None) -> int:
    """Write points and return how many were written.

    Raises IngestError before anything is sent if any point is invalid,
    and IngestUnavailable if VictoriaMetrics cannot be reached.
    """
    points = list(points)
    for point in points:
        validate(point)
    for offset in range(0, len(points), _BATCH_POINTS):
        vm.import_lines(to_import_lines(points[offset : offset + _BATCH_POINTS]), base_url=base_url)
    return len(points)


def flush(*, base_url: str | None = None) -> None:
    """Make just-written points readable now instead of a few seconds later.

    Demo shortcut: it calls a VictoriaMetrics debug endpoint (docs/DECISIONS.md, section 6).
    """
    vm.force_flush(base_url=base_url)
