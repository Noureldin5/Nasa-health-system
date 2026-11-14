# Decisions

Stack and data contracts every person and every Claude session follows. This is a shared file: change it only through a small `shared/<topic>` PR with one approval (`docs/GIT-WORKFLOW.md`).

Status: **draft by C, 2026-11-14.** Sections 2 to 6 are implemented in `pipeline/` (ingest, queries, mission clock, 14-day simulator, Cabin Link). Sections 1 to 7 are C's proposal for the contract between B and C. Sections 8 to 10 are B's (written 2026-11-14). Items marked **OPEN** need a team answer before they are final (list in section 7).

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
- If two samples have exactly the same timestamp, the typed one wins: `manual` over `nasa` over `sim`.
- "Latest" is not "today's". The simulated data ends when the mission was loaded, while the mission clock keeps running. Treat a daily value as today's only if `mission_day(sample.ts) == mission_day(now)`.

## 4. Mission clock

- All timestamps are UTC.
- `mission_start` is the instant mission day 1 begins. It is set when the simulated mission is loaded.
- A mission day is a 24-hour window counted from `mission_start`: `mission_day(ts) = floor((ts - mission_start) / 24h) + 1`.
- **Never derive the mission day from the calendar date.** Always call `pipeline.mission.mission_day(ts)`. `pipeline.mission.mission_start()` returns the start. Where it is stored is C's detail.
- Which mission day "today" is at demo time is OPEN 1. The simulator takes it as a parameter (`--today-is-day`) and never writes points later than "now".
- The simulator starts mission days at 18:00 UTC (midnight in Bishkek). Demo parameter: this way "today" already has its morning sleep and check-in values when the demo runs during the local day.
- The start is stored in VictoriaMetrics as the internal series `mission_start_seconds{source="sim"}`, so it is replaced together with the simulated mission. If no mission is loaded, `mission_start()` raises `MissionNotLoaded`: run `make sample`.

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
       crew_id: str | None = None, labels: dict[str, str] | None = None,
       mission_start: datetime | None = None) -> list[Sample]
latest(metric: str, *, crew_id: str | None = None,
       labels: dict[str, str] | None = None, at: datetime | None = None) -> Sample | None
```

- `series` returns samples sorted by time, `start <= ts < end`, merged across `source`. `end` is exclusive: to include a point written at `now`, pass `end = now + 1 second`. Timestamps are stored in whole milliseconds, rounded down. Daily metrics come back as one sample per mission day (section 3). 5-minute metrics come back raw.
- `latest` returns the newest sample at or before `at` (default: now), or `None`.
- `labels` is for the extra labels: `{"symptom": "headache"}`, `{"module": "node1"}`.
- A call must name exactly one series: `crew_id` for crew metrics, plus `symptom` or `module` where the metric has it. Anything else raises `ValueError`. Do not pass `source`: each `Sample` says its own.
- `mission_start` is optional and only matters for daily metrics. Without it the stored start is read. Pass it in tests.
- All datetimes must be timezone-aware.
- Label values (`crew_id`, `symptom`, `module`) may contain only letters, digits, `_`, `-` and `.`; anything else raises `ValueError` on read and `IngestError` on write. They are **not** checked against the lists in section 2, so a typo in a `crew_id` silently creates or reads a new, empty series.
- Errors: `ValueError` for a bad call, `pipeline.vm.VMUnavailable` when VictoriaMetrics is down (the same class as `IngestUnavailable`), `pipeline.vm.VMError` when it answers with an error, and `MissionNotLoaded` from `series` on a daily metric when data exists but no mission is loaded and no `mission_start` was passed.

Mission clock:

```python
from pipeline.mission import mission_day, mission_start, day_window, MissionNotLoaded

mission_start() -> datetime                                   # raises MissionNotLoaded
mission_day(ts: datetime, start: datetime | None = None) -> int   # 1 on the first day
day_window(day: int, start: datetime) -> tuple[datetime, datetime]   # begin (inclusive), end (exclusive)
```
- Time is always passed in or defaulted at the edge. `api/domain/` never calls these, the adapter in `api/metrics/` does.

Baseline input and daily aggregates (C5):

```python
from pipeline.queries import DailyValue, WindowStats, daily, baseline_window

daily(metric, *, first_day: int, last_day: int, crew_id=None, labels=None,
      mission_start=None) -> list[DailyValue]          # day, mean, min, max, n, sources
