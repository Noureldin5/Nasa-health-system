# Requirements

What the app must do, written so a developer or a Claude session can build and check it. Source of the official objective: `docs/CHALLENGE.md`. Product reasoning: `docs/IDEAS.md` and `docs/research/competitors.md`.

Priority: **Must** = needed for a credible submission. **Should** = build if time allows. **Could** = roadmap or stretch.

## Must (official objective, build first)

| # | Requirement | Done when | Owner |
|---|---|---|---|
| M1 | Visual self-assessment tool with a clickable body map | Tapping a body region shows its status and an explainer: what it does, which measurement, how the five NASA HRP hazards affect it, when to contact the flight surgeon | A |
| M2 | Indicators: blood pressure, heart rate, blood sugar, body temperature, sleep hours, mood | Each has a card with value, unit, status, 7-day trend and the astronaut's own baseline range | A, B |
| M2b | Blood-count card from OSD-569 (white cells, lymphocytes) so the real NASA data is visible | Card shows the values with the OSD-569 min and max as an "Earth reference range" next to the personal baseline. Labeled "Inspiration4 crew sample, not your labs". Also reachable from an immune or blood region on the body map | C, A |
| M3 | Color-coded status that is readable at a glance | Status uses color plus an icon shape plus a word. Never color alone | A |
| M4 | Dynamic charts over time | Trend charts update when new data is entered | A |
| M5 | Guidance on treatments and health improvements | Every alert gives what changed, one next step, and "Contact the flight surgeon if..." | B |
| M6 | Simple instructions for people who are not experts | Each measurement has a short how-to and why it matters | A, C |
| M7 | Works with any input | Tap check-in and manual entry work. Camera or image is optional | A |
| M8 | Uses NASA data | OSD-569 (blood count) is ingested and shown as an "Earth reference range" beside the personal baseline. Dataset ID and URL cited in the app | C |
| M9 | Works offline | The demo runs with the network switched off | C |

## Must (our difference: the consult layer)

| # | Requirement | Done when | Owner |
|---|---|---|---|
| D1 | Personal baseline drives alerts | An alert compares the reading with the astronaut's own history. Population or Earth ranges are shown as reference, not as the alarm | B |
| D2 | 30-second check-in | Hero flow, 4 steps or fewer, large buttons, passive data is never retyped | A |
| D3 | Open record | The astronaut view and the flight surgeon view are built from the same record. Ground sees every item. No setting hides data from ground | A, B |
| D4 | Astronaut sees what ground sees | "What ground sees" in the astronaut's app matches the flight surgeon screen exactly, including the surgeon's notes, flags and assessments. Nothing exists on the ground side that the astronaut cannot see | A, B |
| D5 | Consult brief and reply (the main claim) | The astronaut writes or accepts a question, the app pins the items related to the current alert, and the brief is sent at the next ground link. The flight surgeon screen shows the brief on top of the full record. The reply comes back as a card linked to the brief. Advice to a colleague, not an order | A, B |
| D6 | Sync log | A visible list of every sync to ground: when, and what was sent | B |
| D7 | Flight surgeon screen | A "Ground" role switch in the same app shows the surgeon's view: the astronaut's full dashboard, the inbox of briefs, a reply box and notes. Notes appear on the astronaut side. Simulated link, local backend only | A, B |

## Must (user flow)

From `docs/USER-FLOW.md`.

| # | Requirement | Done when | Owner |
|---|---|---|---|
| U1 | Today's readout after the check-in | One screen: overall status (icon, word, color), the strongest change in plain words, one tip | A, B |
| U2 | "Same as yesterday" check-in | One tap on the first check-in screen completes it. Any step can be skipped | A |
| U3 | Calibration period | For the first 7 days (demo parameter) cards read "Learning your baseline: day N of 7" and no drift alerts fire. Only cited safety thresholds can alert | B |
| U4 | At most one alert per day | The most important one is shown. Others wait in the "Worth checking" card | B |
| U5 | Drafted consult brief | "Ask the flight surgeon" opens a brief with the alert's items pinned and a suggested question the astronaut can edit (part of D5) | A, B |
| U6 | Surgeon crew list, inbox and last-sync time | Crew list with status per person, inbox with briefs first, and "Last sync" on every ground screen (part of D7) | A, B |
| U7 | Points never depend on health values | Streaks and points count completed check-ins only. Reporting a symptom never lowers a score (applies if S4 is built) | A |

## Should (user flow)

| # | Requirement | Owner |
|---|---|---|
| U8 | Symptom logging by tapping a body region and a strength | A |
| U9 | Automatic alert follow-up and close, from passive data and check-ins | B |
| U10 | Ground reply card linked to its brief | A, B |
| U11 | Surgeon notes per item, watch flag and measurement request, all visible to the astronaut | A, B |
| U12 | Weekly measurement slot (BP, glucose, temperature) and weekly summary | A, B |

## Should

| # | Requirement | Owner |
|---|---|---|
| S1 | Cabin Link: CO2 and symptom correlation view with a cited limit | B, C, A |
| S2 | Environment Switcher: station, spacecraft, rover, surface base change hazards and checks | A, C |
| S3 | Crew Readiness view for the commander: readiness status per person, not raw medical data. The astronaut sees what the commander sees about them | B, A |
| S4 | Mission Quest: gentle daily goals, streak and score. Reminders, never requirements | A |

## Could (roadmap, mention in the pitch)

Radiation Budget Coach, Camera Check (photo compare on the device), Earth-Independent Triage.

## Data requirements

- OSD-569 CBC CSV and ISA metadata become clean JSON in `data/processed/` with value, min and max per indicator.
- Blood pressure, heart rate and glucose have no open NASA data. Use simulated data, labeled everywhere it is shown.
- Simulated mission: 14 days, fixed seed, with a baseline, a CO2 rise that precedes headaches, a sleep-debt drift and a recovery.
- Every threshold has a citation or the label "Demo parameter".

## Quality requirements

- Accessibility: contrast 4.5:1 or better, 44px touch targets, keyboard use, `prefers-reduced-motion`.
- Offline: self-host fonts and scripts. No runtime CDN. Docker images pinned and pre-pulled. The whole stack (web, API, VictoriaMetrics) starts with no internet.
- Tests: baseline and drift logic, the open-record rule (astronaut and ground views come from the same record, and every surgeon note is visible to the astronaut), and pinning of alert items in the consult brief.
- No real patient data. Decision support language on every health message.

## Not building

Diagnosis or treatment prescriptions, real patient data, face or voice analysis, a cloud backend, user accounts, native mobile apps.

## Demo (3 minutes)

Problem (ground directs, astronauts do not see their own medical picture) -> a 30-second check-in -> a drift alert with a next step -> send a consult brief -> switch to the Ground role: the surgeon sees the full record and the question, writes a note and a reply -> back to the astronaut: the note and reply are there, same picture on both ends -> turn the network off and show it still works -> close with decision support, NASA data used, roadmap. Story version: `docs/USER-FLOW.md`. Details: `.claude/skills/demo-readiness/SKILL.md`.
