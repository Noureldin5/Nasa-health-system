---
name: demo-readiness
description: Checklist for getting the astronaut health app ready for the NASA Space Apps judging demo and submission. Use when planning the final days, recording the demo, or deciding what to cut.
---

# Demo readiness

## The 3 minute story

Our difference is the consult layer (see `docs/README.md` and `docs/research/competitors.md`). Do not lead with "private, offline, personal baseline": other teams already have that.

1. Problem (20 s): the hardest conflict on long missions is with Mission Control, and astronauts do not see their own medical picture.
2. Product (20 s): a health companion that learns your own baseline. Same picture on both ends: ground sees your record, you see everything ground sees and writes. Ground consults, it does not direct.
3. Live walkthrough (100 s): a 30-second check-in; a drift alert with a next step; the OSD-569 blood-count card with its Earth reference; write a question and send the consult brief; switch to the Ground role, the surgeon writes a note and a reply; back on the astronaut side, the note and reply are there; the CO2 and headache correlation if time allows.
4. Offline proof (15 s): turn the network off and show it still works.
5. Close (25 s): decision support not diagnosis, NASA data used (name OSD-569), what comes next.

## Checklist

- [ ] `docs/CHALLENGE.md` has the official objectives, and each is mapped to a feature.
- [ ] Named NASA data (OSDR or RadLab) is used and cited in the app or the README.
- [ ] Simulated data is labeled.
- [ ] Demo runs from a clean checkout with one command (`docker compose up`, images pre-pulled) and no network.
- [ ] A recorded backup video exists in case the live demo fails.
- [ ] README: what it does, how to run, data sources, limitations, team.
- [ ] The advisor agent reviewed the final build.
- [ ] A cut list exists: features dropped to protect the demo path.

## Cut order when time runs out

Same as `docs/TEAM.md`: Radiation Budget Coach, Camera Check, Mission Quest, Crew Readiness, Environment Switcher, live replay. Never cut the body map and indicators, the check-in, baseline and drift alert, the consult brief and flight surgeon screen, the OSD-569 card, or offline mode.
