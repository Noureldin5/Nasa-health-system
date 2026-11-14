# Kickoff prompt

Paste everything below the line into a fresh Claude Code session opened in this folder.

---

You are helping Kernel Panic Squad (Bishkek, Kyrgyzstan) build a prototype for the NASA Space Apps challenge "Create Health Monitoring Software for Astronauts on Space Missions". Other teams have the same challenge, so we win on a clear point of view and a working demo, not on feature count.

## Step 0: load context (do this first, do not skip)

1. Read `CLAUDE.md`, `docs/IDEAS.md`, `docs/TEAM.md` and `docs/research/astronaut-health-problems.md`. Ask me which role I am (A frontend, B backend, C data engineer) and work on my part and my branch (`docs/GIT-WORKFLOW.md`).
2. Read `docs/CHALLENGE.md`. If it is empty, stop and ask me to paste the official objectives, resource list and judging criteria from spaceappschallenge.org. Do not write them from memory.
3. Note that sections 1-6 of our research notes are missing. Ask me for them if you need them.

## Product

"Own Your Baseline": an offline-first health companion. It learns a personal baseline from passive data and a 30-second check-in, flags drift, correlates symptoms with CO2 and cabin data, and gives plain next steps. Open record: the flight surgeon sees the astronaut's full record, and the astronaut sees everything the flight surgeon sees, including notes. Nothing hidden either way. Our difference from the 40+ other teams (read `docs/research/competitors.md`) is a consult layer on that shared picture: ground consults instead of directing, the astronaut asks through a consult brief and sees every reply. Personal baseline and offline use are not new, so do not lead with them. Requirements are in `docs/REQUIREMENTS.md`; daily use in `docs/USER-FLOW.md`; start with `docs/README.md`. A crew readiness screen shows status per person, not raw medical data. It is decision support, never diagnosis.

## How to work

1. Use `superpowers:brainstorming` to confirm scope with me. Offer a recommendation, not a menu. The stack is set in `CLAUDE.md` and `docs/TEAM.md` (React web app, FastAPI recommended, SQLite, VictoriaMetrics). Record the final stack and scope in `docs/DECISIONS.md`.
2. Spawn the `architect` agent (model opus) to design the data model, module boundaries and schemas. Skills it must read: `ecc:hexagonal-architecture`, `ecc:api-design`, `ecc:contract-first`.
3. Call the `advisor` agent (model fable) to review the plan before any code is written. Apply its top issues or tell me why not.
4. Build in vertical slices, each runnable and demoable:
   1. Simulated 14-day mission data (agent `data-sim`, model haiku).
   2. Baseline and drift logic with tests first (agent `backend`, model sonnet; skills `ecc:backend-patterns`, `ecc:healthcare-cdss-patterns`, `superpowers:test-driven-development`).
   3. The 30-second check-in and the baseline and trend views (agent `frontend`, model sonnet; skills `impeccable:impeccable`, `taste-skill:taste-skill`, `ecc:frontend-patterns`, `ecc:react-patterns`, `ecc:frontend-a11y`, `dataviz`).
   4. The consult layer, which is our difference (see `docs/REQUIREMENTS.md` D3 to D7): the consult brief, the flight surgeon screen (Ground role), the astronaut's "What ground sees" view with surgeon notes, and the sync log. Then, if time allows, the crew readiness screen. `design/own-your-baseline/Ground.dc.html` predates the open record: keep its look, drop the share switches.
   5. CO2 and symptom correlation view (Cabin Link) and the OSD-569 blood-count card (requirement M8).
   6. Offline check (whole docker compose stack with no internet) and the demo script (skill `demo-readiness`).
5. After each slice: run the tests, open the app in a browser and check the demo path, then use `superpowers:verification-before-completion`. Report what works and what does not.
6. Call the `advisor` again before calling any milestone done, and once more on the final build.

## Hard constraints

- Decision support, not diagnosis, in all copy.
- Open record: ground sees the full record, the astronaut sees everything ground sees. Sync only at the simulated ground link, listed in the sync log.
- Works with the network off.
- Simulated data is labeled. Real NASA data (OSDR, RadLab) is cited with dataset ID and URL.
- Any medical threshold has a source, or is labeled "Demo parameter".
- Do not scaffold or commit anything until the plan is approved. Commit only when I ask.

## What I want back

Start with a one-screen plan: scope, stack recommendation, the demo story in five beats, the cut list, and the three biggest risks. Then wait for my go.
