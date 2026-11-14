---
name: demo-readiness
description: Checklist for getting the astronaut health app ready for the NASA Space Apps judging demo and submission. Use when planning the final days, recording the demo, or deciding what to cut.
---

# Demo readiness

## The 3 minute story

Our difference is the consult layer (see `docs/README.md` and `docs/research/competitors.md`). Do not lead with "private, offline, personal baseline": other teams already have that.

1. Problem (20 s): astronauts hide symptoms for fear of being grounded, and the hardest conflict is with Mission Control.
2. Product (20 s): a health companion that learns your own baseline, and lets you consult ground on your terms.
3. Live walkthrough (100 s): a 30-second check-in; a drift alert with a next step; the OSD-569 blood-count card with its Earth reference; flip share switches while "what ground sees" changes; write a question and send the consult brief; the CO2 and headache correlation if time allows.
4. Offline proof (15 s): turn the network off and show it still works.
5. Close (25 s): decision support not diagnosis, NASA data used (name OSD-569), what comes next.

## Checklist

- [ ] `docs/CHALLENGE.md` has the official objectives, and each is mapped to a feature.
- [ ] Named NASA data (OSDR or RadLab) is used and cited in the app or the README.
- [ ] Simulated data is labeled.
- [ ] Demo runs from a clean checkout with one command and no network.
- [ ] A recorded backup video exists in case the live demo fails.
- [ ] README: what it does, how to run, data sources, limitations, team.
- [ ] The advisor agent reviewed the final build.
- [ ] A cut list exists: features dropped to protect the demo path.

## Cut order when time runs out

Radiation coach, then triage trees, then crew screen polish. Never cut the check-in, baseline and drift alert, the share panel and consult brief, the OSD-569 card, or offline mode.
