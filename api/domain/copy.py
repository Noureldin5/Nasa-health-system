"""User-facing wording for alerts and the daily readout.

Decision support, not diagnosis: say "possible", "worth checking", "compare with your usual".
Never "you have" or a disease name (space-health-domain skill). Examples follow
docs/USER-FLOW.md.
"""

from __future__ import annotations

from schemas import IndicatorKey

LABELS: dict[IndicatorKey, str] = {
    "heart_rate": "heart rate",
    "sleep_hours": "sleep",
    "mood": "mood",
    "body_temp": "body temperature",
    "glucose": "blood sugar",
    "bp_systolic": "blood pressure (top number)",
    "bp_diastolic": "blood pressure (bottom number)",
    "headache": "headache",
    "co2": "cabin CO2",
}

DRIFT_NEXT_STEP: dict[IndicatorKey, str] = {
    "sleep_hours": (
        "Try moving screen time out of the hour before sleep and keep a regular sleep slot."
    ),
    "heart_rate": "Rest for a few minutes, then measure again and compare with your usual.",
    "mood": "Take a short break you enjoy and note what changed in your day.",
    "body_temp": "Measure again in an hour and compare with your usual.",
    "glucose": "Measure again at your next meal slot and compare with your usual.",
    "bp_systolic": "Rest seated for five minutes, then measure again.",
    "bp_diastolic": "Rest seated for five minutes, then measure again.",
    "headache": "Drink water, rest your eyes and note when it comes on.",
    "co2": "Ask for a ventilation check and move to a better-ventilated module.",
}

DRIFT_CONTACT = (
    "Contact the flight surgeon if it keeps going for 2 more days, or if you feel unwell."
)
HEADACHE_CONTACT = (
    "Contact the flight surgeon if the headache is strong, or comes with vision changes."
)

HEADACHE_WITH_CO2 = (
    "Headaches on {n} of the last 3 days. Cabin CO2 was above your module's usual level "
    "on those days. This is a pattern to check, not a cause."
)
HEADACHE_ALONE = "Headaches on {n} of the last 3 days. This is a pattern to check, not a cause."
HEADACHE_STEP_WITH_CO2 = (
    "Ask for a ventilation check and take a break in a better-ventilated module."
)

DRIFT_CHANGED = (
    "Your {label} was {direction} than your usual on {days} of the last 3 days "
    "(latest {latest:g} {unit}). This is worth checking, not a conclusion."
)

HEADLINE_ALL_USUAL = "All in your usual range"
HEADLINE_UNAVAILABLE = "Some readings are unavailable right now"
HEADLINE_LEARNING = "Learning your baseline: day {day} of {total}"
HEADLINE_WORTH_ONE = "1 thing worth checking"
HEADLINE_WORTH_MANY = "{n} things worth checking"

TIP_CARD = "Open the card marked worth checking and compare it with your usual range."
TIP_USUAL = "Try moving screen time out of the hour before sleep."
TIP_LEARNING = "Check in each day. Your own usual range appears after {total} days."
TIP_UNAVAILABLE = "Your check-in is saved. Readings will fill in when the data link is back."
