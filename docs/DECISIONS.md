# Decisions

Stack and data contracts every person and every Claude session follows. This is a shared file: change it only through a small `shared/<topic>` PR with one approval (`docs/GIT-WORKFLOW.md`).

Status: **draft by C, 2026-11-14.** Sections 2 to 6 are implemented in `pipeline/` (ingest, queries, mission clock, 14-day simulator, Cabin Link). Sections 1 to 7 are C's proposal for the contract between B and C. Sections 8 and 9 are B's to write. Items marked **OPEN** need a team answer before they are final (list in section 7).

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

## 8. Record shapes (B leads)

TODO (B): check-in, alert, consult brief, ground reply, surgeon note, flag, sync record.

## 9. First API endpoints (B leads, A agrees)

TODO (B). Starting list: `docs/TEAM.md`, "First endpoints to agree with A in hour 0".
