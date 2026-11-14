from datetime import datetime

from clock import Clock


def test_real_clock_keeps_sub_second_resolution():
    # Items written within one second of a sync must still be ordered after it.
    clock = Clock()
    assert any(clock.now().microsecond for _ in range(50))


def test_fixed_clock_returns_the_pinned_moment_until_released():
    clock = Clock()
    pinned = datetime(2026, 11, 14, 9, 0)
    clock.set(pinned)
    assert clock.now() == pinned
    clock.release()
    assert clock.now() != pinned
