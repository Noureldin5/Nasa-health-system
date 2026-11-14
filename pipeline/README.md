# pipeline

Everything that puts data into VictoriaMetrics and reads it back. Owner: C. The contract with B is in `docs/DECISIONS.md` (sections 2 to 6).

Runtime code uses the Python standard library only (3.12). Run everything from the **repo root**, which must be on `PYTHONPATH` (it is when you run `python3 -m ...` from there).

## Quick start

```bash
make up        # start VictoriaMetrics
make sample    # load 3 simulated days for crew a1 (replaces all source="sim" data)
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
| `queries/` | `series`, `latest`. More in C5 and C6 |
| `mission.py` | Mission clock: `mission_start`, `mission_day` |
| `simulator/` | Simulated mission data. Flat baseline for now, the 14-day story is C3 |
| `vm.py` | The only module that talks HTTP to VictoriaMetrics |
| `tests/` | `make check`. Tests that need VictoriaMetrics are skipped when it is down; set `PIPELINE_REQUIRE_VM=1` to fail instead |

## For B: using this from the API container

- Build with the repo root as the Docker build context and copy `pipeline/` next to `api/`.
- Set `VM_URL=http://victoriametrics:8428` in compose.
- `write_points` and the query functions are synchronous. In FastAPI call them from a normal `def` endpoint (it runs in a thread pool), not from `async def`.
- `write_points` raises `IngestError` for a point that does not fit the schema and `IngestUnavailable` when VictoriaMetrics is down. It never rejects a value for being outside a health range.
- Tests write only series with a throwaway `crew_id` and delete them, so they do not disturb a loaded mission.

## Before a demo or rehearsal

The simulated data ends at the moment it was loaded, and the mission clock keeps running. Load the mission again right before the demo, with the agreed `--today-is-day`, or "today" will have no data. Loading on a later day moves the mission start, so values typed in an earlier rehearsal (`source="manual"`) end up on a different mission day; a command to clear them comes with the demo reset (C9).

## Simulated data

Every simulated point has `source="sim"`. All numbers in `simulator/` are Demo parameters, not medical thresholds. No real patient data is used anywhere.
