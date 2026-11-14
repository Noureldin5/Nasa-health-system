"""What a "day" is for the API.

A mission day runs 18:00 UTC to 18:00 UTC, which is midnight to midnight in Bishkek (UTC+6).
This matches the pipeline (docs/DECISIONS.md section 4 and section 10 row 9). Every place that
says "day" calls `mission_date`. Never use `ts.date()` on a UTC timestamp.

Pure. No I/O, no clock.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

# Demo parameter: the simulator starts mission days at midnight Bishkek time, 6 hours ahead of UTC.
DAY_OFFSET = timedelta(hours=6)


def mission_date(ts: datetime) -> date:
    """The mission day a naive UTC timestamp belongs to, as a calendar date."""
    return (ts + DAY_OFFSET).date()
