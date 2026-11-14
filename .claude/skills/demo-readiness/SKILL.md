---
name: demo-readiness
description: Checklist for getting the astronaut health app ready for the NASA Space Apps judging demo and submission. Use when planning the final days, recording the demo, or deciding what to cut.
---

# Demo readiness

## The 3 minute story

1. Problem (20 s): astronauts hide symptoms, have no Earth link, and no time for tools.
2. Product (20 s): private, offline copilot that learns your own baseline.
3. Live walkthrough (100 s): a 30-second check-in; a drift alert with a next step; the CO2 and headache correlation; the "what leaves this device" panel with one share decision; the crew readiness screen built only from shared items.
4. Offline proof (15 s): turn the network off and show it still works.
5. Close (25 s): decision support not diagnosis, NASA data used, what comes next.

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

Radiation coach, then triage trees, then crew screen polish. Never cut the check-in, baseline and drift alert, the share panel, or offline mode.
