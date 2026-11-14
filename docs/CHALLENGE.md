# Official challenge text

Source: pasted by the team from the NASA Space Apps challenge page (spaceappschallenge.org), 2026-11-14. Verbatim. The Resources tab was added below the same day. Judging criteria and submission rules are still missing.

Challenge title: Create Health Monitoring Software for Astronauts on Space Missions

## Background

With rising investment in spacecraft technology and research, space missions have become more ambitious. NASA's Artemis program recently accomplished a crewed lunar flyby, and NASA and others have plans to send humans to Mars in the future. With increasingly longer missions, astronauts will be more exposed to the hostile space environment, which brings both physical and mental health risks.

NASA's Human Research Program has mapped the five hazards of human spaceflight, which are space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments. These hazards can contribute to health problems such as immune system changes, bone density loss, cardiovascular events, inadequate nutrition, behavioral health conditions, and others. Astronauts must be capable of making health assessments on themselves during a mission, to prevent and treat health problems that may arise. Some useful health indicators are blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, and mood.

## Objectives

Your challenge is to create a visual tool that helps astronauts assess their own health during space missions and provides guidance on treatments and health improvements. You may consider gathering data from the user through any kind of input (keyboard text, mouse clicks, or camera images, for example). Any kind of data can be used, as long as it represents a health indicator, such as blood sugar levels in mg/dL or ultrasound images.

You can use NASA's Human Research Program resources, along with the publicly available resources from other space agencies, to understand how spaceflight hazards affect human health, and to decide which indicators are useful and how they can support a quick assessment. Which measurements can be performed in space? Why is an exam needed? How do spaceflight hazards affect these health indicators? When might a result warrant attention from the crew or from flight surgeons on the ground? What actions can be taken to prevent a critical health condition? These are questions worth considering as you develop your solution.

User interface design plays an important role in presenting metrics and diagnosis clearly. You may consider taking advantage of animations and interactivity to present the information. For example, the software could display a human figure where each part of the body is clickable and displays information about its function and health status.

## Potential considerations

You may (but are not required to) consider the following:

- Your tool could provide health insights for astronauts in different environments, such as a spacecraft, a space station, a rover, or a base on another planet or moon.
- Your tool could prompt astronauts to take measurements or complete specific actions from time to time as a part of the mission routine.
- Your tool could include the following features:
  - A gamification system to help astronauts engage with tasks that support their health
  - Dynamic charts that show how astronaut's health indicators change over time
  - Color coding that helps the astronaut interpret the status of a health indicator at a glance
- Do not assume that astronauts know everything about how to assess their health. Your tool could provide simple instructions and explanations covering measurements, health indicators, and risks.

For data and resources related to this challenge, refer to the Resources tab at the top of the page. More resources may be added before the hackathon begins.

## Resources tab (pasted by the team, 2026-11-14)

NASA does not endorse any non-U.S. Government entity. For non-U.S. Government websites, participants must comply with that website's data use parameters.

NASA data and resources (no datasets or API, only articles):
- 5 Hazards of Human Spaceflight: https://www.nasa.gov/hrp/hazards/
- Risks of Human Spaceflight: https://www.nasa.gov/hrp/risks/ (17 risks: 11 physiology, 5 behavioral, 1 radiation)
- Ongoing HRP Research in Space: https://www.nasa.gov/hrp/ongoing-hrp-research/

Space agency partner resources (CSA):
- Monitoring Radiation for Astronaut Health: https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- Why Do We Conduct Science Experiments in Space?: https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp

The Resources tab lists no dataset. OSD-569 (OSDR) comes from the team's own research (`docs/research/nasa-datasets.md`).

How the app uses them: hazards in `data/processed/hazards.json` (served at `GET /reference/hazards`); risk pages cited on each indicator and on the Environment screen (`web/src/content/risks.ts`, our mapping, labeled as such); the CSA articles linked from the Environment screen.

## TODO (teammate)

- Paste the judging criteria and submission requirements.
- Date copied for those: 

## Objective to feature map

| Official objective | Our feature |
|---|---|
| Visual tool for self-assessment | Clickable body map with per-organ status, plus a status summary screen |
| Gather data via any input | 30-second check-in (taps), manual measurement entry (BP, HR, glucose, temp, sleep, mood), optional camera or image input |
| Guidance on treatments and health improvements | Plain-language next steps per indicator, with a "contact flight surgeon" threshold |
| Explain which measurements, why, and how hazards affect them | Per-indicator explainer cards linked to the five HRP hazards |
| When a result warrants attention | Baseline drift plus reference-range alerts, color and shape coded |
| Prompt measurements as mission routine | Scheduled measurement prompts, passive data where possible |
| Dynamic charts over time | Trend charts against the personal baseline |
| Color coding at a glance | Status colors plus icons and text (never color alone) |
| Gamification (optional) | Check-in streak on Today (counts check-ins only, never health values). Built. No health score |
| Different environments (optional) | Environment selector (screen "Where you are"): station, spacecraft, rover, surface base. Built |
| Simple instructions for non-experts | Step-by-step "how to take this measurement" guides |
