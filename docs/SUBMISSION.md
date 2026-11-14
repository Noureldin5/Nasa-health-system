# Submission pack (NASA Space Apps 2026)

Rules come from the Project Submission Guide dated 2026-11-13 (`docs/CHALLENGE.md` has the challenge text). Deadline: **Sunday 2026-11-15, 11:59 p.m. local time of the team's Local Event** (Universal Event: the Team Owner's local time). Press **Submit for Judging**, not only Save Progress. Only the last submission is judged.

## Do we have to deploy?

No. "Link to Final Project" accepts a website, a cloud folder or a code repository. Our public GitHub repo is enough: https://github.com/Noureldin5/Nasa-health-system (public, checked 2026-11-14). The demo video or slides must be hosted outside the NASA site (YouTube, Google Drive) with a link that needs no login. Test every link in a private window.

## Fields to fill

**Project name:** Own Your Baseline

**High-level summary (about 120 words):**
Own Your Baseline is an offline-first health companion for astronauts. It learns each astronaut's personal baseline from passive data and a 30-second check-in, then flags drift from that baseline in plain language with one next step. It covers blood pressure, heart rate, blood sugar, body temperature, sleep and mood, with a clickable body map, trend charts and status shown by color, shape and word. Our difference is an open record: the flight surgeon sees the astronaut's full record, and the astronaut sees everything ground sees, including notes. The astronaut asks questions through a consult brief, and ground consults instead of directing. It uses NASA OSD-569 blood-count data as an Earth reference range and the NASA HRP hazards and risks. Decision support, not diagnosis. Demo vitals are simulated and labeled.

**Demo link:** the video (30 seconds or less) or the 7-slide deck, public link.

**Final project link:** the GitHub repo above (add a root README, see `README.md`).

**Detailed description (points to cover):**
- What it does: self-assessment with a clickable 3D body map, six indicators, trends, drift alerts, explainers, consult brief, flight surgeon screen, crew readiness, cabin CO2 against headaches, environment switcher, check-in streak.
- How it works: the personal baseline drives alerts (a 7-day calibration first, then drift from the astronaut's own band). Earth ranges are shown as reference only. One record feeds both the astronaut and ground views. The ground link is simulated, and every sync is listed in a log the astronaut can read.
- Tech: React, TypeScript, Vite; FastAPI, SQLite; VictoriaMetrics for time series; Docker Compose; runs with no internet.
- Benefit: an astronaut far from Earth can judge their own health and ask a precise question, and nothing is hidden from either side.

**Use of AI (write every tool):** Claude Code (Anthropic) was used to write and review parts of the code and documentation under the team's direction. The team chose the idea, the design and the rules. Declare it in the repo README too. If any image or video is AI-generated it needs a visible watermark, and no generated content may use NASA logos or mission marks.

**NASA data and resources:**
- OSDR OSD-569, Inspiration4 complete blood count: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 (used as the Earth reference range).
- NASA HRP five hazards: https://www.nasa.gov/hrp/hazards/ (quotes in `data/processed/hazards.json`).
- NASA HRP risks: https://www.nasa.gov/hrp/risks/ (cited on each indicator).
- NASA 3D Resources astronaut model in the EMU suit (body map), see `web/public/models/README.md`.
- NASA OCHMO technical brief on CO2 (cabin CO2 limit), see `pipeline/references.py`.

**Other references:** CSA "Monitoring Radiation for Astronaut Health" and "Why Do We Conduct Science Experiments in Space?". Open-source libraries: React, three.js, FastAPI, VictoriaMetrics, d3.

Rules to respect: no image, video or voice of anyone under 18; everything in English (a video in another language needs English subtitles); both boxes ticked (Terms, Confirm All Work is Original).

## 7 slides (the official template, `Pitch Deck Template (7 slides + official).pdf`)

Keep each slide to a few words and one image.

1. **Title and summary.** Own Your Baseline. Team Kernel Panic Squad. Challenge: Create Health Monitoring Software for Astronauts on Space Missions. One sentence: an offline health companion that learns your own baseline and keeps ground and astronaut looking at the same record.
2. **Problem.** Far from Earth, astronauts must spot changes in themselves, and the call to ground is slow or cut. Add one or two numbers with a source from `docs/research/astronaut-health-problems.md` (the file has none yet, so find and cite them or leave numbers out). Today's tools either hide data from ground or hand the astronaut nothing.
3. **Solution.** Personal baseline, 30-second check-in, drift alert with one next step. New: the open record. Ground sees everything, the astronaut sees everything ground sees, and questions go through a consult brief. 40+ other apps exist (`docs/research/competitors.md`), and none we found are built on that open consult layer.
4. **How it works.** Image: the architecture (web, API, VictoriaMetrics, simulated link). NASA data: OSD-569 as Earth reference range, HRP hazards and risks. Method: alerts from the personal baseline, not Earth ranges. AI: Claude Code. Stack: React, FastAPI, SQLite, VictoriaMetrics, Docker.
5. **Demo.** Screenshots: body map, today's readout, alert with cabin CO2, consult brief, surgeon screen. Link to the video and the repo.
6. **Impact and next steps.** Who benefits: crews on long missions, flight surgeons, and remote clinics on Earth with the same delay problem. Next: real wearables, delayed-link modes for Mars distances, clinician review of thresholds.
7. **Team and references.** Names and roles (frontend, backend, data), every dataset and tool above, and how AI and NASA data were used.

## 30-second video script (about 75 words, read it aloud once with a stopwatch)

Follows NASA's own timing: introduce, lead in, name, idea, future.

| Time | Say | Show |
|---|---|---|
| 0:00 | "We're Kernel Panic Squad." | team name over the app |
| 0:02 | "Far from Earth, astronauts must spot their own health changes." | 3D body map |
| 0:05 | "Own Your Baseline: it learns your normal, and flags what drifts. Offline." | title, then today's readout |
| 0:10 | "Thirty-second check-in. Headache plus rising cabin CO2 raises one alert, with a next step. Ask ground through a consult brief." | check-in, alert, brief |
| 0:20 | "The surgeon sees the same record. You see everything they see." | surgeon screen, "What ground sees" |
| 0:25 | "Built on NASA blood data and hazard research. Own your baseline." | OSD-569 card, logo-free end card |

Record the screen with the demo reset to day 10 (`POST /demo/reset`), burn in English subtitles, and keep the final cut at 30 seconds or less. Export, upload to YouTube as unlisted or to Drive with "anyone with the link", and test it logged out.

## Last-hour checklist

1. Repo public, root README present, no secrets (checked: public).
2. Demo link opens in a private window.
3. Summary, details, AI use and NASA data filled in.
4. Both boxes ticked, then **Submit for Judging**, and look for the confirmation banner.
5. Each member's profile "Full name" is right (the certificate uses it).