baseline_window(metric, *, through_day: int, days: int = 7, crew_id=None, labels=None,
                mission_start=None) -> WindowStats     # first_day, last_day, n_days, mean, sd, min, max
```

- Days are mission days, both ends included. Days without data are left out of `daily`.
- `DailyValue.complete` is `False` for a 5-minute metric (heart rate, CO2) on a day that is not over yet. A partial day is biased: the simulated heart rate is lower at night, so a morning mean sits about 5 bpm below a full day, many times the spread of full-day means (`pipeline/tests/test_demo_moment.py` shows it). `baseline_window` leaves such days out by default (`complete_only=True`), so `n_days` counts finished days. **B: build the baseline from finished days (`through_day = today - 1`). For a 5-minute metric with `complete=False`, do not compare the day's mean to the baseline at all. Compare the last complete day instead, or the raw recent samples.** Daily metrics (sleep, mood, blood pressure) are one value per day and always `complete`.
- `complete` is decided by the clock only. If the data is stale (a mission loaded long ago, or `follow` stopped), a day can be "complete" with few samples. `DailyValue.n` (samples that day, 288 for a full 5-minute day) is the data-based check: B should require a minimum `n` before trusting a daily mean.
- `baseline_window` only measures: mean and sample standard deviation of the daily means. What counts as drift is B's rule in `api/domain/`. `n_days` below `days` means the window is not full yet (calibration).

Cabin Link (C6):

```python
from pipeline.queries.cabin import cabin_link

cabin_link(crew_id, *, through_day: int, days: int = 14, symptom="headache",
           max_lag_days: int = 2, mission_start=None) -> CabinLink
