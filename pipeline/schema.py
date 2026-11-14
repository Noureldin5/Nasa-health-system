"""Metric schema: the machine-readable twin of docs/DECISIONS.md, section 2.

If this file and the table in DECISIONS.md disagree, fix both in one shared/ PR.
pipeline/tests/test_schema.py fails when the metric names drift apart.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Who wrote the point. Required on every series so the UI can label it.
#   sim     written by the simulator, shown as "Simulated"
#   nasa    taken from a NASA dataset
#   manual  typed by a person in the app (OPEN 2 in docs/DECISIONS.md)
SOURCES = ("sim", "nasa", "manual")

# When two samples of a daily metric share a timestamp, the one a person typed wins.
SOURCE_PRIORITY = {"sim": 0, "nasa": 1, "manual": 2}

FIVE_MIN = "5min"
DAILY = "daily"


@dataclass(frozen=True)
class Metric:
    name: str
    unit: str
    labels: tuple[str, ...]  # required labels besides "source"
    cadence: str  # FIVE_MIN or DAILY


_ALL = (
    Metric("hr_bpm", "beats per minute", ("crew_id",), FIVE_MIN),
    Metric("sleep_hours", "hours slept last night", ("crew_id",), DAILY),
    Metric("bp_systolic_mmhg", "mmHg", ("crew_id",), DAILY),
    Metric("bp_diastolic_mmhg", "mmHg", ("crew_id",), DAILY),
    Metric("glucose_mg_dl", "mg/dL", ("crew_id",), DAILY),
    Metric("body_temp_c", "degrees Celsius", ("crew_id",), DAILY),
    # Scales below come from the check-in in docs/USER-FLOW.md. They define the scale,
    # they are not health thresholds.
    Metric("mood_score", "1 (worst) to 5 (best)", ("crew_id",), DAILY),
    Metric("symptom_strength", "0 none, 1 mild, 2 moderate, 3 strong", ("crew_id", "symptom"), DAILY),
    Metric("co2_ppm", "parts per million", ("module",), FIVE_MIN),
)

METRICS: dict[str, Metric] = {metric.name: metric for metric in _ALL}


_LABEL_VALUE = re.compile(r"[A-Za-z0-9_.-]+")


def check_label_value(key: str, value: object) -> None:
    """Label values are short ids. The same rule applies when writing and when reading."""
    if not isinstance(value, str) or not _LABEL_VALUE.fullmatch(value):
        raise ValueError(f"label {key}={value!r} must be letters, digits, '_', '-' or '.'")


def get(name: str) -> Metric:
    try:
        return METRICS[name]
    except KeyError:
        known = ", ".join(sorted(METRICS))
        raise ValueError(f"unknown metric {name!r}. Known metrics: {known}") from None
