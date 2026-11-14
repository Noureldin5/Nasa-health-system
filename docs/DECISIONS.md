# Decisions

Stack and data contracts every person and every Claude session follows. This is a shared file: change it only through a small `shared/<topic>` PR with one approval (`docs/GIT-WORKFLOW.md`).

Status: **draft by C, 2026-11-14.** Sections 1 to 7 are C's proposal for the contract between B and C. Sections 8 to 10 are B's (written 2026-11-14). Items marked **OPEN** need a team answer before they are final (list in section 7).

## 1. Stack

| Part | Choice | Status |
|---|---|---|
| Time series | VictoriaMetrics single-node, image `victoriametrics/victoria-metrics:v1.156.0` (pinned tag) | Decided (C) |
| Pipeline | Python 3.12, standard library only at runtime, pytest for tests | Decided (C) |
| API | FastAPI + SQLite | Recommended in `docs/TEAM.md`, B confirms |
| Web | React + TypeScript + Vite | A confirms |
| Run | `docker compose up` from the repo root, no internet | Decided |

VictoriaMetrics has no free LTS line (LTS is Enterprise only), so we pin the latest community release.

`VM_URL` is the one setting both B and C read:

- inside compose: `http://victoriametrics:8428`
- on the host: `http://localhost:8428` (the default when `VM_URL` is unset)

## 2. Metric schema (contract between B and C)

Raw samples, one number per point. The unit is part of the name.

| Metric | Unit / scale | Extra labels | Cadence | In the story it comes from |
|---|---|---|---|---|
| `hr_bpm` | beats per minute | `crew_id` | every 5 min | wearable, passive |
| `sleep_hours` | hours slept last night | `crew_id` | 1 per mission day | wearable, passive |
| `bp_systolic_mmhg` | mmHg | `crew_id` | 1 per mission day (OPEN 3) | measurement |
| `bp_diastolic_mmhg` | mmHg | `crew_id` | 1 per mission day (OPEN 3) | measurement |
| `glucose_mg_dl` | mg/dL | `crew_id` | 1 per mission day (OPEN 3) | measurement |
| `body_temp_c` | degrees Celsius | `crew_id` | 1 per mission day (OPEN 3) | measurement |
| `mood_score` | 1 (worst) to 5 (best) | `crew_id` | 1 per mission day | check-in |
| `symptom_strength` | 0 none, 1 mild, 2 moderate, 3 strong | `crew_id`, `symptom` | 1 per mission day per symptom | check-in |
| `co2_ppm` | parts per million | `module` | every 5 min | cabin sensor, passive |

Labels:

| Label | Values | On |
|---|---|---|
| `source` | `sim`, `nasa`, `manual` (OPEN 2) | **every series, required.** The ingest helper rejects a point without it |
| `crew_id` | `a1`, `a2`, `a3` | every metric except `co2_ppm` |
| `module` | `node1`, ... | `co2_ppm` only |
| `symptom` | `headache` (more can be added) | `symptom_strength` only |

- `source="sim"`: written by the simulator. The UI shows "Simulated".
- `source="nasa"`: reserved for values taken from a NASA dataset. OSD-569 reference ranges go to `data/processed/osd569.json`, not to VictoriaMetrics (`docs/TEAM.md`), so there may be no `nasa` series at first. Checked on OSDR on 2026-11-14: the OSD-569 blood-count file has 4 subjects with 7 samples each, taken before launch (L-92, L-44, L-3) and after return (R+1, R+45, R+82, R+194). It has **no in-flight samples**, so it is a reference range, not a mission time series.
- `source="manual"` (OPEN 2): typed by a person in the app (check-in, weekly slot).
- Which module a crew member is in (needed for Cabin Link) is a mapping in pipeline config, labeled Demo parameter. It is not a label.
- The scales for `mood_score` and `symptom_strength` come from the check-in in `docs/USER-FLOW.md`. They are scale definitions, not health thresholds.
- VictoriaMetrics holds numbers only. Text goes to B's SQLite.

