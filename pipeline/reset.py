"""Clear what people typed in the app, so a rehearsal leaves nothing behind.

    python3 -m pipeline.reset              # delete every source="manual" series
    python3 -m pipeline.reset --dry-run    # only count them

Simulated data (source="sim") is not touched here: `make mission` replaces it.
B's SQLite records (check-ins, briefs, notes, sync log) are a separate store and are not
touched either: see docs/DECISIONS.md, section 6, "Reset".
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone

from pipeline import vm

MANUAL = '{source="manual"}'


def _match(crew_id: str | None) -> str:
    return MANUAL if crew_id is None else '{source="manual",crew_id="%s"}' % crew_id


def count_manual(*, crew_id: str | None = None, base_url: str | None = None) -> tuple[int, int]:
    """(series, points) currently stored with source="manual"."""
    now = datetime.now(timezone.utc)
    samples = vm.export(_match(crew_id), datetime(2000, 1, 1, tzinfo=timezone.utc), now + timedelta(days=1), base_url=base_url)
    series = {tuple(sorted(labels.items())) for labels, _, _ in samples}
    return len(series), len(samples)


def clear_manual(*, crew_id: str | None = None, base_url: str | None = None) -> tuple[int, int]:
    """Delete every manual series (or only one crew member's). Returns (series, points) that were there."""
    found = count_manual(crew_id=crew_id, base_url=base_url)
    if found[0]:
        vm.delete_series(_match(crew_id), base_url=base_url)
        vm.reset_cache(base_url=base_url)
    return found


def demo_reset(
    day: int = 10, *, live_crew: tuple[str, ...] = ("a1",), base_url: str | None = None
) -> tuple[int, int]:
    """Everything C owns, in the right order: clear typed values, then reload the mission with today = `day`.

    Returns (manual series, manual points) that were cleared. B's SQLite records are B's to reset.
    """
    from pipeline.simulator.load import load_mission

    cleared = clear_manual(base_url=base_url)
    load_mission(today_is_day=day, live_crew=live_crew, base_url=base_url)
    return cleared


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m pipeline.reset", description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="count, delete nothing")
    args = parser.parse_args(argv)
    try:
        if args.dry_run:
            series, points = count_manual()
            print(f'{series} source="manual" series, {points} points. Dry run: nothing deleted.')
        else:
            series, points = clear_manual()
            print(f'Deleted {series} source="manual" series ({points} points).')
    except (vm.VMUnavailable, vm.VMError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
