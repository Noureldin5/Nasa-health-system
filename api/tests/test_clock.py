import time
from datetime import UTC, datetime, timedelta

from clock import Clock


def test_real_clock_keeps_sub_second_resolution():
    # Items written within one second of a sync must still be ordered after it.
    clock = Clock()
    assert any(clock.now().microsecond for _ in range(50))


def test_real_clock_is_utc_whatever_the_machine_timezone(monkeypatch):
    # docs/DECISIONS.md section 4: all timestamps are UTC. Bishkek is UTC+6.
    monkeypatch.setenv("TZ", "Asia/Bishkek")
    time.tzset()
    try:
        utc_now = datetime.now(UTC).replace(tzinfo=None)
        assert abs(Clock().now() - utc_now) < timedelta(seconds=2)
    finally:
        monkeypatch.undo()
        time.tzset()


def test_fixed_clock_returns_the_pinned_moment_until_released():
    clock = Clock()
    pinned = datetime(2026, 11, 14, 9, 0)
    clock.set(pinned)
    assert clock.now() == pinned
    clock.release()
    assert clock.now() != pinned
