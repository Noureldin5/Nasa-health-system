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

No application code exists yet. `docs/DECISIONS.md` does not exist yet.

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
5. **Dataset research paste was partly cut off.** Re-check the Python download sketch, the HRP risks section and the OSDR license terms.
6. **Ask the organizers:** do labeled synthetic values count where no open NASA data exists?
7. **Placeholders to replace with cited NASA sources:** CO2 limit (3,500 ppm), flight-surgeon thresholds, radiation budget, environment hazard text.
8. Write `docs/DECISIONS.md` (data shapes and stack) in the first hour of building.
9. **Ask the submission deadline.** Competitor repos were pushed up to today, so the event may be running now. The deadline decides how much of the consult layer to build.
10. **Verify the competitor claims** in `docs/research/competitors.md` (they come from each repo's README, from a sample of about a dozen). Re-check before submission whether anyone added a consult feature.

## Gotchas

- A first-write hook in this environment blocks the first creation of each file until facts are stated. Retry once with the facts.
- The design canvases need the Design runtime. Open the links, do not try to open the `.dc.html` files in a browser.
- `.serena/` is untracked and not ignored. Leave it out of commits.
- `.claude/settings.local.json` and the headroom marker are git-ignored (machine-specific proxy and hooks).
- Each teammate commits under their own git name. No Claude co-author lines, by request.

## Next step

Hour 0 in `docs/TEAM.md`: all three agree `docs/DECISIONS.md` (stack, metric schema, record shapes, first endpoints), commit the skeletons, then branch per `docs/GIT-WORKFLOW.md`. To use Claude Code, paste `PROMPT.md` into a fresh session.
