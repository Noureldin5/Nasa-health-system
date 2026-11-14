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

`docs/DECISIONS.md` exists (draft by C, sections 1 to 7). Role C's pipeline is built on branch `c/data-pipeline`; `web/` and `api/` are not started. See "Role C status" below.

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
8. `docs/DECISIONS.md`: sections 8 and 9 (record shapes, first endpoints) are B's to write.
9. **Ask the submission deadline.** Competitor repos were pushed up to today, so the event may be running now. The deadline decides how much of the consult layer to build.
10. **Verify the competitor claims** in `docs/research/competitors.md` (they come from each repo's README, from a sample of about a dozen). Re-check before submission whether anyone added a consult feature.

## Role C status (2026-11-14, branch `c/data-pipeline`, not pushed)

Done, with tests (`make check`, 102 tests): C1 VictoriaMetrics in compose, C2 ingest and queries, C3 simulator (14 days, live replay), C4 OSD-569 ETL, C5 `daily` and `baseline_window`, C6 `cabin_link`, C7 citations audit and `data/processed/hazards.json`, C9 `make clear-manual` and `make demo-reset`, C8 offline check as far as one machine allows (`deploy/README.md`). OSDR terms of use are in `data/raw/osd569/README.md`.

Fixed after the advisor review:
- OSD-569 sample C003 L-92 looks shifted in both NASA files (MPV 330 fL, platelets 12.9). It is kept as published, flagged `quality: "suspect"` and left out of `crew_sample` and `vs_range`. **Confirm against the OSDR page before the pitch.** The raw files are untouched.
- `daily()` marks an unfinished day `complete=False` and `baseline_window` leaves it out. **B: baseline through `today - 1`** (DECISIONS section 5).

Open, needs the team (not decided by C):
1. **Cabin Link shows no correlation on the planned demo day. Not fixed: needs a story decision.** With today = day 10, a1's day-10 headache is the live check-in, so the simulated data has no symptom day and `lags[*].r` is `None` (the guard wants at least 2 symptom days; `pipeline/tests/test_demo_moment.py` pins this). On the full 14 days (run, not estimated) lag 0 gives r = 0.82, lag 1 r = 0.66 and lag 2 r = 0.02, so "lag 0 beats lag 1" even though the rise (day 9) comes before the first headache (day 10): CO2 stays high through day 11, so the daily series move together. Options: (a) the UI leads with the day overlay (CO2 above usual from day 9, `hours_above_limit`, the symptom on day 10) and shows `r` only after day 11; (b) add an earlier mild headache episode for a1 to the story, which changes `docs/USER-FLOW.md`; (c) lower `MIN_SYMPTOM_DAYS` to 1 (a single point is not a correlation, so not recommended).
2. **Done:** simulated node1 CO2 no longer passes the cited limit. `CO2_RISE_PPM` went from 1,900 to 1,000 (Demo parameter): zero hours above 3,947 ppm over the 14 days, daily means up to about 3,700 ppm against a usual 2,700. The story in `docs/USER-FLOW.md` does not pin the peak.
3. DECISIONS section 7, items 1 to 4 (which day is today, `source="manual"`, cadence of daily vitals, blood-count card wording). `source="manual"` is already implemented; `docs/TEAM.md` still lists only `sim` and `nasa`.
4. B: SQLite reset command, and add it to `make demo-reset` (DECISIONS section 6).
5. Read NASA-STD-3001 Vol 2 [V2 6004] and Law et al. 2014 first-hand. `pipeline/references.py` says they were taken from NASA's brief and the abstract.
6. Offline check on the demo laptop with all three services (`deploy/README.md`).
7. Acknowledgement sentence for OSDR data: confirm the exact wording on the OSDR FAQ before submission.
8. The female reference ranges in OSD-569 differ per row (hemoglobin has two): A cannot assume one min and max per indicator.
9. `docs/CHALLENGE.md` still lacks judging criteria and submission rules.

For B and A: `data/processed/osd569.json` gained `values[].quality` (`"ok"` or `"suspect"`) and `values[].vs_range` can now be `null` (for suspect values). `crew_sample` and `earth_reference_ranges` count `ok` values only. Show a suspect value, if at all, with a note.

Edits C made outside C's folders (shared or A's notes): `Makefile` (targets `clear-manual`, `demo-reset`), `docs/DECISIONS.md`, `docs/DESIGN.md` (one line, the CO2 limit).

## Gotchas

- A first-write hook in this environment blocks the first creation of each file until facts are stated. Retry once with the facts.
- The design canvases need the Design runtime. Open the links, do not try to open the `.dc.html` files in a browser.
- `.serena/` is untracked and not ignored. Leave it out of commits.
- `.claude/settings.local.json` and the headroom marker are git-ignored (machine-specific proxy and hooks).
- Each teammate commits under their own git name. No Claude co-author lines, by request.

## Next step

Merge `c/data-pipeline` into `main` (a pull request, `docs/GIT-WORKFLOW.md`) so B and A can import `pipeline/`. Then answer the open items above, starting with 1 and 2 (they change the demo story), and B writes DECISIONS sections 8 and 9.
