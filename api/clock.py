"""Time source. The domain never reads the clock; routes and services pass `now` in.

Real time by default. Tests (and demo rehearsals) can pin it with `set`.
"""

from __future__ import annotations

from datetime import UTC, datetime


class Clock:
    def __init__(self) -> None:
        self._fixed: datetime | None = None

    def now(self) -> datetime:
        """Naive UTC (docs/DECISIONS.md section 4). Keeps microseconds so a write right after a
        sync sorts after it."""
        return self._fixed or datetime.now(UTC).replace(tzinfo=None)

    def set(self, moment: datetime) -> None:
        self._fixed = moment

    def release(self) -> None:
        self._fixed = None
