"""Runtime settings, read from the environment only in `Settings.from_env`."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OSD569 = REPO_ROOT / "data" / "processed" / "osd569.json"


@dataclass(frozen=True)
class Settings:
    sqlite_path: str = ":memory:"
    metrics_backend: str = "fake"  # "fake" (in-memory simulated mission) or "vm" (Task 10)
    seed_day: int | None = 10  # mission day "today" is on startup; None skips seeding
    osd569_path: Path = field(default=DEFAULT_OSD569)

    @classmethod
    def from_env(cls) -> Settings:
        seed = os.environ.get("SEED_DAY", "10")
        return cls(
            sqlite_path=os.environ.get("SQLITE_PATH", ":memory:"),
            metrics_backend=os.environ.get("METRICS_BACKEND", "fake"),
            seed_day=int(seed) if seed else None,
            osd569_path=Path(os.environ.get("OSD569_PATH", str(DEFAULT_OSD569))),
        )
