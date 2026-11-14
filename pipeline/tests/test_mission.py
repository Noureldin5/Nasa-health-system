from datetime import datetime, timedelta, timezone

import pytest

from pipeline import mission, vm
from pipeline.mission import DAY, MissionNotLoaded, day_window, mission_day

START = datetime(2026, 11, 1, 18, 0, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "offset, day",
    [
        (timedelta(0), 1),
        (DAY - timedelta(milliseconds=1), 1),
        (DAY, 2),
        (9 * DAY + timedelta(hours=7.5), 10),
        (-timedelta(seconds=1), 0),
        (-DAY - timedelta(seconds=1), -1),
    ],
)
def test_mission_day(offset, day):
    assert mission_day(START + offset, START) == day


def test_mission_day_ignores_the_callers_time_zone():
    bishkek = timezone(timedelta(hours=6))
    moment = START + timedelta(hours=1)
    assert mission_day(moment.astimezone(bishkek), START) == mission_day(moment, START) == 1


def test_day_window_matches_mission_day():
    begin, end = day_window(10, START)
    assert mission_day(begin, START) == 10
    assert mission_day(end - timedelta(milliseconds=1), START) == 10
    assert mission_day(end, START) == 11


@pytest.mark.vm
def test_mission_start_round_trip(monkeypatch):
    # Uses a throwaway series name so a mission loaded for development keeps its start.
    monkeypatch.setattr(mission, "MISSION_START_METRIC", "test_mission_start_seconds")
    match = '{__name__="test_mission_start_seconds"}'
    vm.delete_series(match)
    try:
        with pytest.raises(MissionNotLoaded, match="make sample"):
            mission.mission_start()

        start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) - 9 * DAY
        mission.set_mission_start(start)
        vm.force_flush()

        assert mission.mission_start() == start
        assert mission_day(datetime.now(timezone.utc)) == 10
    finally:
        vm.delete_series(match)


def test_mission_start_must_be_timezone_aware():
    with pytest.raises(ValueError, match="timezone-aware"):
        mission.set_mission_start(datetime(2026, 11, 1, 18, 0))
