"""Load the simulated mission into VictoriaMetrics. Importable, so the API's demo reset can call it.

The CLI (`python3 -m pipeline.simulator`) uses the same function.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone

from pipeline import crew as crew_config
from pipeline import mission, vm
from pipeline.ingest import flush, write_points
from pipeline.simulator import MissionPlan, generate, start_for

DEMO_DAYS = 14
DEMO_SEED = 42


@dataclass(frozen=True)
class LoadResult:
    plan: MissionPlan
    today_is_day: int
    counts: dict[str, int]  # points per metric
    written: int  # 0 on a dry run


def load_mission(
    *,
    today_is_day: int | None = None,
    days: int = DEMO_DAYS,
    crew: tuple[str, ...] = crew_config.CREW,
    seed: int = DEMO_SEED,
    live_crew: tuple[str, ...] = (),
    now: datetime | None = None,
    dry_run: bool = False,
    base_url: str | None = None,
) -> LoadResult:
    """Replace every source="sim" series with a fresh mission in which `now` is mission day `today_is_day`.

    `today_is_day` defaults to the last day. Values typed in the app (source="manual") are not touched:
    clear them first with `pipeline.reset.clear_manual()` (see `pipeline.reset.demo_reset`).
    Raises ValueError for a day outside 1..days, IngestUnavailable / VMError when VictoriaMetrics fails.
    """
    today_is_day = days if today_is_day is None else today_is_day
    if not 1 <= today_is_day <= days:
        raise ValueError("today_is_day must be between 1 and days")
    now = now or datetime.now(timezone.utc)
    plan = MissionPlan(seed, start_for(now, today_is_day=today_is_day), days, tuple(crew))
    points = generate(plan, now, live_crew=live_crew, live_from_day=today_is_day)
    counts = dict(Counter(point.metric for point in points))
    if dry_run:
        return LoadResult(plan, today_is_day, counts, 0)

    vm.delete_series('{source="sim"}', base_url=base_url)
    mission.set_mission_start(plan.mission_start, base_url=base_url)
    written = write_points(points, base_url=base_url)
    flush(base_url=base_url)
    vm.reset_cache(base_url=base_url)
    return LoadResult(plan, today_is_day, counts, written)
