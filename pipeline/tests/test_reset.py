from datetime import datetime, timedelta, timezone

import pytest

from pipeline import reset
from pipeline.ingest import Point, flush, write_points
from pipeline.queries import latest


@pytest.mark.vm
def test_clear_manual_removes_typed_values_and_keeps_simulated_ones(test_id):
    now = datetime.now(timezone.utc).replace(microsecond=0)
    write_points(
        [
            Point("mood_score", 2, now, {"crew_id": test_id, "source": "manual"}),
            Point("sleep_hours", 7, now, {"crew_id": test_id, "source": "sim"}),
        ]
    )
    flush()
    assert latest("mood_score", crew_id=test_id, at=now + timedelta(seconds=1)).source == "manual"
    assert reset.count_manual(crew_id=test_id) == (1, 1)

    assert reset.clear_manual(crew_id=test_id) == (1, 1)
    assert latest("mood_score", crew_id=test_id, at=now + timedelta(seconds=1)) is None
    assert latest("sleep_hours", crew_id=test_id, at=now + timedelta(seconds=1)).source == "sim"
    assert reset.clear_manual(crew_id=test_id) == (0, 0)
