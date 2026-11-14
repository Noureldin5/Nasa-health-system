"""The only door to time series data. C implements the real one in `pipeline/` (Task 10).

B never writes raw MetricsQL: the adapter for VictoriaMetrics calls C's query functions.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Protocol

from schemas import IndicatorKey, Point


class MetricsUnavailable(Exception):
    """The time series store cannot be reached. Views fall back to text records only."""


class MetricsPort(Protocol):
    def series(
        self, crew_id: str, key: IndicatorKey, start: datetime, end: datetime
    ) -> list[Point]:
        """Raw points with `start <= at <= end`, oldest first. Raises MetricsUnavailable."""
        ...

    def write(self, crew_id: str, values: dict[IndicatorKey, float], at: datetime) -> None:
        """Append one point per key at time `at`. Raises MetricsUnavailable."""
        ...

    def seed(self, today: date, day: int) -> None:
        """Demo reset: replace data with the scripted mission so real `today` is mission day `day`."""
        ...
