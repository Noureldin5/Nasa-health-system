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
| D3 | Private by default, share per item | Every item is private until switched on. Switches are visible | A, B |
| D4 | "What I see / what ground sees" view | Flipping a share switch immediately updates a side-by-side view of exactly what ground would receive. Hidden items read "Not shared", never zero. This is how the demo shows D5 | A, B |
| D5 | Consult brief (the main claim) | The astronaut picks included items, writes or edits the question, sees the final brief, and sends it at the next ground link. It is a question to a consultant, not a report to a supervisor. Built around the underreporting problem. AURORA already has consent and a ground batch, so the claim is the framing and the astronaut-written question | A, B |
| D6 | Record of what was shared | A visible list of what was sent, when, and which items | B |

## Should

| # | Requirement | Owner |
|---|---|---|
| S1 | Cabin Link: CO2 and symptom correlation view with a cited limit | B, C, A |
| S2 | Environment Switcher: station, spacecraft, rover, surface base change hazards and checks | A, C |
| S3 | Crew Readiness view built only from shared items | B, A |
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
- Offline: self-host fonts and scripts. No runtime CDN.
- Tests: baseline and drift logic, consent filtering (nothing unshared is ever in a brief), and the "Not shared, never zero" rule.
- No real patient data. Decision support language on every health message.

## Not building

Diagnosis or treatment prescriptions, real patient data, face or voice analysis, a cloud backend, user accounts, native mobile apps.

## Demo (3 minutes)

Problem (astronauts hide symptoms) -> a 30-second check-in -> a drift alert with a next step -> flip share switches and watch "what ground sees" change -> send a consult brief -> turn the network off and show it still works -> close with decision support, NASA data used, roadmap. Details: `.claude/skills/demo-readiness/SKILL.md`.
