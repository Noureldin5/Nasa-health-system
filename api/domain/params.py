"""Tunable numbers for baseline, drift and alerts.

None of these has a medical source. Every one is a Demo parameter (CLAUDE.md rule 7) and the
API marks bands built from them with `demo_parameter: true`. Record changes in docs/DECISIONS.md.
"""

from __future__ import annotations

from schemas import IndicatorKey

# Demo parameter: days of data before the personal baseline counts as ready (U3).
CALIBRATION_DAYS = 7
# Demo parameter: how many days back the baseline looks.
BASELINE_WINDOW_DAYS = 14
# Demo parameter: band half-width in standard deviations.
BAND_K = 2.0
# Demo parameter: drift means outside the band on this many of the last DRIFT_WINDOW days.
DRIFT_DAYS = 2
DRIFT_WINDOW = 3
# Demo parameter: a headache pattern is mild or more on this many of the last 3 days.
HEADACHE_DAYS = 2
# Demo parameter: an alert closes after this many days in a row back inside the band.
ALERT_CLOSE_DAYS = 2
# Demo parameter: alerts shown per day, the rest wait in "Worth checking".
ALERTS_PER_DAY = 1

# Demo parameter: smallest half-width of a band, so a very steady series does not flag noise.
MIN_SPREAD: dict[IndicatorKey, float] = {
    "heart_rate": 3.0,
    "sleep_hours": 0.5,
    "mood": 0.5,
    "body_temp": 0.2,
    "glucose": 5.0,
    "bp_systolic": 4.0,
    "bp_diastolic": 4.0,
    "headache": 0.5,
    "co2": 100.0,
}

UNITS: dict[IndicatorKey, str] = {
    "heart_rate": "bpm",
    "sleep_hours": "h",
    "mood": "of 5",
    "body_temp": "°C",
    "glucose": "mg/dL",
    "bp_systolic": "mmHg",
    "bp_diastolic": "mmHg",
    "headache": "0-3",
    "co2": "ppm",
}
