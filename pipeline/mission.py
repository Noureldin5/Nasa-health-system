"""Mission clock (docs/DECISIONS.md, section 4).

A mission day is a 24-hour window counted from mission_start. Never derive it from
the calendar date: always call mission_day().

mission_start is stored in VictoriaMetrics as the internal series
`mission_start_seconds{source="sim"}`, so it is replaced together with the simulated
mission and there is no second store to keep in step.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from pipeline import vm

MISSION_START_METRIC = "mission_start_seconds"
DAY = timedelta(days=1)
# How far back to look for the stored start. Matches -retentionPeriod in deploy/docker-compose.yml.
_LOOKBACK = timedelta(days=90)


class MissionNotLoaded(RuntimeError):
    """No simulated mission is loaded, so there is no mission start."""


def mission_day(ts: datetime, start: datetime | None = None, *, base_url: str | None = None) -> int:
    """Mission day of a moment: 1 on the first day. Zero or negative before the start.

    Pass `start` to avoid a lookup (and in tests). Without it the stored start is read.
    """
    if start is None:
        start = mission_start(base_url=base_url)
    return (ts - start) // DAY + 1


def day_window(day: int, start: datetime) -> tuple[datetime, datetime]:
    """Start (inclusive) and end (exclusive) of a mission day."""
    begin = start + (day - 1) * DAY
    return begin, begin + DAY


def mission_start(*, base_url: str | None = None, now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    samples = vm.export(
        vm.selector(MISSION_START_METRIC, {}), now - _LOOKBACK, now + 2 * DAY, base_url=base_url
    )
    if not samples:
        raise MissionNotLoaded(
            "No mission is loaded. Load one with `make sample` (python3 -m pipeline.simulator)."
        )
    _, _, value = max(samples, key=lambda sample: sample[1])
    return datetime.fromtimestamp(value, tz=timezone.utc)


def set_mission_start(start: datetime, *, base_url: str | None = None) -> None:
    """Store the mission start. Called by the simulator after it clears the old mission."""
    if start.tzinfo is None:
        raise ValueError("mission start must be timezone-aware")
    line = (
        '{"metric":{"__name__":"%s","source":"sim"},"values":[%d],"timestamps":[%d]}'
        % (MISSION_START_METRIC, int(start.timestamp()), int(start.timestamp() * 1000))
    )
    vm.import_lines([line], base_url=base_url)
