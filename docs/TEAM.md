# Team split

Team: Kernel Panic Squad, 3 people. One frontend (A), two backend and monitoring (B and C).

## Decision

Build **Own Your Baseline** (docs/IDEAS.md concept 1) with a **consult layer** (preview of what ground sees, plus an astronaut-led consult brief) and **Cabin Link** inside it. Why: `docs/research/competitors.md`. Requirements: `docs/REQUIREMENTS.md`. Add Environment Switcher (cheap) and Crew Readiness if time allows. Mission Quest is optional. Radiation Budget Coach and Camera Check are roadmap items to mention in the pitch.

Designs: `docs/DESIGN.md` (links, tokens, frontend notes) and `design/`.

## First hour, all three together

Agree the data shapes and write them in `docs/DECISIONS.md`: check-in record, sensor reading, cabin reading, share record. Also record the stack. This lets all three work in parallel.

## Person A: frontend

1. Design tokens and the status pill (icon, word and color, never color alone).
2. Indicator cards with sparklines, then the dashboard and the clickable body map with explainers.
3. 30-second check-in, then the share panel and the "what I see / what ground sees" preview, then the consult brief screen.
4. Environment Switcher and the Cabin Link chart, using fake JSON until B and C deliver.
5. Crew Readiness and Mission Quest only if time is left.

## Person B: backend and logic

1. Local storage layer (IndexedDB) and the share and export rules: only exported items leave the device. Also the consent filter that builds the "what ground sees" view and the consult brief, the record of what was sent, and tests that nothing unshared ever appears in a brief.
2. Baseline and drift detection as pure functions, tests first.
3. Alerts: a plain next step plus a "contact the flight surgeon if" rule for each.
4. Crew Readiness view built only from exported records.

## Person C: data and monitoring

1. Ingest OSD-569 CBC CSV and the ISA metadata (see `docs/research/nasa-datasets.md`). Output clean JSON with value, min and max per indicator.
2. Simulated 14-day mission: sleep, heart rate, blood pressure, glucose, CO2, headaches. Fixed seed. Label it simulated.
3. CO2 and symptom correlation for Cabin Link.
4. Cite a NASA source for every threshold, replacing the placeholders.
5. Offline service worker, then the demo script and the 3-minute pitch (`.claude/skills/demo-readiness/SKILL.md`).

## Handoffs

- C gives A and B JSON files first.
- B gives A a small set of functions, not a server.
- A never reads private data directly, only what B returns.

## If time runs short

Cut in this order: Radiation Budget Coach, Camera Check, Mission Quest, Crew Readiness. If A falls behind, C moves onto UI polish. Never cut: body map, indicators, check-in, share panel, offline mode, OSD-569 data.