```

- `CabinLink.days`: per mission day the mean and max CO2 of the person's module, hours above the cited limit, whether the day was above the module's usual level, and the symptom strength.
- `CabinLink.lags`: correlation of the symptom with CO2 0, 1 and 2 days earlier. `r` is `None` when there are fewer than 5 paired days or fewer than 2 days with the symptom (Demo parameters), so a single headache never shows up as a correlation.
- **Decision 2026-11-14: Cabin Link leads with the day overlay, not with a correlation number.** The overlay is `CabinLink.days`: per day the CO2 mean and max, `above_usual`, `hours_above_limit`, `symptom_strength` and `complete`. The headline fields say what to draw and write: `first_high_day` (CO2 first above the module's usual level), `first_symptom_day`, `lead_days` (`first_symptom_day - first_high_day`; 0 or more means the rise came first) and `correlation_ready`. **A: show `lags` and `best_lag` only when `correlation_ready` is true, and as a secondary line under the overlay.** On demo day 10 it is false (one symptom day is not a correlation), so the screen shows the overlay and the sentence built from `lead_days`, for example "CO2 rose on day 9, your headache came on day 10". Before the live check-in `first_symptom_day` is `None`: show the CO2 rise alone. Do not read the correlation as "which lag is the cause": on the 14-day story lag 0 is the strongest only because CO2 stays high for three days.
- `CabinDay.complete` is `False` for a day that is not over yet (today), whose CO2 mean covers part of the day.
- `CabinLink.limit` is the cited CO2 limit and `CabinLink.caveat` the decision-support line. Both must reach the UI with the numbers.
- Cited values live in `pipeline/references.py`: CO2 limit 3 mmHg as a 1-hour average (NASA-STD-3001 Volume 2, [V2 6004], via NASA technical brief OCHMO-TB-004), about 3,947 ppm at 760 mmHg cabin pressure. This replaces the 3,500 ppm placeholder in `docs/HANDOFF.md`.

**B never writes raw MetricsQL.** If a query is missing, ask C.

## 6. VictoriaMetrics behaviour everyone should know

Checked against the VictoriaMetrics docs on 2026-11-14.

| Behaviour | What we do |
|---|---|
| Queries hide the last 30 s of data by default | Compose sets `-search.latencyOffset=1s` |
| Reading raw samples (`/api/v1/export`) without `start` and `end` does not return a point written this instant | C's query functions always send both. Found with the smoke test on 2026-11-14 |
| Freshly written samples stay in memory and are invisible for up to a few seconds, whatever the offset | `flush()` after a live check-in. It calls `/internal/force_flush`, which the docs describe as a debug and test endpoint. **Demo shortcut**, not for production |
| A plain instant query looks back only 5 minutes, so daily metrics look empty | C's query functions read raw samples. This is why B does not write MetricsQL |
| Default retention is 1 month | Compose sets `-retentionPeriod=90d`. Demo parameter |
| Results are cached, and backfilled history can leave the cache stale | The simulator resets the cache after every load and reset |
| Two samples with the same timestamp on one series: the larger value is kept, not the later write | Do not rely on overwriting. Section 3 is the rule |
| Deleting works on whole series only, there is no time range | See "Reset" below |

Reset (C9). Two stores, so a full reset is two steps, and the demo needs both:

- **C, done (assumes OPEN 2 is answered yes):** `make demo-reset` (defaults `DAY=10 LIVE=a1`) deletes every `source="manual"` series (`python3 -m pipeline.reset`, also `make clear-manual` on its own) and then reloads the simulated mission (`make mission`). Clear first, reload second: the reload moves the mission start, so a leftover manual value would land on a different mission day and override the simulated one (section 3). `python3 -m pipeline.reset --dry-run` only counts them.
- **B, to do (`api/`):** reset the SQLite records: check-ins, alerts, consult briefs, ground replies, surgeon notes, flags and the sync log, back to the seeded demo state (the seed content is B's to choose). Expose it as one command (for example `python3 -m api.reset` or `make api-reset`) and, once it exists, add it to the `demo-reset` target in the `Makefile` (a shared file: one-line change in the same `shared/` PR). Until then `make demo-reset` prints a reminder. B should not touch VictoriaMetrics for this: call `pipeline.reset.clear_manual()` if the API needs to clear typed values itself.
- Which store holds a typed value matters: the check-in endpoint writes numbers to VictoriaMetrics (`source="manual"`) and the text to SQLite. If only one store is reset, the chart and the record disagree on the demo screen.

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

### C's answer to section 10 (2026-11-14, checked against the code and a loaded mission)

| # | C confirms? | Detail |
|---|---|---|
| 1 | Yes | Mapping is exactly section 2 and `pipeline/schema.py`. For the symptom pass `labels={"symptom": "headache"}`; for CO2 pass `labels={"module": ...}` and no `crew_id`. A wrong metric or label raises `ValueError` |
| 2 | Yes | Every call needs timezone-aware datetimes and returns UTC-aware ones. Attach UTC in, drop it out |
| 3 | Yes, tested | `end + 1 microsecond` includes a sample written at `end` (checked on the loaded mission: with plain `end` the last sample is missing, with `+1us` it is there). Timestamps are whole milliseconds, so one microsecond is enough |
| 4 | Yes, with two cautions | `daily(metric, first_day, last_day, crew_id=..., labels=...)` gives `mean` and `max` per mission day for `hr_bpm` and `co2_ppm`. (a) **Today is a partial day** (`complete=False`, `n` below 288): see section 5, do not compare today's heart-rate mean to the baseline. (b) **The daily maximum of CO2 is a 5-minute peak, not a 1-hour average.** The cited limit is a 1-hour average, so do not compare `max` to it: on the demo mission the peak is about 3,960 ppm while no hour is above the limit. For limit questions use `CabinDay.hours_above_limit` from `cabin_link` |
| 5 | Yes, with one caution | Use `pipeline.crew.module_of(crew_id)` and drop B's own map. An unknown `crew_id` silently falls back to `node1`, so B validates the crew id against `pipeline.crew.CREW` first |
| 6 | Yes, still OPEN 2 | The pipeline already accepts and returns `source="manual"`, and `make clear-manual` clears it. C recommends yes. B adds it to the schema when the team answers |
| 7 | Yes, and a gap is closed | There was no importable call for this, only the CLI. Now: `from pipeline.reset import demo_reset; demo_reset(day)` clears typed values and reloads the mission with today = `day`, live crew `a1`, seed 42, 14 days. Lower level: `pipeline.simulator.load.load_mission(today_is_day=..., live_crew=..., now=...)`. It is synchronous and takes a few seconds: call it from a normal `def` endpoint. It raises `ValueError` for a day outside 1 to 14 and `IngestUnavailable` when VictoriaMetrics is down. It does not touch SQLite |
| 8 | Yes | `write_points` then `flush()`. `IngestUnavailable` is the same class as `pipeline.vm.VMUnavailable` (checked with an unreachable address). Keep the check-in saved in SQLite and mark the readings unavailable, as B proposes |

Nothing in sections 1 to 7 needs to change for B to build this.
