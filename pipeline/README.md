# pipeline

Everything that puts data into VictoriaMetrics and reads it back. Owner: C. The contract with B is in `docs/DECISIONS.md` (sections 2 to 6).

Runtime code uses the Python standard library only (3.12). Run everything from the **repo root**, which must be on `PYTHONPATH` (it is when you run `python3 -m ...` from there).

## Quick start

```bash
make up        # start VictoriaMetrics
make sample    # load 3 simulated days for crew a1 (replaces all source="sim" data)
make mission   # load the 14-day demo mission for a1, a2, a3; today = day 10 (make mission DAY=14 for all of it)
make follow    # live replay: keep adding simulated readings while the demo runs
make osd569    # rebuild data/processed/osd569.json from the raw NASA files
make clear-manual  # delete every value typed in the app (source="manual"); simulated data stays
make demo-reset    # clear typed values, then reload the mission (DAY=10 LIVE=a1). Time series only
make check     # run the tests
```

```python
from datetime import datetime, timedelta, timezone
from pipeline.ingest import Point, write_points, flush
from pipeline.queries import series, latest
from pipeline.mission import mission_day

now = datetime.now(timezone.utc)

# Read
heart_rate = series("hr_bpm", crew_id="a1", start=now - timedelta(days=7), end=now)   # raw, every 5 min
mood = series("mood_score", crew_id="a1", start=now - timedelta(days=7), end=now)     # one per mission day
headache = latest("symptom_strength", crew_id="a1", labels={"symptom": "headache"})
co2 = latest("co2_ppm", labels={"module": "node1"})
today = mission_day(now)

# Write a check-in value, then make it readable at once
write_points([Point("mood_score", 4, now, {"crew_id": "a1", "source": "manual"})])
flush()
```

Each `Sample` has `ts`, `value` and `source` (`sim`, `nasa` or `manual`), so the UI can label simulated values.

## What is here

| Path | What |
|---|---|
| `schema.py` | Metric names, units, labels, cadence. Twin of the table in `docs/DECISIONS.md` |
| `ingest/` | `Point`, `write_points`, `flush` |
| `queries/` | `series`, `latest`, `daily` (rows carry `complete`), `baseline_window` (finished days only by default); `queries/cabin.py` has `cabin_link`: the day overlay first, with `first_high_day`, `first_symptom_day`, `lead_days`, `correlation_ready`, and lagged correlation second |
| `mission.py` | Mission clock: `mission_start`, `mission_day`, `day_window` |
| `simulator/` | Simulated 14-day mission with the demo story, live replay, daily snapshot |
| `osd569/` | ETL: raw NASA OSD-569 files to `data/processed/osd569.json`. A sample that looks shifted in the NASA file is flagged `quality: "suspect"` and left out of the statistics |
| `reset.py` | `clear_manual()` and `demo_reset(day)`: clear typed values, reload the mission. `python3 -m pipeline.reset` |
| `simulator/load.py` | `load_mission(...)`: the importable mission load the CLI and `demo_reset` use |
| `references.py` | Cited reference values (CO2 limit). Anything not cited is a Demo parameter |
| `crew.py` | Demo crew and which module each person lives in |
| `vm.py` | The only module that talks HTTP to VictoriaMetrics |
| `tests/` | `make check`. Tests that need VictoriaMetrics are skipped when it is down; set `PIPELINE_REQUIRE_VM=1` to fail instead |

## For B: using this from the API container

- Build with the repo root as the Docker build context and copy `pipeline/` next to `api/`.
- Set `VM_URL=http://victoriametrics:8428` in compose.
- `write_points` and the query functions are synchronous. In FastAPI call them from a normal `def` endpoint (it runs in a thread pool), not from `async def`.
- `write_points` raises `IngestError` for a point that does not fit the schema and `IngestUnavailable` when VictoriaMetrics is down. It never rejects a value for being outside a health range.
- Tests write only series with a throwaway `crew_id` and delete them, so they do not disturb a loaded mission.

## Before a demo or rehearsal

The simulated data ends at the moment it was loaded, and the mission clock keeps running. Load the mission again right before the demo, with the agreed `--today-is-day`, or "today" will have no data. Loading on a later day moves the mission start, so values typed in an earlier rehearsal (`source="manual"`) end up on a different mission day; `make demo-reset` clears them first and then reloads, which is the order that works.

## Other data files C owns

`data/processed/osd569.json` (OSD-569 blood count with the Earth reference range) and `data/processed/hazards.json` (the five NASA HRP hazards for the Environment Switcher, quotes checked against the NASA pages). `make check` tests both.

## Simulated data

Every simulated point has `source="sim"`. All numbers in `simulator/` are Demo parameters, not medical thresholds. No real patient data is used anywhere.
