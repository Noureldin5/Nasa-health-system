# Own Your Baseline

NASA Space Apps Challenge 2026, team Kernel Panic Squad. Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**.

An offline-first health companion for astronauts. It learns each astronaut's personal baseline from passive data and a 30-second check-in, flags drift in plain language with one next step, and keeps the astronaut and the flight surgeon looking at the same record. Decision support, not a diagnosis.

## What it does

- Clickable 3D body map (NASA's EMU astronaut model), with an explainer per region.
- Six indicators: blood pressure, heart rate, blood sugar, body temperature, sleep, mood. Trend charts and status shown by color, shape and word.
- Alerts follow the astronaut's own baseline. Earth reference ranges (NASA OSD-569 blood count) are shown beside it and never trigger an alert.
- Open record: the flight surgeon sees the full record, and the astronaut sees everything ground sees, including notes. Every sync to ground is listed in a log.
- Consult brief: the astronaut asks a question with the related items pinned, and ground replies.
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

## NASA data and resources

- OSDR OSD-569, Inspiration4 complete blood count: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 (`data/processed/osd569.json`)
- NASA HRP hazards https://www.nasa.gov/hrp/hazards/ and risks https://www.nasa.gov/hrp/risks/
- NASA 3D Resources astronaut model (`web/public/models/README.md`)
- NASA OCHMO CO2 technical brief (`pipeline/references.py`)
- CSA articles on radiation monitoring and science in space

## Simulated data

Blood pressure, heart rate, glucose, temperature, sleep, mood and cabin CO2 are **simulated** and labeled so in the app. NASA has no open data for most of them. OSD-569 has no in-flight samples, so it is used as a reference range, not as a mission time series. Numbers without a cited source are marked "Demo parameter". No real patient data.

## Stack

React, TypeScript, Vite (`web/`); FastAPI and SQLite (`api/`); VictoriaMetrics, simulator and OSD-569 ETL (`pipeline/`); Docker Compose (`deploy/`). More in `docs/`.

## Use of AI

Claude Code (Anthropic) was used to write and review parts of the code and documentation, under the team's direction. The idea, design and rules were chosen by the team.
