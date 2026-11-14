"""Load a simulated mission into VictoriaMetrics.

    python3 -m pipeline.simulator --days 3 --crew a1 --seed 42

Loading replaces the mission: every source="sim" series is deleted first, then written
again, so running it twice never doubles the data. Values typed in the app
(source="manual") are not touched.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import datetime, timezone

from pipeline import mission, vm
from pipeline.ingest import flush, write_points
from pipeline.simulator import DAY_START_UTC_HOUR, MissionPlan, generate, start_for


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m pipeline.simulator", description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=3, help="mission days to generate (default 3)")
    parser.add_argument("--crew", default="a1", help="comma-separated crew ids (default a1)")
    parser.add_argument("--seed", type=int, default=42, help="same seed, same data (default 42)")
    parser.add_argument(
        "--today-is-day", type=int, default=None,
        help="which mission day is today (default: the last generated day)",
    )
    parser.add_argument("--dry-run", action="store_true", help="generate and count, write nothing")
    args = parser.parse_args(argv)

    today_is_day = args.days if args.today_is_day is None else args.today_is_day
    if args.days < 1 or not 1 <= today_is_day <= args.days:
        parser.error("--days must be at least 1 and --today-is-day must be between 1 and --days")
    crew = tuple(part.strip() for part in args.crew.split(",") if part.strip())

    now = datetime.now(timezone.utc)  # the only place the simulator reads the clock
    plan = MissionPlan(
        seed=args.seed,
        mission_start=start_for(now, today_is_day=today_is_day, day_start_utc_hour=DAY_START_UTC_HOUR),
        days=args.days,
        crew=crew,
    )
    points = generate(plan, now)
    counts = Counter(point.metric for point in points)

    print(f"Simulated mission (source=\"sim\", not real patient data), seed {plan.seed}")
    print(f"  mission start  {plan.mission_start.isoformat()}  (today is mission day {today_is_day})")
    print(f"  crew           {', '.join(plan.crew)}    modules  {', '.join(plan.modules)}")
    for metric in sorted(counts):
        print(f"  {metric:<20} {counts[metric]:>6} points")
    if args.dry_run:
        print("Dry run: nothing written.")
        return 0

    try:
        vm.delete_series('{source="sim"}')
        mission.set_mission_start(plan.mission_start)
        written = write_points(points)
        flush()
        vm.reset_cache()
    except (vm.VMUnavailable, vm.VMError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    print(f"Loaded {written} points into {vm.resolve_url()}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
