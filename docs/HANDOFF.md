# Handoff

Written 2026-11-14. Read this first when picking up the project, then `CLAUDE.md`.

## Project

NASA Space Apps 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions". Team Kernel Panic Squad, Bishkek. Chosen product: Own Your Baseline (offline health companion that learns the astronaut's own baseline) plus a consult layer on an open record (the flight surgeon sees the full record, the astronaut sees everything the surgeon sees, consult brief and reply), with Cabin Link inside it. The consult layer is the difference from 40+ other teams. Offline use and baselines alone are not new. See `docs/README.md`.

## What exists

| Path | What |
|---|---|
| `CLAUDE.md` | Product rules, stack recommendation, model routing, skill names |
| `PROMPT.md` | Kickoff prompt for a fresh Claude Code session |
| `.claude/agents/` | advisor (fable), architect (opus), frontend and backend (sonnet), data-sim (haiku) |
| `.claude/skills/` | `space-health-domain`, `demo-readiness` |
| `docs/CHALLENGE.md` | Official challenge text (verbatim) and objective-to-feature table |
| `docs/IDEAS.md` | The current idea: product, roles, difference, risks |
| `docs/USER-FLOW.md` | How the astronaut and the flight surgeon use the app, step by step |
| `docs/research/ideas-history.md` | Earlier versions of the idea (archive) |
| `docs/DESIGN.md` | Design links, tokens and frontend notes for each idea |
| `design/` | Reference sources of the 7 design canvases (do not render alone) |
| `docs/TEAM.md` | Split of work across 3 people: owned folders, requirement IDs, build order, done criteria |
| `docs/GIT-WORKFLOW.md` | Branch naming, pull requests, shared files, demo freeze |
| `docs/research/astronaut-health-problems.md` | Team research (partial) |
| `docs/research/nasa-datasets.md` | Dataset research, OSD-569 first (partly garbled paste) |
| `docs/research/competitors.md` | Other teams' projects, what is crowded, what is open |
| `docs/README.md` | Start-here page: quick answers, file map, folder structure |
| `docs/REQUIREMENTS.md` | Must, should and could features with acceptance checks |

`docs/DECISIONS.md` exists: sections 1 to 7 by C, 8 to 10 by B. Role C's pipeline is built on branch `c/data-pipeline` (merged with `origin/main`, not pushed). B's API is in `main` (`api/`, runs on in-memory fake metrics); `web/` is not started. See "Role C status" below.

## Decisions made

- Build concept 1 plus the consult layer plus Cabin Link. Roadmap: Radiation Budget Coach, Camera Check. Reason: personal baseline, offline and per-item consent already exist in other teams' projects (see `docs/research/competitors.md`). Start with `docs/README.md` and `docs/REQUIREMENTS.md`.
- NASA data must be used (the team reports organizers said so). Ingest OSD-569 CBC and show its min and max as an "Earth reference range". Status colors and alerts follow the personal baseline (CLAUDE.md rule 6). Blood pressure, heart rate and glucose are synthetic and labeled.
- Decision support, not diagnosis. Offline.
- 2026-11-14: open record replaces private-by-default and per-item sharing. Ground sees the full record, the astronaut sees everything ground sees, including notes. See `docs/IDEAS.md`.
- Daily use and the demo story: `docs/USER-FLOW.md`.
- 2026-11-14: team is one frontend (A), one backend (B), one data engineer (C). Time series go to VictoriaMetrics, text records to SQLite behind an API (FastAPI recommended). Everything runs locally with docker compose, no internet. Split and architecture: `docs/TEAM.md`. Record the details in `docs/DECISIONS.md`.

## Open items

