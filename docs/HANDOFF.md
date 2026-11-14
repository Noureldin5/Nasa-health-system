# Handoff

Written 2026-11-14. Read this first when picking up the project, then `CLAUDE.md`.

## Project

NASA Space Apps 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions". Team Kernel Panic Squad, Bishkek. Chosen product: Own Your Baseline (private, offline, personal-baseline health companion) with Cabin Link inside it.

## What exists

| Path | What |
|---|---|
| `CLAUDE.md` | Product rules, stack recommendation, model routing, skill names |
| `PROMPT.md` | Kickoff prompt for a fresh Claude Code session |
| `.claude/agents/` | advisor (fable), architect (opus), frontend and backend (sonnet), data-sim (haiku) |
| `.claude/skills/` | `space-health-domain`, `demo-readiness` |
| `docs/CHALLENGE.md` | Official challenge text (verbatim) and objective-to-feature table |
| `docs/IDEAS.md` | Ranked concepts and recommendation |
| `docs/DESIGN.md` | Design links, tokens and frontend notes for each idea |
| `design/` | Reference sources of the 7 design canvases (do not render alone) |
| `docs/TEAM.md` | Split of work across 3 people |
| `docs/research/astronaut-health-problems.md` | Team research (partial) |
| `docs/research/nasa-datasets.md` | Dataset research, OSD-569 first (partly garbled paste) |

No application code exists yet. `docs/DECISIONS.md` does not exist yet.

## Decisions made

- Build concept 1 plus Cabin Link. Roadmap: Radiation Budget Coach, Camera Check.
- NASA data must be used (the team reports organizers said so). Ingest OSD-569 CBC and drive status colors from its min and max. Blood pressure, heart rate and glucose are synthetic and labeled.
- Decision support, not diagnosis. Private by default. Offline. Per-item sharing.
- Stack is a recommendation only: React, TypeScript, Vite, IndexedDB, service worker. Not final until recorded in `docs/DECISIONS.md`.

## Open items

1. **GitHub push not done.** Local repo on `main` with commits, `origin` set to `https://github.com/Noureldin5/Nasa-health-system.git`. The empty repo must be created on GitHub as `Noureldin5` (no README). Then run: `cd /mnt/storage2/Nasa-hakathon && git -c credential.helper= push -u origin main` and enter the token. The `gh` CLI here is logged in as a different (work) account, so it was not used.
2. **Share the 7 design links** (in `docs/DESIGN.md`). They are private until shared from each artifact's Share menu.
3. **Fill the official Resources tab links and judging criteria** into `docs/CHALLENGE.md`.
4. **Research sections 1 to 6 are missing** from `docs/research/astronaut-health-problems.md` (the paste began at section 7). Re-paste them.
5. **Dataset research paste was partly cut off.** Re-check the Python download sketch, the HRP risks section and the OSDR license terms.
6. **Ask the organizers:** do labeled synthetic values count where no open NASA data exists?
7. **Placeholders to replace with cited NASA sources:** CO2 limit (3,500 ppm), flight-surgeon thresholds, radiation budget, environment hazard text.
8. Write `docs/DECISIONS.md` (data shapes and stack) in the first hour of building.

## Gotchas

- A first-write hook in this environment blocks the first creation of each file until facts are stated. Retry once with the facts.
- The design canvases need the Design runtime. Open the links, do not try to open the `.dc.html` files in a browser.
- `.serena/` is untracked and not ignored. Leave it out of commits.
- `.claude/settings.local.json` and the headroom marker are git-ignored (machine-specific proxy and hooks).
- Commits are authored as `Noureldin5 <ns9121212@gmail.com>`, set for this repo only. No Claude co-author lines, by request.

## Next step

Create the GitHub repo and push. Then: all three agree `docs/DECISIONS.md`, and start the roles in `docs/TEAM.md`. To use Claude Code, paste `PROMPT.md` into a fresh session.
