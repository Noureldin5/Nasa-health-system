# Decisions

Stack and data contracts every person and every Claude session follows. This is a shared file: change it only through a small `shared/<topic>` PR with one approval (`docs/GIT-WORKFLOW.md`).

Status: **draft by C, 2026-11-14.** Sections 1 to 7 are C's proposal for the contract between B and C. Sections 8 and 9 are B's to write. Items marked **OPEN** need a team answer before they are final (list in section 7).

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

## 8. Record shapes (B leads)

TODO (B): check-in, alert, consult brief, ground reply, surgeon note, flag, sync record.

## 9. First API endpoints (B leads, A agrees)

TODO (B). Starting list: `docs/TEAM.md`, "First endpoints to agree with A in hour 0".