The machine-readable twin of these tables is `pipeline/schema.py`. Ingest and queries both import it. If the table and the file disagree, fix both in one `shared/` PR.

## 3. Daily-value rule

For every metric with cadence "1 per mission day": **one value per mission day, the sample with the latest timestamp wins.**

- A second check-in on the same day writes a second sample. Nothing is overwritten in the store.
- C's query functions apply the rule, so B and A always get one value per day.
- This also covers a manual reading entered on top of a simulated one for the same day: the later one is shown, and its `source` comes back with it.

## 4. Mission clock

- All timestamps are UTC.
- `mission_start` is the instant mission day 1 begins. It is set when the simulated mission is loaded.
- A mission day is a 24-hour window counted from `mission_start`: `mission_day(ts) = floor((ts - mission_start) / 24h) + 1`.
- **Never derive the mission day from the calendar date.** Always call `pipeline.mission.mission_day(ts)`. `pipeline.mission.mission_start()` returns the start. Where it is stored is C's detail.
- Which mission day "today" is at demo time is OPEN 1. The simulator takes it as a parameter and never writes points later than "now".

Why this matters to B: calibration ("Learning your baseline: day N of 7") and the one-alert-per-day rule both need the mission day.

## 5. Python contract (how B calls C's code)

Import path: the repo root is on `PYTHONPATH` and the package is `pipeline`. There is no pip package. B's Docker build context must be the **repo root** so the image can copy `pipeline/`.

