# Start here

You are a teammate, or a Claude Code session working for one. Read this page first. It tells you what we are building, why, where everything is, and what to read next.

## One paragraph

Team Kernel Panic Squad (3 people) is building a prototype for the NASA Space Apps 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions". We build **Own Your Baseline**: a visual self-assessment tool that works offline, learns an astronaut's personal baseline, explains what changed, and gives next steps. What makes it different from the 40+ other teams on this challenge is a **consult layer** built around the real reason monitoring fails: astronauts hide symptoms for fear of being grounded, and the hardest conflict is with Mission Control. The astronaut chooses what ground sees, previews it, and sends a **consult brief** on their own terms.

## Quick answers (for a Claude session asked one of these)

| Question | Answer and where to read |
|---|---|
| Which idea are we building? | Own Your Baseline plus the consult layer, with Cabin Link inside it. `docs/IDEAS.md`, section "Update after competitor research" |
| Why this idea and not the others? | `docs/research/competitors.md` (what other teams built, what is crowded, what is open) |
| What exactly must the app do? | `docs/REQUIREMENTS.md` |
| What did the organizers ask for? | `docs/CHALLENGE.md` (official text, verbatim) |
| Where are the designs? | `docs/DESIGN.md` (links, tokens, notes per idea) and `design/` (sources). Links are private until shared |
| What data can we use? | `docs/research/nasa-datasets.md` (start with OSDR OSD-569) |
| Who does what? | `docs/TEAM.md` |
| What is the folder structure? | Section "Folder structure" below |
| What is done and what is next? | `docs/HANDOFF.md` |
| What are the rules? | `CLAUDE.md`, "Non-negotiable rules" |
| Which skills and agents should I use? | `CLAUDE.md`, "Skills to use" and "Model routing" |

## Files in this folder

| File | What it is |
|---|---|
| `README.md` | This page |
| `REQUIREMENTS.md` | Must, should and could features with acceptance checks, and what we will not build |
| `IDEAS.md` | Ranked concepts and the recommendation |
| `DESIGN.md` | Design links, color and type tokens, notes for the frontend per idea |
| `TEAM.md` | The split for 3 people and handoffs |
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

Planned (recommendation, record the final choice in `docs/DECISIONS.md`):

```
src/
  domain/          pure logic, no UI or storage imports: baseline, drift, alerts, consent, consult brief   (Person B)
  storage/         IndexedDB layer and export                                                              (Person B)
  data/            loaders and processed NASA and simulated data                                           (Person C)
  ui/              components and screens                                                                  (Person A)
  content/         explainer text, environments, copy (plain data files)                                   (Person A with C)
data/
  raw/             downloaded NASA files, with a README per file: dataset ID, URL, access date
  processed/       cleaned JSON used by the app
  simulated/       generated mission data, labeled simulated, fixed seed
public/            service worker, self-hosted fonts
tests/
```

## Rules that apply to everything (short form)

1. Decision support, never diagnosis.
2. The astronaut owns the data. Nothing leaves the device unless the astronaut shares it.
3. Works offline.
4. Low effort for the user: passive data first, check-ins under 30 seconds.
5. Simulated data is labeled. NASA data (OSD-569) is cited.
6. Every threshold has a source, or is marked "Demo parameter".
7. Never write official challenge text from memory. It is in `docs/CHALLENGE.md`.

Full text with reasons: `CLAUDE.md`.
