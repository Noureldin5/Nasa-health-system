# Ideas: Health Monitoring Software for Astronauts

Team: Kernel Panic Squad (Bishkek, Kyrgyzstan)
Challenge: "Create Health Monitoring Software for Astronauts on Space Missions" (NASA Space Apps 2026)

> **Read the "Update after competitor research" section first.** Sections marked SUPERSEDED below are kept for history only. Current plan: `docs/README.md` and `docs/REQUIREMENTS.md`.

## What the challenge asks (SUPERSEDED: the official text is now in `docs/CHALLENGE.md`)

This early summary came from a web search and other teams' repos, written before the official text was available. Use `docs/CHALLENGE.md` instead. The judging criteria and Resources tab links are still missing there.

- Long missions expose astronauts to radiation, isolation, altered gravity and a closed environment. These cause immune changes, bone loss, cardiovascular problems and behavioral health issues.
- Astronauts must spot changes in themselves. Build software that gathers health indicators and lets the astronaut evaluate and act.
- Difficulty: Intermediate. Subjects: Human Exploration, Software, Space Exploration.
- Data other teams report using: NASA OSDR (Inspiration4 studies OSD-575, OSD-656; OSD-569 blood counts and lab ranges), NASA RadLab (ISS radiation: DOSTEL, CRaTER, MSL-RAD), NASA Human Research Program guidance.

## Update after reading the official text (`docs/CHALLENGE.md`)

The official objective asks for a visual tool with guidance on treatments and health improvements. Judges will expect these, so concept 1 must include them, not only the privacy angle:

- Clickable human body map showing per-body-part function and status (the challenge's own example).
- The listed indicators: blood pressure, heart rate, blood sugar, body temperature, sleep hours, mood.
- Explainer cards: which measurement, why, how the five HRP hazards affect it, when to call the flight surgeon.
- Trend charts, status color coding, and optional gamification and environment selector.

Privacy, offline and the baseline stay as the differentiator on top of this required core. The research notes' claim that the section above is still partial remains true.

## Update after competitor research (read this first)

Details: `docs/research/competitors.md`. More than 40 public repos target this same challenge. The strongest, AURORA, already has an offline app, personal baselines, cited alerts, radiation data and per-audience consent. Personal baseline, offline use and per-item consent are therefore not new.

Recommended angle, one story: **astronauts hide symptoms for fear of being grounded, and conflict with Mission Control is the hardest problem. Build the tool that makes honest reporting safe.**

- Own Your Baseline stays the product and the required core (body map, indicators, trends, guidance).
- The difference is a **consult layer**: an astronaut-led **consult brief** (the astronaut picks the data, writes the question, sees it, sends it at the next ground link) built around the underreporting problem. Ground consults; it does not direct. A "what I see / what ground sees" view that updates as share switches flip is how the demo shows it.
- What AURORA already has (read in its source, `apps/web/src`): a consent matrix by audience and data category, a ground batch of consented records sent with a simulated Mars delay, and an audit trail. We did not find a view of the batch contents before sending, or an astronaut-written question. So the mechanism is not our claim. The claim is the problem framing and the consult brief.
- Cabin Link stays as the signature insight screen. Crew Readiness is optional.
- Demo beat: flip a switch, watch ground's view change, send the brief, turn the network off.

Risks: another team may add a similar consult feature, and the claim that nobody covers it comes from a sample of about a dozen repos. Mitigation: tell the story through the research (National Academies, "Safe Passage", ch. 8) and make the demo beat fast and visual.

Requirements: `docs/REQUIREMENTS.md`.

## Why differentiate

Many teams will build a vitals dashboard with charts and an alert. Judges will see dozens. The team's own research (`docs/research/astronaut-health-problems.md`) gives a better angle: the real problems are hidden symptoms, no Earth link, no time, and loss of autonomy. A tool that ignores those will not be used on a real mission.

Frame every concept as decision support, not diagnosis.

## Ranked concepts

### 1. Recommended: "Own Your Baseline" (offline astronaut health companion, plus the consult layer above)

An onboard app the astronaut owns. It learns a personal baseline from passive data plus a 30-second daily check-in. It flags drift from that baseline and suggests next steps from an onboard knowledge base. Nothing leaves the device unless the astronaut chooses to share.

- Maps to: astronaut self-evaluation and action (the objective), fear of grounding, no real-time Earth support, no time.
- Core features: personal baseline and trend view; 30-second check-in (sleep, headache, mood, vision); drift alerts with plain-language next steps; share-with-ground switch per item; offline operation.
- Data: OSDR blood-count ranges for reference values; simulated wearable and cabin data for the demo.
- Why judges remember it: it solves the human reason monitoring fails (people hide symptoms), not just the chart.

### 2. "Cabin Link": symptoms correlated with the environment

Combines symptom check-ins with CO2 and cabin environment data. Shows when headaches or low focus follow CO2 rises, and suggests fixes (ventilation checks, task timing).

- Maps to: environment effects on cognition (NASA CO2 research), SANS and headaches.
- Why judges remember it: concrete, science-backed, and it turns data into a cause the crew can act on.
- Risk: needs a believable simulated cabin dataset. Good as a feature inside concept 1.

### 3. "Crew Readiness": crew-level view

Shows aggregate crew readiness (sleep debt, workload, stress) without exposing individual raw data. Helps the commander plan work.

- Maps to: whole crew sleep-deprived or medicated, interpersonal friction.
- Risk: touches privacy. Only shared items appear, otherwise it feels like surveillance. Good as a second screen.

### 4. "Radiation Budget Coach"

Tracks cumulative radiation dose from RadLab-style data against limits and shows remaining budget per crew member.

- Maps to: radiation exposure, a stated mission risk. Uses real NASA data directly.
- Risk: narrower, and a dose number alone does not tell the astronaut what to do.

### 5. "Earth-Independent Triage"

A guided symptom triage with offline decision trees for common problems (headache, nausea, sleep loss). Output: self-care steps, when to escalate.

- Maps to: no real-time Earth support.
- Risk: medical content must be sourced and labeled as decision support. Needs careful wording.

## Recommendation (SUPERSEDED by "Update after competitor research" above)

Build concept 1 as the product, with the consult layer. Fold in concept 2 (CO2 correlation) as the signature insight and concept 3 as a shareable crew screen. Mention 4 and 5 as roadmap. The old story, "private by default, working without Earth", is no longer the lead because other teams already have it.

## Ways to stand out from other teams (SUPERSEDED)

Use the demo beat in `docs/REQUIREMENTS.md` ("Demo (3 minutes)") instead: a check-in, a drift alert, flipping share switches while ground's view changes, sending a consult brief, then the network off.

## Open questions for the team

1. Which teammate owns frontend, backend, data and the demo story?
2. Do we have the missing sections 1-6 of the research notes?
3. What is the official judging criteria text? (fill `docs/CHALLENGE.md`)