Write (used by the simulator and by B's check-in endpoint):

```python
from pipeline.ingest import Point, write_points, flush

Point(metric: str, value: float, ts: datetime, labels: dict[str, str])   # ts must be timezone-aware
write_points(points: Iterable[Point], *, base_url: str | None = None) -> int   # number of points written
flush(*, base_url: str | None = None) -> None
```

- `write_points` checks structure only: known metric, required labels for that metric, `source` value, finite number, timezone-aware timestamp. It raises `IngestError` (a `ValueError`) on a bad point and `IngestUnavailable` when VictoriaMetrics cannot be reached. It does **not** reject a value for being out of a health range.
- Call `flush()` after a live check-in, before reading the chart back (see section 6).

Read (the first two functions of C5, pulled forward so B can start):

```python
from pipeline.queries import Sample, series, latest

Sample(ts: datetime, value: float, source: str)        # ts is UTC, timezone-aware

series(metric: str, *, start: datetime, end: datetime,
       crew_id: str | None = None, labels: dict[str, str] | None = None) -> list[Sample]
latest(metric: str, *, crew_id: str | None = None,
       labels: dict[str, str] | None = None, at: datetime | None = None) -> Sample | None
```

- `series` returns samples sorted by time, `start <= ts < end`, merged across `source`. Daily metrics come back as one sample per mission day (section 3). 5-minute metrics come back raw.
- `latest` returns the newest sample at or before `at` (default: now), or `None`.
- `labels` is for the extra labels: `{"symptom": "headache"}`, `{"module": "node1"}`.
- Time is always passed in or defaulted at the edge. `api/domain/` never calls these, the adapter in `api/metrics/` does.

Coming later in `c/queries` (C5, C6), same style: baseline window stats, daily aggregates for the 5-minute metrics, CO2 versus headache with lag. **B never writes raw MetricsQL.** If a query is missing, ask C.

## 6. VictoriaMetrics behaviour everyone should know

Checked against the VictoriaMetrics docs on 2026-11-14.

| Behaviour | What we do |
|---|---|
| Queries hide the last 30 s of data by default | Compose sets `-search.latencyOffset=1s` |
| Freshly written samples stay in memory and are invisible for up to a few seconds, whatever the offset | `flush()` after a live check-in. It calls `/internal/force_flush`, which the docs describe as a debug and test endpoint. **Demo shortcut**, not for production |
| A plain instant query looks back only 5 minutes, so daily metrics look empty | C's query functions read raw samples. This is why B does not write MetricsQL |
| Default retention is 1 month | Compose sets `-retentionPeriod=90d`. Demo parameter |
| Results are cached, and backfilled history can leave the cache stale | The simulator resets the cache after every load and reset |
| Two samples with the same timestamp on one series: the larger value is kept, not the later write | Do not rely on overwriting. Section 3 is the rule |
| Deleting works on whole series only, there is no time range | See "Reset" below |

Reset: reloading the mission deletes every `source="sim"` series and writes them again. B's SQLite records (check-ins, briefs, notes) are a separate store, so a full demo reset is one command that C and B build together (C9, B8). Values typed in the demo sit in `source="manual"` series (OPEN 2) and can be cleared without reloading the mission.

## 7. Open, needs a team answer

| # | Question | C's proposal | Why |
|---|---|---|---|
| 1 | Which mission day is "today" in the demo? | Day 10, as a simulator parameter (`--today-is-day`) | `docs/TEAM.md` C3 says the 14 days end now, but the demo story (`docs/USER-FLOW.md`) has the live headache check-in on day 10 and the alert closing on day 12. If today is day 14, the live check-in comes after the story is over |
| 2 | Allow a third `source` value, `manual`? | Yes | The docs allow only `sim` and `nasa`. A value typed during the demo is neither. A separate series gives an honest UI label and can be cleared on its own |
| 3 | Cadence for blood pressure, glucose, temperature | One simulated reading per mission day. The weekly slot (U12) adds a `manual` point on top | M2 asks for a 7-day trend and a personal baseline for each. `docs/USER-FLOW.md` has them only in the weekly slot, and two points in 14 days give neither. The UI says "simulated reading" and names no on-board device |
| 4 | Blood-count card (M2b) says "beside the personal baseline" | Show the Inspiration4 sample values with the Earth range, no personal baseline. Confirm after C reads the OSD-569 metadata (C4) | No blood-count series exists to build a personal baseline from |

Once answered, the affected lines in `docs/TEAM.md`, `docs/REQUIREMENTS.md` and `docs/USER-FLOW.md` get a one-line update in the same PR.

## 8. Record shapes (B)

The source of truth is `api/schemas.py`. `api/openapi.json` is generated from it (`cd api && uv run python scripts/export_openapi.py`), and A generates TypeScript types from that file.

Records: `CheckinIn`, `CheckinEntry`, `Indicator`, `Alert`, `Brief`, `Reply`, `GroundNote` (kind `note`, `watch_flag` or `measurement_request`; flags and requests need a target and a reason), `SyncRecord`, `RecordView`, `Readout`, `Readiness`.

**Open record rule.** One function (`api/domain/views.py`, `build_view`) builds both sides, so there are no ground-only fields. Visibility depends on who wrote the item:

- Astronaut-origin items (readings, check-in answers, alerts, briefs) show on the ground side only if they existed at the last sync. The astronaut side sees them at once.
- Ground-origin items (notes, flags, measurement requests, replies) show on the ground side at once. The astronaut sees them, word for word, after the next sync delivers them.
- Every sync, including an empty one, is one entry in `GET /link/log`.

**Personal baseline rule** (`api/domain/baseline.py`). The band is mean ± 2 standard deviations of the days older than the 3-day drift window, so the days being judged never widen the band they are judged against. A status needs 7 prior days with data. Calibration counts days that have data, so it does not need the mission clock.

**Demo parameters** (`api/domain/params.py`). None has a medical source, so each is labeled Demo parameter in code and bands built from them carry `demo_parameter: true`.

| Name | Value |
|---|---|
| Calibration | 7 days |
| Baseline window | 14 days |
| Band width | 2 standard deviations |
| Minimum band half-width | heart rate 3 bpm, sleep 0.5 h, mood 0.5, temperature 0.2 °C, glucose 5 mg/dL, blood pressure 4 mmHg, CO2 100 ppm |
| Drift | outside the band on 2 of the last 3 days |
| Headache pattern | mild or stronger on 2 of the last 3 days |
| Alert close | 2 days in a row back to normal |
| Alerts per day | 1 shown, the rest in "Worth checking" |

No cited safety threshold exists yet, so nothing can alert during the 7-day calibration. C7 supplies the NASA sources.

## 9. API endpoints (B)

```
GET  /health
GET  /crew                              GET  /crew/readiness
GET  /astronaut/{id}/view               GET  /astronaut/{id}/readout
GET  /astronaut/{id}/series/{metric}    POST /astronaut/{id}/checkin
GET  /astronaut/{id}/briefs/draft       POST /astronaut/{id}/briefs
POST /alerts/{id}/close                 POST /briefs/{id}/reply
GET  /ground/inbox                      GET  /ground/{id}/view
POST /ground/{id}/notes                 POST /link/sync
GET  /link/log                          GET  /reference/osd569
POST /demo/reset?day=N
```

`POST /demo/reset?day=N` makes real today mission day N: it reseeds, saves one check-in per past day so "Same as yesterday" works, logs an initial sync, and raises any alert the history already earns. On day 10 one headache check-in raises the headache and CO2 alert.

`GET /reference/osd569` returns the shape `Osd569Reference` in `api/schemas.py` (`dataset_id`, `url`, `label`, `placeholder`, and `indicators` with `indicator`, `value`, `range_min`, `range_max`, `unit`). C4 writes `data/processed/osd569.json` in that shape. A file that does not match makes the endpoint fail, so run `cd api && uv run pytest` after changing it. Until the file exists the endpoint returns a labeled placeholder with no numbers.

## 10. How B's metrics adapter meets section 5 (B, for C to confirm)

The API reads and writes time series through one port (`api/metrics/port.py`) and runs today on an in-memory simulated mission (`api/metrics/fake.py`). The real adapter calls `pipeline.ingest` and `pipeline.queries`. These are the points where the two sides differ. B handles each in the adapter unless C objects.

| # | Topic | B's side today | Plan in the adapter |
|---|---|---|---|
| 1 | Metric names | `heart_rate`, `sleep_hours`, `bp_systolic`, `bp_diastolic`, `glucose`, `body_temp`, `mood`, `headache`, `co2` | Map to section 2: `hr_bpm`, `sleep_hours`, `bp_systolic_mmhg`, `bp_diastolic_mmhg`, `glucose_mg_dl`, `body_temp_c`, `mood_score`, `symptom_strength{symptom="headache"}`, `co2_ppm{module}` |
| 2 | Timestamps | Naive UTC inside the API (the clock is UTC since 2026-11-14) | Attach UTC on the way in, drop it on the way out |
| 3 | Range end | The port's `end` is inclusive | Pass `end` plus 1 microsecond, because `series` uses `start <= ts < end` |
| 4 | Daily value for 5-minute metrics | The API keeps the last reading of each day | Ask C5 for daily aggregates of `hr_bpm` and `co2_ppm`. B proposes the daily mean for heart rate and the daily maximum for CO2 |
| 5 | Crew to module | A map in SQLite seed data (`a1` and `a2` in `node1`, `a3` in `lab`) | One source of truth is better. B proposes to read the pipeline config mapping from section 2 and drop its own |
| 6 | `source="manual"` (OPEN 2) | The API schema accepts `sim` and `nasa` | B adds `manual` to the schema when the team accepts OPEN 2 |
| 7 | Today in the demo (OPEN 1) | `POST /demo/reset?day=N` | B's reset calls C's simulator with the same day, so B supports day 10 as C proposes |
| 8 | Live check-in | Saves the SQLite record first, then writes `mood_score`, `symptom_strength` and any measurements | Call `flush()` after the write. On `IngestUnavailable` the check-in stays saved and the views mark readings unavailable |

Nothing in sections 1 to 7 needs to change for B to build this.
