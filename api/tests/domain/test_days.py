from datetime import date, datetime

from domain.days import mission_date


def test_mission_day_runs_from_1800_utc_to_1800_utc():
    # docs/DECISIONS.md section 4: a mission day is midnight to midnight in Bishkek (UTC+6).
    assert mission_date(datetime(2026, 11, 13, 17, 59, 59)) == date(2026, 11, 13)
    assert mission_date(datetime(2026, 11, 13, 18, 0, 0)) == date(2026, 11, 14)
    assert mission_date(datetime(2026, 11, 14, 17, 59, 59)) == date(2026, 11, 14)


def test_morning_readings_stay_on_their_own_day():
    # Simulated sleep and check-in values are stamped at 07:30 UTC. That is mission day N, not N-1.
    assert mission_date(datetime(2026, 11, 14, 7, 30)) == date(2026, 11, 14)
    assert mission_date(datetime(2026, 11, 14, 0, 30)) == date(2026, 11, 14)
