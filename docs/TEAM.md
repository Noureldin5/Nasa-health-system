# Team split

Team: Kernel Panic Squad, 3 people:

- **A: frontend.** The web app the astronaut and the flight surgeon use.
- **B: backend.** The API, the health logic and the record of check-ins, briefs, replies and notes.
- **C: data engineer.** VictoriaMetrics, every pipeline that puts data into it, NASA data, simulated mission data and the queries over it.

Git and branching rules: `docs/GIT-WORKFLOW.md`. Requirement IDs (M1, D5, U3 ...) point to `docs/REQUIREMENTS.md`.

## Decision

Build **Own Your Baseline** (`docs/IDEAS.md`, daily use in `docs/USER-FLOW.md`) with a **consult layer** on an **open record** (the flight surgeon sees the full record, the astronaut sees everything the surgeon sees, plus a consult brief and reply) and **Cabin Link** inside it. Why: `docs/research/competitors.md`. Add Environment Switcher (cheap) and Crew Readiness if time allows. Mission Quest is optional. Radiation Budget Coach and Camera Check are roadmap items for the pitch.

Designs: `docs/DESIGN.md` and `design/`.

## Architecture in one picture

Everything runs on one machine with `docker compose up`, with no internet. In the story this machine is the **station server on board**. "Offline" means no internet and no link to Earth, not "no server".

```
 web (A)  ──HTTP/JSON──▶  api (B)  ──MetricsQL──▶  VictoriaMetrics (C)
 React app                FastAPI*                  time series: vitals, sleep, CO2
 astronaut + Ground       domain logic              ▲
 role switch              SQLite: records           │ import API
                          ground link simulation    pipeline (C)
                                                    simulator, OSD-569 ETL, cabin CO2
```

\* FastAPI recommended so B and C share Python. Final choice goes in `docs/DECISIONS.md` in hour 0.

**What goes where (the key split between B and C):**

| Data | Store | Owner | Why |
|---|---|---|---|
| Numeric readings over time: heart rate, blood pressure, glucose, body temperature, sleep hours, CO2, symptom strength, mood score | VictoriaMetrics | C writes, B reads | Time series, numbers with labels |
| OSD-569 reference values (value, min, max per indicator) | JSON file in `data/processed/`, served by the API | C produces, B serves | Static reference, not a time series |
| Check-in records, consult briefs, replies, surgeon notes, flags, alerts, sync log | SQLite | B | Text and relations, VictoriaMetrics cannot hold them |

Check-in numbers (for example mood 3 of 5) go to both: B saves the check-in record in SQLite and writes its numbers to VictoriaMetrics through C's ingest helper, so trend charts have one source.

## Who owns what

| | A: frontend | B: backend | C: data engineer |
|---|---|---|---|
| Folders | `web/` | `api/` | `pipeline/`, `data/`, `deploy/` |
| Requirements | M1, M2 (UI), M3, M4, M6, M7, D2, U1, U2, U5–U8 (UI) | M5, D1, D3–D7, U3, U4, U9, U11, S3 (logic and API) | M2b, M8, M9, S1, S2 (data), data requirements, threshold citations |
| Claude agent | `frontend` | `backend`, `architect` for the data model | `data-sim` for generators, `backend` for pipeline code |
| Tests | Not needed for pure styling | Required, see B's list | Required, see C's list |

Contracts between people (change them only through a `shared/` PR, see `docs/GIT-WORKFLOW.md`):

- **A ↔ B:** the HTTP API, described in `api/openapi.json` (FastAPI generates it). A generates TypeScript types from it. A never calls VictoriaMetrics or reads data files.
- **B ↔ C:** the metric naming schema in `docs/DECISIONS.md` and the query functions in `pipeline/queries/`. B never writes raw MetricsQL in the API, it calls C's query functions.

## Hour 0, all three together (before anyone branches)

1. Write `docs/DECISIONS.md`:
   - Stack (FastAPI or Node, React + Vite + TypeScript, VictoriaMetrics single-node, SQLite).
   - **Metric schema** (C leads), for example `hr_bpm{crew_id="a1", source="sim"}`, `bp_systolic_mmhg`, `bp_diastolic_mmhg`, `glucose_mg_dl`, `body_temp_c`, `sleep_hours`, `mood_score`, `co2_ppm{module="node1"}`, `symptom_strength{symptom="headache"}`. Every series has `source="sim"` or `source="nasa"`.
   - **Record shapes** (B leads): check-in, alert, consult brief, ground reply, surgeon note, flag, sync record.
   - **First API endpoints** (B leads, A agrees): see B's list below.
2. C commits `deploy/docker-compose.yml` with VictoriaMetrics. B commits the API skeleton with `/health`. A commits the Vite app. All three in one go on `main`, then everyone branches.

