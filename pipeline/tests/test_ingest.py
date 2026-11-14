import json
from datetime import datetime, timedelta, timezone

import pytest

from pipeline import vm
from pipeline.ingest import IngestError, IngestUnavailable, Point, flush, to_import_lines, validate, write_points
from pipeline.queries import latest, series

T0 = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)
OK = {"crew_id": "a1", "source": "sim"}


def test_valid_point_passes():
    validate(Point("hr_bpm", 62, T0, OK))
    validate(Point("symptom_strength", 2, T0, {**OK, "symptom": "headache"}))
    validate(Point("co2_ppm", 2500.5, T0, {"module": "node1", "source": "sim"}))


@pytest.mark.parametrize(
    "point, message",
    [
        (Point("heart_rate", 62, T0, OK), "unknown metric"),
        (Point("hr_bpm", 62, T0, {"crew_id": "a1"}), "missing: source"),
        (Point("hr_bpm", 62, T0, {"source": "sim"}), "missing: crew_id"),
        (Point("hr_bpm", 62, T0, {**OK, "via": "checkin"}), "not allowed: via"),
        (Point("symptom_strength", 1, T0, OK), "missing: symptom"),
        (Point("co2_ppm", 2500, T0, OK), "missing: module"),
        (Point("hr_bpm", 62, T0, {"crew_id": "a1", "source": "real"}), "source must be one of"),
        (Point("hr_bpm", 62, T0, {"crew_id": 'a"1', "source": "sim"}), "must be letters"),
        (Point("hr_bpm", 62, T0, {"crew_id": "a1\n", "source": "sim"}), "must be letters"),
        (Point("hr_bpm", float("nan"), T0, OK), "finite number"),
        (Point("hr_bpm", float("inf"), T0, OK), "finite number"),
        (Point("hr_bpm", "62", T0, OK), "finite number"),
        (Point("hr_bpm", True, T0, OK), "finite number"),
        (Point("hr_bpm", 62, datetime(2026, 11, 10, 12, 0), OK), "timezone-aware"),
    ],
)
def test_bad_point_is_rejected(point, message):
    with pytest.raises(IngestError, match=message):
        validate(point)


def test_health_range_is_not_checked():
    # Decision support, not a gate: an alarming value must still be stored.
    validate(Point("hr_bpm", 210, T0, OK))
    validate(Point("glucose_mg_dl", 20, T0, OK))


def test_import_lines_group_points_by_series_in_milliseconds():
    points = [
        Point("hr_bpm", 60, T0, OK),
        Point("hr_bpm", 61, T0 + timedelta(minutes=5), OK),
        Point("hr_bpm", 70, T0, {"crew_id": "a2", "source": "sim"}),
    ]
    lines = [json.loads(line) for line in to_import_lines(points)]
    assert lines == [
        {
            "metric": {"__name__": "hr_bpm", "crew_id": "a1", "source": "sim"},
            "values": [60, 61],
            "timestamps": [1794312000000, 1794312300000],
        },
        {"metric": {"__name__": "hr_bpm", "crew_id": "a2", "source": "sim"}, "values": [70], "timestamps": [1794312000000]},
    ]


def test_timestamps_in_other_zones_are_converted():
    bishkek = timezone(timedelta(hours=6))
    (line,) = to_import_lines([Point("hr_bpm", 60, T0.astimezone(bishkek), OK)])
    assert json.loads(line)["timestamps"] == [1794312000000]


def test_timestamps_are_rounded_down_to_the_millisecond():
    late = T0.replace(microsecond=1999)  # 1.999 ms: rounding to nearest would store 2 ms, after the moment itself
    (line,) = to_import_lines([Point("hr_bpm", 60, late, OK)])
    assert json.loads(line)["timestamps"] == [1794312000001]


def test_one_bad_point_means_nothing_is_sent():
    points = [Point("hr_bpm", 60, T0, OK), Point("hr_bpm", 61, T0, {"crew_id": "a1"})]
    with pytest.raises(IngestError):
        write_points(points, base_url="http://127.0.0.1:1")  # would raise IngestUnavailable if it tried to send


def test_unreachable_server_raises_ingest_unavailable():
    with pytest.raises(IngestUnavailable, match="not reachable"):
        write_points([Point("hr_bpm", 60, T0, OK)], base_url="http://127.0.0.1:1")


@pytest.mark.vm
def test_written_points_can_be_read_back(test_id):
    now = datetime.now(timezone.utc).replace(microsecond=0)
    labels = {"crew_id": test_id, "source": "sim"}
    written = write_points([Point("hr_bpm", 60 + i, now - timedelta(minutes=5 * i), labels) for i in range(3)])
    flush()

    assert written == 3
    got = series("hr_bpm", crew_id=test_id, start=now - timedelta(hours=1), end=now + timedelta(seconds=1))
    assert [(s.ts, s.value, s.source) for s in got] == [
        (now - timedelta(minutes=10), 62.0, "sim"),
        (now - timedelta(minutes=5), 61.0, "sim"),
        (now, 60.0, "sim"),
    ]


@pytest.mark.vm
def test_live_check_in_is_readable_right_after_flush(test_id):
    # The demo path: a value typed now must be on the chart without waiting.
    now = datetime.now(timezone.utc)
    write_points([Point("mood_score", 4, now, {"crew_id": test_id, "source": "manual"})])
    flush()

    sample = latest("mood_score", crew_id=test_id)
    assert sample is not None and (sample.value, sample.source) == (4.0, "manual")
    assert abs(sample.ts - now) < timedelta(milliseconds=2)


@pytest.mark.vm
def test_check_in_is_found_when_written_and_read_with_the_same_now(test_id):
    # B takes the time once at the edge and uses it for the write and the read.
    now = datetime.now(timezone.utc).replace(microsecond=123600)  # .6 ms would round up past `now`
    write_points([Point("mood_score", 2, now, {"crew_id": test_id, "source": "manual"})])
    flush()

    assert latest("mood_score", crew_id=test_id, at=now).value == 2.0
    got = series("mood_score", crew_id=test_id, start=now - timedelta(hours=1), end=now + timedelta(seconds=1), mission_start=now - timedelta(hours=2))
    assert [s.value for s in got] == [2.0]


@pytest.mark.vm
def test_writing_does_not_touch_other_series(test_id):
    assert latest("hr_bpm", crew_id=test_id) is None
    assert vm.export(vm.selector("hr_bpm", {"crew_id": test_id}), T0, datetime.now(timezone.utc)) == []
