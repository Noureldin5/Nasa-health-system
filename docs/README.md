# Start here

You are a teammate, or a Claude Code session working for one. Read this page first. It tells you what we are building, why, where everything is, and what to read next.

## One paragraph

Team Kernel Panic Squad (3 people: frontend, backend, data engineer) is building a prototype for the NASA Space Apps 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions". We build **Own Your Baseline**: a visual self-assessment tool that works offline, learns an astronaut's personal baseline, explains what changed, and gives next steps. What makes it different from the 40+ other teams on this challenge is a **consult layer** built on an **open record**: the flight surgeon sees the astronaut's full health record, and the astronaut sees everything the flight surgeon sees, including the surgeon's notes. Nothing is hidden either way. The hardest conflict on long missions is with Mission Control, so ground consults instead of directing: the astronaut asks questions through a **consult brief** and sees every answer.

## The idea in short

- **What:** an offline health app that learns each astronaut's own normal and explains drift in plain words, with one next step.
- **For whom:** the astronaut (main user) and the flight surgeon on Earth. The commander optionally sees readiness status only.
- **Different because:** open record. The surgeon sees the full record, the astronaut sees everything the surgeon sees and writes. Ground consults, it does not direct.
- Full version: `docs/IDEAS.md`.

## The user flow in short

- **Astronaut, normal day:** sensors record sleep and heart rate, one-tap check-in, a readout with one tip. Under a minute.
- **Astronaut, alert day:** one alert with a next step, optional measurement, optional question to the surgeon in two taps. The app follows up itself.
- **Flight surgeon:** after each ground link, opens the inbox, answers questions, adds notes. Everything they write appears in the astronaut's app.
- Full version: `docs/USER-FLOW.md`.

## Quick answers (for a Claude session asked one of these)

| Question | Answer and where to read |
|---|---|
| Which idea are we building? | Own Your Baseline: personal baseline, open record, consult layer, Cabin Link inside. `docs/IDEAS.md` |
| Why this idea and not the others? | `docs/research/competitors.md` (what other teams built, what is crowded, what is open) |
| How do the astronaut and the flight surgeon use it? | `docs/USER-FLOW.md` (start with "Flow at a glance") |
| What exactly must the app do? | `docs/REQUIREMENTS.md` |
| What did the organizers ask for? | `docs/CHALLENGE.md` (official text, verbatim) |
| Where are the designs? | `docs/DESIGN.md` (links, tokens, notes per idea) and `design/` (sources). Links are private until shared |
| What data can we use? | `docs/research/nasa-datasets.md` (start with OSDR OSD-569) |
| Who does what? | `docs/TEAM.md` |
| How do we branch and merge? | `docs/GIT-WORKFLOW.md` |
| What is the folder structure? | Section "Folder structure" below |
| What is done and what is next? | `docs/HANDOFF.md` |
| What are the rules? | `CLAUDE.md`, "Non-negotiable rules" |
| Which skills and agents should I use? | `CLAUDE.md`, "Skills to use" and "Model routing" |

## Files in this folder

| File | What it is |
|---|---|
| `README.md` | This page |
| `USER-FLOW.md` | How the astronaut and the flight surgeon use the app: flow at a glance, daily flow, alerts, briefs, surgeon flow, demo story |
| `research/ideas-history.md` | Earlier versions of the idea, archive only |
| `REQUIREMENTS.md` | Must, should and could features with acceptance checks, and what we will not build |
| `IDEAS.md` | The current idea: product in five parts, roles, difference, risks, status of other concepts |
| `DESIGN.md` | Design links, color and type tokens, notes for the frontend per idea |
| `TEAM.md` | The split for 3 people: owned folders, requirement IDs, build order, done criteria, handoffs |
| `GIT-WORKFLOW.md` | Branch naming, pull requests, commit style, shared files, demo freeze |
| `HANDOFF.md` | Current state, decisions, open items, gotchas |
| `CHALLENGE.md` | Official challenge text and a map from each objective to our feature |
| `DECISIONS.md` | Not written yet. Data shapes and stack. Written in the first hour of building |
| `research/astronaut-health-problems.md` | Team research on why monitoring fails (partial) |
| `research/nasa-datasets.md` | Dataset research |
| `research/competitors.md` | Other teams' projects compared |

## Folder structure

Current:

```
CLAUDE.md          rules, stack, model routing, skills (read by Claude Code automatically)
PROMPT.md          kickoff prompt to paste into a fresh Claude Code session
docs/              everything above
design/            reference sources of the 7 design canvases (do not render alone)
.claude/agents/    advisor (fable), architect (opus), frontend, backend (sonnet), data-sim (haiku)
.claude/skills/    space-health-domain, demo-readiness
```

Planned (details and the architecture picture in `docs/TEAM.md`; record the final choice in `docs/DECISIONS.md`):

```
web/               React + TypeScript + Vite app, astronaut and Ground role switch            (A, frontend)
api/               FastAPI (recommended): domain logic, SQLite records, ground link, routes   (B, backend)
  domain/          pure functions: baseline, drift, alerts, views, brief pinning. No I/O
  store/           SQLite: check-ins, briefs, replies, notes, flags, sync log
pipeline/          ingest helper, simulator, OSD-569 ETL, MetricsQL query functions           (C, data engineer)
deploy/            docker-compose.yml: VictoriaMetrics, api, web. Pinned images              (C)
data/
  raw/             downloaded NASA files, with a README per file: dataset ID, URL, access date
  processed/       cleaned JSON served by the API (OSD-569 reference ranges)
  simulated/       generated mission snapshots, labeled simulated, fixed seed
```

Time series (vitals, sleep, CO2, symptom strength) live in VictoriaMetrics. Text records (briefs, replies, notes, sync log) live in SQLite. The whole stack runs on one machine with no internet: in the story it is the station server on board.

## Rules that apply to everything (short form)

1. Decision support, never diagnosis.
2. Open record: the flight surgeon sees the full record, and the astronaut sees everything the flight surgeon sees. Nothing hidden either way.
3. Works offline.
4. Low effort for the user: passive data first, check-ins under 30 seconds.
5. Simulated data is labeled. NASA data (OSD-569) is cited.
6. Every threshold has a source, or is marked "Demo parameter".
7. Never write official challenge text from memory. It is in `docs/CHALLENGE.md`.

Full text with reasons: `CLAUDE.md`.