---

## A: frontend

**Goal:** every screen in the demo path looks finished and reads at a glance, on mock API data first, real API later.

| # | Deliverable | Requirements | Done when |
|---|---|---|---|
| A1 | Design tokens, status pill (icon + word + color) | M3 | Status is readable without color |
| A2 | Indicator cards with value, unit, status, baseline band, 7-day chart; dashboard | M2, M4 | Charts update after a new check-in |
| A3 | Clickable body map with an explainer per region, blood region opens the OSD-569 card | M1, M2b, M6 | Every region opens a panel |
| A4 | 30-second check-in with "Same as yesterday", then today's readout | D2, U1, U2 | Under 30 seconds, 4 steps or fewer |
| A5 | Consult brief with pinned items and an editable question | D5, U5 | Brief is sent and shows as queued |
| A6 | Ground role: crew list, inbox, full record, reply box, notes, "Last sync" | D7, U6 | A note written here shows in the astronaut view |
| A7 | Astronaut's "What ground sees" view | D4 | Same content as the Ground screen |
| A8 | Cabin Link chart, Environment Switcher | S1, S2 | Uses C's real data |
| A9 | Crew Readiness, Mission Quest, only if time is left | S3, S4, U7 | |

**Rules:** call only the API, with a typed client generated from `api/openapi.json`; until an endpoint exists, use mocks in `web/src/mocks/` with the same types. Copy goes in `web/src/content/`. 44px touch targets, 4.5:1 contrast, keyboard use, dark theme, no runtime CDN (fonts and chart library bundled). Every simulated value shows "Simulated", every health message uses decision-support wording.

---

## B: backend

**Goal:** one record, two views. All health logic as pure, tested functions behind an API that A calls.

**Folder layout:**

```
api/
  domain/      pure functions: baseline, drift, alerts, views, brief pinning. No I/O.
  store/       SQLite: check-ins, briefs, replies, notes, flags, alerts, sync log
  metrics/     thin adapter that calls C's query functions in pipeline/queries/
  link/        simulated ground link: windows, queue, delivery
  routes/      HTTP endpoints
  tests/
```

**Deliverables, in order:**

