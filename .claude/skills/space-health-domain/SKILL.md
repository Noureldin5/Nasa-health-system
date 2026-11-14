---
name: space-health-domain
description: Domain rules for the astronaut health monitoring project. Use when writing health logic, UI copy, alerts, thresholds or demo scripts, so the work stays decision-support, open-record and grounded in the team's research.
---

# Space health domain rules

Read `docs/research/astronaut-health-problems.md` for evidence and `docs/IDEAS.md` for the product direction.

## Facts the product is built on (from the team's research, verify before quoting)

- Headaches and vision changes (SANS) are the most common spaceflight symptoms. In one study 22 of 24 ISS astronauts reported headaches.
- Astronauts may hide symptoms for fear of being grounded. The team chose an open record anyway (ground sees everything, the astronaut sees everything ground sees), so make every ground note visible and keep replies advisory.
- Procedures are tedious and workdays are long (about 16 hours). Tools that need manual input go unused.
- Crew-versus-Mission-Control friction is a bigger problem than crew-versus-crew. Ground consults, it does not direct. Avoid a surveillance feel: nothing ground knows or writes is hidden from the astronaut.
- There is no real-time Earth support on deep missions. The tool must work offline.

## Copy and alert rules

- Say "possible", "worth checking", "compare with your baseline". Never "you have" or "diagnosis".
- Every alert gives one plain next step and one "when to contact the flight surgeon" note.
- No alarm fatigue: group related signals, rate-limit alerts, show severity in text and shape, not only color.

## Data rules

- Label simulated data everywhere it appears.
- A threshold needs a citation or the label "Demo parameter".
- Personal baseline beats population average for drift detection. Use the astronaut's own recent history, with a minimum number of days before alerting.

## Not in scope

Diagnosis, treatment advice, real patient data, anything that implies medical certification.