1. **GitHub repo is live** at `https://github.com/Noureldin5/Nasa-health-system`, `main` pushed. Set branch protection on `main` (pull requests required), see `docs/GIT-WORKFLOW.md`.
2. **Share the 7 design links** (in `docs/DESIGN.md`). They are private until shared from each artifact's Share menu.
3. **Fill the official Resources tab links and judging criteria** into `docs/CHALLENGE.md`.
4. **Research sections 1 to 6 are missing** from `docs/research/astronaut-health-problems.md` (the paste began at section 7). Re-paste them.
5. **Dataset research paste was partly cut off.** Re-check the Python download sketch. Done by C on 2026-11-14: the five HRP hazards (`data/processed/hazards.json`) and the OSDR terms (`data/raw/osd569/README.md`).
6. **Ask the organizers:** do labeled synthetic values count where no open NASA data exists?
7. **Placeholders to replace with cited NASA sources:** flight-surgeon thresholds and radiation budget (still open). Done: CO2 limit (3 mmHg, about 3,947 ppm) and environment hazard text.
8. `docs/DECISIONS.md`: sections 8 to 10 are written by B. C answered section 10 on 2026-11-14; row 9 (what a day is) is new and open.
9. **Ask the submission deadline.** Competitor repos were pushed up to today, so the event may be running now. The deadline decides how much of the consult layer to build.
10. **Verify the competitor claims** in `docs/research/competitors.md` (they come from each repo's README, from a sample of about a dozen). Re-check before submission whether anyone added a consult feature.

## Role C status (2026-11-14, branch `c/data-pipeline`, not pushed)

Done, with tests (`make check`: 110 pipeline tests, 117 api tests): C1 VictoriaMetrics in compose, C2 ingest and queries, C3 simulator (14 days, live replay), C4 OSD-569 ETL, C5 `daily` and `baseline_window`, C6 `cabin_link`, C7 citations audit and `data/processed/hazards.json`, C9 `make clear-manual` and `make demo-reset`, C8 offline check as far as one machine allows (`deploy/README.md`). OSDR terms of use are in `data/raw/osd569/README.md`.

Fixed after the advisor review:
- OSD-569 sample C003 L-92 looks shifted in both NASA files (MPV 330 fL, platelets 12.9). It is kept as published, flagged `quality: "suspect"` and left out of `crew_sample` and `vs_range`. **Confirm against the OSDR page before the pitch.** The raw files are untouched.
- `daily()` marks an unfinished day `complete=False` and `baseline_window` leaves it out. **B: baseline through `today - 1`** (DECISIONS section 5).

Open, needs the team (not decided by C):
1. **Done 2026-11-14 (team chose option a): Cabin Link leads with the day overlay.** `CabinLink` now carries `first_high_day`, `first_symptom_day`, `lead_days` and `correlation_ready`; on demo day 10 `r` stays `None` and A shows the overlay and the sentence, with `lags` only once `correlation_ready` (DECISIONS section 5). The full-mission lags (lag 0 r = 0.82, lag 1 r = 0.66, lag 2 r = 0.02, run on 2026-11-14) are a reason not to headline `r`. A still needs to build it.
2. **Done:** simulated node1 CO2 no longer passes the cited limit. `CO2_RISE_PPM` went from 1,900 to 850 (Demo parameter): no 5-minute reading passes 3,947 ppm either (peak about 3,800), daily means up to about 3,500 against a usual 2,700, so a chart with the limit line shows no point above it. The story in `docs/USER-FLOW.md` does not pin the peak.
3. **New, found when confirming section 10: the day boundary.** B groups by the UTC calendar date, the pipeline's mission day starts at 18:00 UTC. Smallest fix: B groups by the Bishkek date `(at + 6 h).date()`. DECISIONS section 10, row 9. Must be settled before the real adapter goes in.
4. DECISIONS section 7, items 1 to 4 (which day is today, `source="manual"`, cadence of daily vitals, blood-count card wording). `source="manual"` is already implemented; `docs/TEAM.md` still lists only `sim` and `nasa`.
5. B: wire the real metrics adapter. Its `seed` calls `pipeline.reset.demo_reset(day)`, so `POST /demo/reset` resets both stores (DECISIONS sections 6 and 10, row 7). Until then `make demo-reset` resets the time series only.
6. Read NASA-STD-3001 Vol 2 [V2 6004] and Law et al. 2014 first-hand. `pipeline/references.py` says they were taken from NASA's brief and the abstract.
7. Offline check on the demo laptop with all services (`deploy/README.md`). The `api` image exists but is not in compose, and its base image is a tag, not a digest.
8. Acknowledgement sentence for OSDR data: confirm the exact wording on the OSDR FAQ before submission.
9. The female reference ranges in OSD-569 differ per row (hemoglobin has two): A cannot assume one min and max per indicator.
10. `docs/CHALLENGE.md` still lacks judging criteria and submission rules.

For B and A: `data/processed/osd569.json` gained `values[].quality` (`"ok"` or `"suspect"`) and `values[].vs_range` can now be `null` (for suspect values). `crew_sample` and `earth_reference_ranges` count `ok` values only. Show a suspect value, if at all, with a note.

Edits C made outside C's folders (shared or A's notes): `Makefile` (targets `clear-manual`, `demo-reset`; `check` now runs the API checks too after the merge), `docs/DECISIONS.md`, `docs/DESIGN.md` (one line, the CO2 limit).

## Role B update (2026-11-14, later, same branch, uncommitted)

Done since the status below (137 API tests pass; the stack was checked on real VictoriaMetrics):
- **Real metrics adapter** `api/metrics/vm.py` (`METRICS_BACKEND=vm`). 5-minute series (heart rate, CO2) become one mean per complete mission day. Typed values are stored as `source="manual"`, so `"manual"` is now in the API `Source` type (OPEN 2 is still unanswered by the team).
- **Docker:** `api` and `web` services in `deploy/docker-compose.yml`. Web on `localhost:8090`, API on `localhost:8000`. Offline start checked on an internal-only network. The first build needs the internet.
- **Gaps from web/README.md closed:** #1 `GET /mission`, #2 timestamps end in `Z`, #3 `POST /astronaut/{id}/measurements`, #8 `GET /link`, #9 `module` and `role` in `CrewRow`. Still open: #4, #5, #6, #7, #12. A's `src/api/http.ts` can drop its workarounds for the closed ones.
- **`POST /demo/advance`** (item 5): next mission day. Reloads the simulated series one day later and moves every SQLite record one day older, so alerts, check-ins and notes keep their order. It does not move the clock: VictoriaMetrics drops samples dated more than about 2 days ahead of real time. Stops with 409 at day 14. Typed values in the time series are cleared by the reload, the check-in records stay.
  - Checked on the real stack: reset to day 10, check in each morning. Alert opens on day 11 and closes on day 13 (two normal days, `ALERT_CLOSE_DAYS`).
  - **Story mismatch to settle with C:** the pipeline gives a1 a headache on days 10 and 11 only, and leaves a1's own today empty (live crew). One day-10 check-in therefore does NOT raise the hero alert, because the pattern needs 2 of the last 3 days. The fake store had headaches on days 9 to 11. USER-FLOW.md says one day-10 check-in raises it. Either C adds a day-9 headache for a1, or the demo script starts the story on day 11.
