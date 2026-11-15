# Own Your Baseline

NASA Space Apps Challenge 2026, team Kernel Panic Squad. Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**.

An offline-first health companion for astronauts. It learns each astronaut's personal baseline from passive data and a 30-second check-in, flags drift in plain language with one next step, and keeps the astronaut and the flight surgeon looking at the same record. Decision support, not a diagnosis.

Pitch deck (7 slides): [`docs/pitch/own-your-baseline.pptx`](docs/pitch/own-your-baseline.pptx)

## What it does

- Clickable body map on NASA's EMU astronaut model, with an explainer per region. A 3D view, and a 2D view (a render of the same model) that needs no WebGL. Each region is tinted on the suit in its status color.
- Six indicators: blood pressure, heart rate, blood sugar, body temperature, sleep, mood. Trend charts and status shown by color, shape and word.
- Alerts follow the astronaut's own baseline, in three parts: what changed, one next step, and when to contact the flight surgeon. Earth reference ranges (NASA OSD-569 blood count) are shown beside it and never trigger an alert.
- Open record: the flight surgeon sees the full record, and the astronaut sees everything ground sees, including notes. Every sync to ground is listed in a log.
- Consult brief: the astronaut asks a question with the related items pinned, and ground replies as advice, not an order.
- **Ground link at station, Moon or Mars distance.** Sync shows the record travelling to ground and the reply coming back, with a clock in real signal time. The Mars figure is NASA's: "a communication delay of up to 20 minutes one way" ([NASA HRP](https://www.nasa.gov/hrp/hazard-distance-from-earth/)). The Moon and station delays are derived from NASA distances and labeled so.
- **Mission replay.** Scrub the mission day by day: the body map, cabin CO2, headaches, sleep, heart rate and mood move under one playhead, with the record's events (alert, brief, reply, note) on the track. The flight surgeon gets the same replay from ground's copy of the record.
- **Ask my record.** Ask about your own data in plain words. Each answer cites days and values from the record and lights them up on the charts. "Why this alert?" on the alert and the consult-brief drafter use the same assistant. See [Record assistant](#record-assistant).
- Cabin Link (CO2 against headaches), crew readiness, an environment switcher (station, spacecraft, rover, surface base) and a check-in streak.

## Run it (no internet needed after the first build)

```bash
docker compose up -d --build --wait
```

- App: http://localhost:8090
- API docs: http://localhost:8000/docs
- Demo reset to mission day 10: `curl -X POST "localhost:8000/demo/reset?day=10"`
- Next mission day: `curl -X POST localhost:8000/demo/advance`

The first build needs the internet (npm and the base images). After that the stack runs with the network off. Tests: `make check` (API and pipeline).

### Quick look without Docker

```bash
cd web && npm install && npm run dev
```

http://localhost:5173 runs the whole app in the browser on simulated data (mission day 14), with no backend. Details in [`web/README.md`](web/README.md).

## Record assistant

Optional. It puts facts the app already computed into plain words. It never changes a status and never writes to the record.

- **Without a key** (the default) the answers are built on board by fixed rules from the same facts, so everything works offline.
- **With a key** a hosted model rephrases the same facts. Copy `.env.example` to `.env` in the repo root, set `AI_PROVIDER` (`gemini` by default, `deepseek`, or any OpenAI-compatible server) and `AI_API_KEY`, and restart the API. The key stays on the API server; the browser never receives it.
- Strong symptoms, questions about medicines, requests for an assessment and any open "Act now" alert get a fixed "contact the flight surgeon" text and never reach the model. Model text that reads like a dose, a diagnosis or a cause is dropped.
- Open record applies here too: every answer shows exactly what was sent, or that nothing left the station, and every send is listed. No crew names are sent. The assistant is on the astronaut side only, and it is not used at Mars distance, where there is no live link.

## NASA data and resources

- OSDR OSD-569, Inspiration4 complete blood count: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 (DOI 10.26030/e0rx-sh52, `data/processed/osd569.json`). Data are courtesy of the NASA Open Science Data Repository (OSDR).
- NASA HRP hazards https://www.nasa.gov/hrp/hazards/ and risks https://www.nasa.gov/hrp/risks/. Each indicator and body region links to its risk page.
- NASA HRP, Hazard: Distance From Earth: https://www.nasa.gov/hrp/hazard-distance-from-earth/ (the Mars signal delay)
- NASA OCHMO technical brief OCHMO-TB-004, Carbon Dioxide: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf (`pipeline/references.py`)
- NASA NTRS on CO2: Law J, Alexander D, "CO2 on the International Space Station: An Operations Update" (2016, https://ntrs.nasa.gov/citations/20150019624); Scully RR et al., "Effects of Acute Exposures to Carbon Dioxide Upon Cognitive Functions" (2016, https://ntrs.nasa.gov/citations/20150021777)
- NASA 3D Resources astronaut model (`web/public/models/README.md`)
- NASA Moon facts, average distance for the derived Moon delay: https://science.nasa.gov/moon/facts/
- CSA articles on radiation monitoring and science in space

## Simulated data

Blood pressure, heart rate, glucose, temperature, sleep, mood and cabin CO2 are **simulated** and labeled so in the app. NASA has no open data for most of them. OSD-569 has no in-flight samples, so it is used as a reference range, not as a mission time series. Numbers without a cited source are marked "Demo parameter". No real patient data.

## Stack

React, TypeScript, Vite, three.js and d3 (`web/`); FastAPI and SQLite (`api/`); VictoriaMetrics, simulator and OSD-569 ETL (`pipeline/`); Docker Compose (`deploy/`). Design tokens from the NASA Horizon Design System, NASA Open MCT and Astro UXDS (`web/src/styles/tokens.css`). More in `docs/`.

## Use of AI

- Claude Code (Anthropic) was used to write and review parts of the code and documentation, under the team's direction. The idea, design and rules were chosen by the team.
- Google Gemini (`gemini-3.5-flash-lite`, through the Gemini API) powers the optional record assistant in the app, as described above. Without a key the app uses no language model.
- No AI-generated images or video. Screenshots show the app, and the 2D body-map figure is a render of NASA's 3D model.

## Team

Maksat (frontend), Noureldin (backend), Temirlan (data and pipeline).
