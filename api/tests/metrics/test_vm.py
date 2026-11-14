"""VmMetrics against a live VictoriaMetrics. Skipped when it is down (start it with `make up`).

Uses a throwaway crew id and deletes what it writes, so a loaded demo mission is untouched.
"""

from datetime import datetime, timedelta

import pytest

from metrics.port import MetricsUnavailable
from metrics.vm import VmMetrics, _daily_means
from schemas import Point

pytestmark = pytest.mark.integration


def _vm_up() -> bool:
    from pipeline import vm

    try:
        vm.request("/health")
        return True
    except vm.VMUnavailable:
        return False


needs_vm = pytest.mark.skipif(not _vm_up(), reason="VictoriaMetrics is not running")

CREW = "zz-test"
NOW = datetime(2026, 11, 14, 9, 0)


@pytest.fixture
def cleanup():
    yield
    from pipeline import vm

    vm.delete_series('{crew_id="zz-test"}')
    vm.reset_cache()


@needs_vm
def test_written_values_read_back_as_manual(cleanup):
    m = VmMetrics()
    m.write(CREW, {"mood": 4, "headache": 2, "glucose": 91}, NOW)
    for key, value in (("mood", 4), ("headache", 2), ("glucose", 91)):
        pts = m.series(CREW, key, NOW - timedelta(hours=1), NOW)  # `end` itself is included
        assert [(p.at, p.value, p.source) for p in pts] == [(NOW, value, "manual")]


def test_unreachable_store_raises_metrics_unavailable(monkeypatch):
    monkeypatch.setenv("VM_URL", "http://127.0.0.1:9")
    with pytest.raises(MetricsUnavailable):
        VmMetrics().series("a1", "mood", NOW - timedelta(days=1), NOW)
    with pytest.raises(MetricsUnavailable):
        VmMetrics().write("a1", {"mood": 3}, NOW)


def _pts(first: datetime, n: int, value: float) -> list[Point]:
    return [Point(at=first + timedelta(minutes=5 * i), value=value, source="sim") for i in range(n)]


def test_five_minute_points_become_one_mean_per_complete_mission_day():
    # Mission day 2026-11-13 runs 2026-11-12 18:00 to 2026-11-13 18:00 UTC.
    day = _pts(datetime(2026, 11, 12, 18, 0), 288, 60) + _pts(datetime(2026, 11, 13, 18, 0), 100, 99)
    out = _daily_means(day, datetime(2026, 11, 1), datetime(2026, 11, 14, 9, 0))
    assert len(out) == 1  # today's partial day is dropped
    assert out[0].value == 60
    assert out[0].at == datetime(2026, 11, 13, 17, 55)