- Still not done: Cabin Link and hazards data (item 4), DECISIONS section 7 questions (item 6).

## Role B status (2026-11-14, branch `b/osd569-and-day-boundary`)

**Next step: build the real metrics adapter (item 1 below).** Start a branch `b/vm-adapter` from `main`, after the two fixes on this branch are merged.

What is done (all in `api/`, `make check` passes with 127 API tests):
- Every endpoint in `docs/DECISIONS.md` section 9 exists and works, and `api/openapi.json` is up to date. The web app calls only endpoints that exist.
- The whole demo path works against a real server: `cd api && uv run python scripts/demo_walk.py` (check-in, alert, brief, sync, surgeon reply and note, sync, astronaut sees both). It runs with no internet.
- Merged in PR #5: baseline, drift, alerts, SQLite store, check-in, open-record views, consult brief and reply, ground link and sync log, surgeon notes, crew readiness.
- Done on this branch, not yet merged: (1) days are now grouped by mission day (18:00 UTC to 18:00 UTC), which closes row 9 in DECISIONS section 10; (2) `GET /reference/osd569` serves C's real `data/processed/osd569.json`. It returned an error before, because the API model did not match the file.

What is not done, in this order:
1. **Real metrics adapter** (`METRICS_BACKEND=vm` still raises `NotImplementedError`, so the API runs on an in-memory fake and VictoriaMetrics is unused). Follow C's answers in DECISIONS section 10:
   - map metric names (`heart_rate` to `hr_bpm`, and so on) and attach UTC to timestamps;
   - pass `end + 1 microsecond`, because `series` excludes its end;
   - use `daily()` for heart rate and CO2, and baseline through yesterday, because today is a partial day (`complete=False`);
   - use `pipeline.crew.module_of`, and call `flush()` after a write;
   - make `seed` call `pipeline.reset.demo_reset(day)`;
   - turn `VMUnavailable` into `MetricsUnavailable`.
2. **Docker:** add the `api` service to `deploy/docker-compose.yml` (C reviews), make `api/Dockerfile` copy `pipeline/`, then check `docker run --network none`.
3. **Endpoints the web app asked for** (table in `web/README.md`, "Gaps for the backend"). Easiest first: timezone-aware timestamps (`...Z`), `module` and `role` in `CrewRow`, `GET /mission`, `GET /link`. Then `POST /astronaut/{id}/measurements`, a ground-side `as_of` for `/series`, `POST /replies/{id}/ack`, and closing a measurement request when its reading arrives.
4. **Endpoints for C's data:** Cabin Link (`cabin_link()`) and the Environment Switcher (`data/processed/hazards.json`). Nothing serves them yet, so the web app cannot show real CO2 data.
5. **Demo beat "alert closed" (U9)** cannot be shown live, because the clock cannot move to the next day. It needs a demo endpoint that advances the day (with C's live replay).
6. **Needs a team answer** (DECISIONS section 7): which mission day is "today" (API assumes 10), allow `source="manual"`, daily readings for blood pressure, glucose and temperature, and the blood-count card wording.

Traps for whoever builds the adapter: a daily CO2 maximum is a 5-minute peak, so compare against the limit with `hours_above_limit`, not the maximum. An unknown `crew_id` makes the pipeline fall back to `node1` silently, so keep the API check that returns 404 first.

## Gotchas

- A first-write hook in this environment blocks the first creation of each file until facts are stated. Retry once with the facts.
- The design canvases need the Design runtime. Open the links, do not try to open the `.dc.html` files in a browser.
- `.serena/` is untracked and not ignored. Leave it out of commits.
- `.claude/settings.local.json` and the headroom marker are git-ignored (machine-specific proxy and hooks).
- Each teammate commits under their own git name. No Claude co-author lines, by request.

## Next step

1. Merge `c/data-pipeline` into `main` through a pull request (`docs/GIT-WORKFLOW.md`; the branch already contains `origin/main`). It was merged, not rebased, because `Makefile` conflicted on most commits.
2. Settle the day boundary (open item 3 above) and the Cabin Link overlay with B and A, then B wires the adapter.
3. Rehearse the demo with all three services, Wi-Fi off, on the demo laptop (`deploy/README.md`).
