"""In-memory stand-in for VictoriaMetrics with a scripted, deterministic mission.

All values are SIMULATED (source "sim"). Demo parameters, not medical data. The story mirrors
docs/USER-FLOW.md: days 1-7 steady, CO2 rises on day 8, headaches on days 9-11 for a1, recovery
after. Others stay steady.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from metrics.port import MetricsUnavailable
from schemas import IndicatorKey, Point

CREW_IDS = ("a1", "a2", "a3")
_NOISE = (0, 1, -1, 2, -2, 1, -1, 0, 1)

# Demo parameter: scripted CO2 (ppm) and headache (0 none to 3 strong) for the story crew.
_CO2_STORY = {8: 1500, 9: 1600, 10: 1500, 11: 1100}
_HEADACHE_STORY = {9: 1, 10: 2, 11: 1}


def _n(i: int) -> int:
    return _NOISE[i % len(_NOISE)]


def _daily_values(crew_index: int, crew_id: str, d: int) -> dict[IndicatorKey, float]:
    i = d + crew_index
    story = crew_id == "a1"
    shared_co2 = crew_id in ("a1", "a2")
    return {
        "heart_rate": 62 + 2 * crew_index + _n(i),
        "sleep_hours": 7.5 + 0.2 * _n(d),
        "mood": 4,
        "body_temp": 36.6 + 0.05 * _n(i),
        "glucose": 90 + _n(i),
        "bp_systolic": 118 + _n(i),
        "bp_diastolic": 76 + 0.5 * _n(i),
        "headache": _HEADACHE_STORY.get(d, 0) if story else 0,
        "co2": _CO2_STORY.get(d, 800 + 20 * _n(d)) if shared_co2 else 800 + 20 * _n(d),
    }


class FakeMetrics:
    def __init__(self) -> None:
        self._points: dict[tuple[str, IndicatorKey], list[Point]] = {}
        self.fail = False  # tests flip this to simulate VictoriaMetrics being down

    def _check(self) -> None:
        if self.fail:
            raise MetricsUnavailable("fake metrics store is marked unavailable")

    def series(
        self, crew_id: str, key: IndicatorKey, start: datetime, end: datetime
    ) -> list[Point]:
        self._check()
        pts = self._points.get((crew_id, key), [])
        return sorted((p for p in pts if start <= p.at <= end), key=lambda p: p.at)

    def write(self, crew_id: str, values: dict[IndicatorKey, float], at: datetime) -> None:
        self._check()
        for key, value in values.items():
            self._points.setdefault((crew_id, key), []).append(
                Point(at=at, value=float(value), source="sim")
            )

    def seed(self, today: date, day: int) -> None:
        """Mission day `day` is real `today`. Days 1..day-1 are already recorded at 07:30."""
        if day < 1:
            raise ValueError("mission day must be 1 or more")
        self._points = {}
        for crew_index, crew_id in enumerate(CREW_IDS):
            for d in range(1, day):
                when = datetime.combine(today - timedelta(days=day - d), datetime.min.time())
                at = when + timedelta(hours=7, minutes=30)
                for key, value in _daily_values(crew_index, crew_id, d).items():
                    self._points.setdefault((crew_id, key), []).append(
                        Point(at=at, value=float(value), source="sim")
                    )
