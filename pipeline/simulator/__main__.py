"""Load a simulated mission into VictoriaMetrics, or keep it moving during a demo.

    python3 -m pipeline.simulator --days 3 --crew a1                    # small sample
    python3 -m pipeline.simulator --days 14 --today-is-day 10           # the demo mission
    python3 -m pipeline.simulator follow --days 14                      # live replay
    python3 -m pipeline.simulator snapshot --days 14                    # data/simulated/ CSV

load      replaces the mission: every source="sim" series is deleted, then written again,
          so running it twice never doubles the data.
follow    adds the simulated points that have become due since the last write, every
          --interval seconds, until stopped with Ctrl+C. Use the same --seed, --days and
          --crew as the load. It does not delete anything.
snapshot  writes the plan as a small CSV for reading. It does not touch VictoriaMetrics.

Values typed in the app (source="manual") are never touched by any of these.
"""

from __future__ import annotations

import argparse
import sys
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pipeline import crew as crew_config
from pipeline import mission, vm
from pipeline.ingest import flush, write_points
from pipeline.mission import DAY
from pipeline.queries import latest
from pipeline.simulator import MissionPlan, daily_snapshot, generate
from pipeline.simulator.load import load_mission

SNAPSHOT_DIR = Path(__file__).resolve().parents[2] / "data" / "simulated"
SNAPSHOT_START = datetime(2026, 1, 1, 18, 0, tzinfo=timezone.utc)  # any fixed start: the CSV uses mission days only


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python3 -m pipeline.simulator", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("command", nargs="?", choices=("load", "follow", "snapshot"), default="load")
    parser.add_argument("--days", type=int, default=3, help="mission days in the plan (default 3)")
    parser.add_argument("--crew", default="a1", help="comma-separated crew ids (default a1)")
    parser.add_argument("--seed", type=int, default=42, help="same seed, same data (default 42)")
    parser.add_argument(
        "--today-is-day", type=int, default=None, help="load: which mission day is today (default: the last day)"
    )
    parser.add_argument(
        "--live-crew", default="",
        help="comma-separated crew ids who check in by hand: from today on their mood and symptoms are not simulated",
    )
    parser.add_argument("--interval", type=float, default=30, help="follow: seconds between writes (default 30)")
    parser.add_argument("--once", action="store_true", help="follow: write what is due once and exit")
    parser.add_argument("--dry-run", action="store_true", help="load: generate and count, write nothing")
    return parser


def _ids(text: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in text.split(",") if part.strip())


def _load(args, crew: tuple[str, ...], live_crew: tuple[str, ...]) -> int:
    try:
        result = load_mission(
            today_is_day=args.today_is_day, days=args.days, crew=crew, seed=args.seed,
            live_crew=live_crew, dry_run=args.dry_run,
        )
    except ValueError as error:
        print(f"--today-is-day must be between 1 and --days ({error})", file=sys.stderr)
        return 2
    plan = result.plan
    print(f'Simulated mission (source="sim", not real patient data), seed {plan.seed}')
    print(f"  mission start  {plan.mission_start.isoformat()}  (today is mission day {result.today_is_day} of {plan.days})")
    print(f"  crew           {', '.join(plan.crew)}    modules  {', '.join(plan.modules)}")
    if live_crew:
        print(f"  live check-in  {', '.join(live_crew)}: no simulated mood or symptoms from day {result.today_is_day}")
    for metric in sorted(result.counts):
        print(f"  {metric:<20} {result.counts[metric]:>6} points")
    if args.dry_run:
        print("Dry run: nothing written.")
        return 0
    print(f"Loaded {result.written} points into {vm.resolve_url()}.")
    return 0


def _follow(args, crew: tuple[str, ...], live_crew: tuple[str, ...]) -> int:
    start = mission.mission_start()
    plan = MissionPlan(args.seed, start, args.days, crew)
    # Every simulated timestamp is on the 5-minute grid, so the newest heart-rate point
    # marks exactly how far the mission has been written.
    newest = latest("hr_bpm", crew_id=crew[0], at=datetime.now(timezone.utc) + timedelta(days=1))
    if newest is None or newest.source != "sim":
        print("No simulated mission found for this crew. Load one first.", file=sys.stderr)
        return 1
    cursor = newest.ts
    live_from_day = mission.mission_day(datetime.now(timezone.utc), start)
    print(f'Live replay (source="sim"), seed {plan.seed}, from {cursor.isoformat()}. Ctrl+C to stop.')
    try:
        while True:
            now = datetime.now(timezone.utc)
            points = generate(plan, now, after=cursor, live_crew=live_crew, live_from_day=live_from_day)
            if points:
                write_points(points)
                flush()
                cursor = max(point.ts for point in points)
                print(f"  {now:%H:%M:%S} UTC  +{len(points)} points, mission day {mission.mission_day(now, start)}")
            if now >= start + plan.days * DAY:
                print("The plan has no more days. Stopping.")
                return 0
            if args.once:
                return 0
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("Stopped.")
        return 0


def _snapshot(args, crew: tuple[str, ...]) -> int:
    plan = MissionPlan(args.seed, SNAPSHOT_START, args.days, crew)
    path = SNAPSHOT_DIR / f"mission_seed{args.seed}_{args.days}d_daily.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(daily_snapshot(plan), encoding="utf-8")
    print(f"Wrote {path.relative_to(SNAPSHOT_DIR.parents[1])}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    crew, live_crew = _ids(args.crew), _ids(args.live_crew)
    if args.days < 1 or not crew:
        print("--days must be at least 1 and --crew must name someone", file=sys.stderr)
        return 2
    try:
        if args.command == "snapshot":
            return _snapshot(args, crew)
        if args.command == "follow":
            return _follow(args, crew, live_crew)
        return _load(args, crew, live_crew)
    except (vm.VMUnavailable, vm.VMError, mission.MissionNotLoaded) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
