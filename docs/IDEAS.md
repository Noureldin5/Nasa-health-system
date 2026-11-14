# The idea

Team: Kernel Panic Squad (Bishkek, Kyrgyzstan). Challenge: "Create Health Monitoring Software for Astronauts on Space Missions" (NASA Space Apps 2026, official text in `docs/CHALLENGE.md`).

This is the current idea, as decided on 2026-11-14. How people use it day to day: `docs/USER-FLOW.md`. What must be built: `docs/REQUIREMENTS.md`. Earlier versions and the reasoning behind changes: `docs/research/ideas-history.md`.

## In one sentence

**Own Your Baseline** is an offline health app for astronauts that learns each person's own normal, tells them in plain words when something drifts and what to do, and gives the astronaut and the flight surgeon on Earth the same picture, so ground consults instead of directing.

## The problem we solve

From the team's research (`docs/research/astronaut-health-problems.md`):

1. Astronauts must assess their own health far from Earth, often without a live link (the official objective).
2. Workdays are long (about 16 hours) and procedures tedious. Tools that need a lot of input go unused.
3. The hardest interpersonal conflict on missions is between the crew and Mission Control. Research recommends moving ground from directing the crew to consulting it.
4. Astronauts do not see their own medical picture the way ground does.

## The product, in five parts

| Part | What it does | Why |
|---|---|---|
| 1. Personal baseline | Learns the astronaut's own normal over the first 7 days (demo parameter) and compares new readings with it. Earth ranges (NASA OSD-569) are shown only as reference | Space changes the body, so Earth ranges would raise false alarms |
| 2. Low-effort input | Passive data from a wearable and cabin sensors. A 30-second morning check-in, one tap on a normal day | Astronauts have no time |
| 3. Self-assessment and guidance | Clickable body map, six indicators (blood pressure, heart rate, blood sugar, temperature, sleep, mood), trend charts, color plus icon plus word status, explainers. Each alert says what changed, one next step, and when to contact the flight surgeon | Required by the official objective |
| 4. Open record | The flight surgeon sees the astronaut's full record. The astronaut sees everything the flight surgeon sees, including notes, flags and assessments. Nothing is hidden either way | Same picture on both ends, no secret judgements |
| 5. Consult layer | The astronaut asks ground a question through a consult brief, with related data pinned. The surgeon replies with advice, not orders. Replies and notes show up in the astronaut's app | Ground consults, it does not direct |

Inside the product, as one screen: **Cabin Link**, which shows when symptoms such as headaches follow rises in cabin CO2, and suggests what to try.

Always: decision support, never diagnosis. Works with the network off. Simulated data is labeled.

## Who uses it

| Role | Uses it to | Sees |
|---|---|---|
| Astronaut (main user) | Check in, understand their status, act on tips, ask ground | Everything about themselves, plus everything ground writes about them |
| Flight surgeon (ground) | Review the record, answer briefs, add notes, request a measurement | The astronaut's full record, as of the last ground link |
| Commander (optional) | Plan workload | Readiness status per person, not raw medical data. The astronaut sees what the commander sees about them |

Step-by-step flows for each role: `docs/USER-FLOW.md`.

## What makes us different

More than 40 teams work on this challenge (`docs/research/competitors.md`). Personal baselines, offline apps, body maps, cited alerts and radiation data are common, so we do not lead with them.

Our pitch: **"Same picture on both ends. Ground consults, it does not direct."** The astronaut sees everything ground sees and writes about them, and asks questions instead of receiving orders.

Not yet verified: whether any other team shows the flight surgeon's notes to the astronaut. Check the competitor repos before calling it new.

## Risks and our answers

| Risk | Answer |
|---|---|
| An astronaut who knows ground sees everything may underreport symptoms in check-ins | Every note and flag from ground is visible, so there are no secret judgements. Replies are advice. Reporting a symptom never lowers a score. Passive sensor data is not affected. Expect this question from judges |
| Too much to build in a hackathon | Cut order in `docs/TEAM.md`. Never cut the body map, indicators, check-in, consult brief, flight surgeon screen, offline mode and OSD-569 data |
| Another team adds a similar consult feature | Tell the story through the research (crew versus ground conflict) and keep the demo beat fast and visual |
| Thresholds without sources | Every threshold has a citation or the label "Demo parameter" (CLAUDE.md, rule 7) |

## Other concepts and their status

| Concept | Status |
|---|---|
| Cabin Link (CO2 and symptoms) | Built inside the product (Should) |
| Crew Readiness (commander view) | Optional screen (Should) |
| Environment Switcher (station, spacecraft, rover, surface base) | Optional (Should) |
| Mission Quest (streaks and points for check-ins, never for health values) | Optional (Should) |
| Radiation Budget Coach | Roadmap, mention in the pitch |
| Camera Check (photo compare on the device) | Roadmap |
| Earth-Independent Triage (offline decision trees) | Roadmap |

Designs for all of them: `docs/DESIGN.md`.