| # | Deliverable | Requirements | Done when |
|---|---|---|---|
| B1 | API skeleton, SQLite schema, `/health`, OpenAPI export | | A can generate types |
| B2 | **Baseline** per indicator from the last N days of readings (from C's queries). Calibration: first 7 days return "learning, day N of 7" and no drift alerts | D1, U3 | Unit tests with fixed inputs |
| B3 | **Drift detection** against the personal baseline. OSD-569 and Earth ranges are returned as reference only, never trigger an alert | D1 | Tests: normal in-flight value inside personal band gives no alert even if outside Earth range |
| B4 | **Alerts**: what changed, one next step, "Contact the flight surgeon if...". One per day, the rest in "Worth checking". Follow-up and close | M5, U4, U9 | Tests for ranking and the one-per-day rule |
| B5 | **Check-in endpoint**: save the record, write its numbers to VictoriaMetrics via C's ingest helper, return today's readout | D2, U1, U2 | Check-in shows on the trend chart |
| B6 | **Open record**: `GET /astronaut/{id}/view` and `GET /ground/{id}/view` built from the same record by one function | D3, D4 | Test: every note, flag and assessment from the ground view is in the astronaut view |
| B7 | **Consult brief**: create with the alert's items pinned, queue until next link, reply linked to the brief | D5, U5, U10 | Test: pinned items match the alert |
| B8 | **Ground link simulation and sync log**: link windows (demo parameter), what was sent and when, a "sync now" endpoint for the demo | D6, D7 | Sync log lists every sync |
| B9 | Surgeon notes per item, watch flag, measurement request | U11 | Visible in astronaut view |
| B10 | Crew Readiness: status per person, not raw data | S3 | |

**First endpoints to agree with A in hour 0:**

```
GET  /crew                              crew list with status
GET  /astronaut/{id}/view               dashboard: indicators, baseline, status, alert, notes, replies
GET  /ground/{id}/view                  same record, ground layout
GET  /astronaut/{id}/series/{metric}    points for a trend chart (?days=7)
GET  /reference/osd569                  Earth reference ranges with citation
POST /astronaut/{id}/checkin
POST /astronaut/{id}/briefs             GET /ground/inbox
POST /briefs/{id}/reply                 POST /astronaut/{id}/notes
POST /link/sync                         GET  /link/log
```

**Rules:** `api/domain/` does no I/O and never reads the clock, so tests are deterministic (pass time in). Every threshold has a source comment or `# Demo parameter`. No user accounts or auth, role is a switch in the UI. The API works with no internet.

**Done when:** tests pass, A has no mocks left in the demo path, and the full demo runs against the API.

---

## C: data engineer

**Goal:** VictoriaMetrics full of a believable 14-day mission, real NASA data visible, ready-made queries for B, and a stack that starts with no internet.

**Folder layout:**

```
deploy/
  docker-compose.yml   victoriametrics, api, web. Pinned image versions
pipeline/
  ingest/              helper to write points to VictoriaMetrics (used by the simulator and by B)
  simulator/           14-day mission generator, fixed seed, plus "live" replay for the demo
  osd569/              ETL: raw CSV + ISA metadata -> data/processed/osd569.json
  queries/             query functions over MetricsQL: series, baseline window, CO2-symptom correlation
  tests/
data/
  raw/                 NASA files untouched, README per file: dataset ID, URL, access date
  processed/           clean JSON the API serves
  simulated/           generator output snapshots, labeled simulated
```

**Deliverables, in order:**

| # | Deliverable | Requirements | Done when |
|---|---|---|---|
| C1 | **VictoriaMetrics up** in docker compose: volume, retention long enough for the mission, metric schema in `docs/DECISIONS.md` | | `docker compose up` and a test point is queryable |
| C2 | **Ingest helper** in `pipeline/ingest/` that writes points with labels and timestamps (via `/api/v1/import`) | | B can call it from the check-in endpoint |
| C3 | **Simulator**: 14 days for 3 crew, fixed seed, all indicators plus CO2 and headaches. Story: steady baseline, CO2 rise that precedes headaches, sleep-debt drift, recovery. All series `source="sim"`. Timestamps relative to now (last 14 days) | M2, data reqs | Same seed gives the same data. A reset command reloads it |
| C4 | **OSD-569 ETL** to `data/processed/osd569.json`: value, min, max per indicator, dataset ID, URL, access date | M8, M2b | B serves it, A shows it with the citation |
| C5 | **Query functions** in `pipeline/queries/`: series for a chart, baseline window stats (mean, spread over N days), latest value, daily aggregates | D1 | B's baseline uses them, tests against a seeded VictoriaMetrics |
| C6 | **Cabin Link**: CO2 vs headache correlation query with lag, cited CO2 limit | S1 | Returns the data for A's chart |
| C7 | **Citations**: every threshold gets a NASA source or the label "Demo parameter"; environment hazard text for the Environment Switcher | S2, rule 7 | No unlabeled number left |
| C8 | **Offline check**: images pre-pulled and pinned, no runtime downloads, demo runs with Wi-Fi off | M9 | Checked on the demo laptop |
| C9 | **Demo support**: "live replay" that pushes today's readings during the demo, reset script, demo script and pitch with A (`.claude/skills/demo-readiness/SKILL.md`) | | Full rehearsal once a day |

**First deliverable, within the first few hours:** C1 + C2 + a small simulated sample, so B can query real series early.

**VictoriaMetrics gotchas:**

- Points older than the retention period are dropped. Set `-retentionPeriod` to cover the mission and generate timestamps relative to now.
- Points far in the future are rejected. Do not date the mission in the future.
- By default queries hide the last 30 seconds of data (`-search.latencyOffset`). Lower it, or the live check-in will not show up on the chart in the demo.
- VictoriaMetrics stores numbers only. Text (notes, briefs, symptom descriptions) goes to B's SQLite.

**Rules:** raw NASA files are never edited, processing is a script that can be re-run. Every series has `source="sim"` or `source="nasa"` so the UI can label it. Inspiration4 values are labeled "Inspiration4 crew sample, not your labs". No real patient data.

**Done when:** `docker compose up` on a laptop with Wi-Fi off starts the full stack with 14 days of data, OSD-569 is visible with its citation, and the demo rehearsal passes.

---

## Handoffs

| From | To | What | When |
|---|---|---|---|
| All | All | `docs/DECISIONS.md`: stack, metric schema, record shapes, first endpoints | Hour 0 |
| C | B | VictoriaMetrics running, ingest helper, sample data | First few hours |
| B | A | OpenAPI file, then endpoints one by one (A swaps mocks out) | As each lands |
| C | B | Query functions (C5) | Before B2 |
| C | B, A | OSD-569 JSON, full 14-day mission | After C3, C4 |
| A | C | Clickable demo path | Before rehearsal |

Short sync every morning and evening (5 minutes): what merged, what is blocked, any change to the API or the metric schema.

## If time runs short

Cut in this order: Radiation Budget Coach, Camera Check, Mission Quest, Crew Readiness, Environment Switcher, live replay (use the static 14 days). If A falls behind, C moves onto UI polish. If B falls behind, C takes the sync log (B8). Never cut: body map, indicators, check-in, consult brief and flight surgeon screen (our difference), offline mode, OSD-569 data.
