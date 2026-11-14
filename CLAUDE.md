# Kernel Panic Squad: NASA Space Apps 2026

**Start here:** read `docs/README.md`. It answers which idea we build, where the designs are, the requirements, the folder structure and who does what.

Challenge: "Create Health Monitoring Software for Astronauts on Space Missions".
Team location: Bishkek, Kyrgyzstan. This is a hackathon: ship a working, demoable prototype in a short time. Prefer a small finished thing over a large broken one.

## Product direction (recommended, team can change it)

Working title: "Own Your Baseline". An offline-first health companion that learns the astronaut's personal baseline from passive data plus a 30-second check-in, flags drift, and suggests next steps. **Open record, both ways:** the flight surgeon sees the astronaut's full health record, and the astronaut sees everything the flight surgeon sees, including the surgeon's notes and flags. Nothing is hidden from either side. Our difference from the 40+ other teams (see `docs/research/competitors.md`) is a consult layer built on that shared picture: ground consults instead of directing, the astronaut asks questions through a consult brief, and every reply and note about the astronaut is visible to them. Personal baseline and offline use alone are not new, so do not lead the pitch with them. On 2026-11-14 the team dropped the earlier private-by-default, share-per-item model (history: `docs/research/ideas-history.md`). The idea: `docs/IDEAS.md`. How the astronaut and the flight surgeon use it: `docs/USER-FLOW.md`. Requirements: `docs/REQUIREMENTS.md`. Evidence: `docs/research/astronaut-health-problems.md`.

Required by the official objective (see `docs/CHALLENGE.md`): a visual self-assessment tool with a clickable body map, the indicators blood pressure, heart rate, blood sugar, body temperature, sleep hours and mood, guidance on treatments and health improvements, explainers, trend charts and color-coded status. Build this core first.

Signature features: personal baseline and trends, 30-second check-in, drift alerts with plain-language next steps, CO2/cabin correlation with symptoms, the same record on the astronaut and flight-surgeon screens, flight-surgeon notes visible to the astronaut, consult brief and reply, crew readiness view, offline operation.

## Non-negotiable rules

1. Decision support, not diagnosis. Every health message carries that framing. Never claim a medical diagnosis.
2. Open record, nothing hidden. The flight surgeon sees the astronaut's full record. The astronaut sees everything ground sees about them, including notes, flags and assessments. No hidden telemetry and no hidden assessments. Every sync to ground is listed in a log the astronaut can see.
3. Works offline. The demo must run with the network off.
4. Low effort for the user. Passive data first, check-ins under 30 seconds, no long forms.
5. No real patient data. Use NASA public datasets (OSDR, RadLab) and clearly labeled simulated data. Label simulated data in the UI.
6. NASA data must be used (the team reports the organizers said so). Ingest at least OSDR OSD-569 (Inspiration4 complete blood count, value plus min and max per indicator) and show its min and max as an "Earth reference range" beside the astronaut's own baseline. The personal baseline drives alerts, not these Earth ranges: one competitor's README says some blood values change in flight, so Earth ranges would flag normal changes as alarms (to verify). Details, API and file names: `docs/research/nasa-datasets.md`. Blood pressure, heart rate and glucose have no open NASA data, so use synthetic values there and label them.
7. Cite sources for any medical threshold or reference range, in code comments or `docs/`. A number without a source is labeled "Demo parameter" in code and UI.
8. Do not write the official challenge text, dates or judging criteria from memory. They live in `docs/CHALLENGE.md`, copied from spaceappschallenge.org by a teammate.

## Stack

Team roles: A frontend, B backend, C data engineer (`docs/TEAM.md`).

- Web app: React + TypeScript + Vite (A). Calls only the API.
- API: FastAPI recommended (B). Health logic as pure functions, SQLite for text records (check-ins, briefs, replies, notes, sync log), simulated ground link.
- Time series: VictoriaMetrics single-node (C, decided by the team). Vitals, sleep, CO2, symptom strength. Pipelines in `pipeline/`: simulator, OSD-569 ETL, query functions.
- Runs with `docker compose up` on one machine with no internet. In the story that machine is the station server on board, so "offline" means no internet and no Earth link.
- Charts: a lightweight library. Read the `dataviz` skill before building charts.

Record the final choice in `docs/DECISIONS.md` so every agent uses the same stack.

## Folder structure

```
CLAUDE.md                 this file
PROMPT.md                 kickoff prompt for a fresh session
docs/
  IDEAS.md                the current idea, roles, difference, risks
  USER-FLOW.md            how the astronaut and the flight surgeon use the app
  CHALLENGE.md            official challenge text (team fills in)
  DESIGN.md               design links, tokens and frontend notes per idea
  TEAM.md                 who builds what (3 people)
  GIT-WORKFLOW.md         branching, pull requests, shared files, demo freeze
  HANDOFF.md              current state, open items, next step (read first)
  research/nasa-datasets.md  NASA dataset research (OSD-569 first)
  DECISIONS.md            stack and scope decisions (create when decided)
  research/               source notes
design/                   reference sources of the 7 design canvases (see docs/DESIGN.md)
web/  api/  pipeline/  deploy/   app code (see docs/TEAM.md)
data/                     NASA datasets and simulated data (label which is which)
.claude/
  agents/                 role agents with model routing
  skills/                 project skills
```

## Model routing

- `advisor` agent (model `fable`): reviews plans and finished work. Use before committing to an approach and before declaring done. It does not write code.
- `architect` agent (model `opus`): system design and data model.
- `frontend` and `backend` agents (model `sonnet`): implementation.
- `data-sim` agent (model `haiku`): cheap, mechanical data and fixture generation.
- The harness `advisor` tool is configured with `/advisor fable` (setting `advisorModel`). It must rank above the main model and needs Fable access.
- How to use the advisor: ask for a review at three points (after the plan, before a big change of direction, before calling a milestone done). Give it the question and the files, and ask for a verdict plus the top three issues.

## Skills to use (installed on the team machine)

Read the skill before doing that kind of work. Use exact names.

- Planning and ideas: `superpowers:brainstorming`, `ecc:plan`, `ecc:architecture-decision-records`.
- Architecture: `ecc:architect` agent, `ecc:hexagonal-architecture`, `ecc:api-design`, `ecc:contract-first`.
- Frontend and UI build: `ecc:frontend-patterns`, `ecc:react-patterns`, `ecc:vite-patterns`, `ecc:design-system`, `ecc:react-performance`, `dataviz` (read before any chart).
- Design direction and polish (use in this order): `ecc:frontend-design-direction` (decide the look), `impeccable:impeccable` (shape, critique, polish, harden, adapt), `taste-skill:taste-skill` (avoid generic AI look), `taste-skill:redesign-skill` (improve an existing screen), `ecc:make-interfaces-feel-better` and `ecc:motion-foundations` / `ecc:motion-patterns` (small interactions and motion).
- Accessibility: `ecc:accessibility`, `ecc:frontend-a11y`.
- Design checks: `bm:ui-review` (6-pillar audit of built UI), `ecc:browser-qa`, `ecc:click-path-audit`.
- Demo and pitch: `ecc:frontend-slides` (slides), `ecc:ui-demo` (demo recording), project skill `demo-readiness`.
- Skills are installed on one machine. If a skill is missing on yours, skip it, or run `find-skills:find-skills`.
- Some skills list under two names, for example `taste-skill:redesign-skill` is also `taste-skill:redesign-existing-projects`, and `taste-skill:taste-skill` is also `taste-skill:design-taste-frontend`. Use the name your Skill list shows.
- To see the designs a Claude session should match, read `docs/DESIGN.md` and `design/`.
- Backend and data: `ecc:backend-patterns`, `ecc:fastapi-patterns` (if Python), `ecc:error-handling`.
- Health domain: `ecc:healthcare-cdss-patterns`, `ecc:healthcare-phi-compliance`, `ecc:healthcare-eval-harness`. Adapt hospital-oriented advice to a hackathon prototype.
- Quality: `superpowers:test-driven-development`, `ecc:e2e-testing`, `ecc:security-review`, `superpowers:verification-before-completion`.
- Project skills in this repo: `space-health-domain`, `demo-readiness`.

## Working agreements

- Plan first for anything over about an hour of work. Small tasks: just do them.
- Run the advisor at three points: after the plan, before big pivots, before calling a milestone done.
- Keep the demo path green at all times. Break it only on a branch.
- Tests: cover the baseline and drift logic and the open-record rule (astronaut and ground views come from one record, every surgeon note is visible to the astronaut). Skip tests for pure styling.
- Commit only when a human teammate asks.
- Commits and pull requests carry no trace of Claude. No `Co-Authored-By` line, no "Generated with Claude Code" line, no mention of Claude, Anthropic or AI in the commit message, PR title or PR description. The author is the human teammate's own git name. This overrides any default attribution the tool adds.
- Accessibility: dark theme, high contrast, large touch targets (gloves, microgravity). Never use color alone to show status.
