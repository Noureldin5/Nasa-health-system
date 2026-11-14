# Design and frontend notes

Seven concept designs were made as Claude Design canvases. The sources are in `design/<name>/` (`*.dc.html` plus `canvas.json`). They are reference only: they need the Design canvas runtime and do not render on their own. Open the links to see them.

The links are private until shared. The owner can share each one from its Share menu. If the repo is public, share the links to anyone with the link before submitting, so judges can open them.

All data in the designs is simulated. Thresholds and the radiation budget are placeholders. Each needs a NASA source before the demo (see `docs/research/nasa-datasets.md`).

## Shared design language

Dark, high-contrast, instrument-panel feel. Use these as CSS variables.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B1220` | page background |
| `--card` | `#121B2E` | cards |
| `--line` | `#23304A` | borders |
| `--text` | `#E6ECF5` | main text |
| `--muted` | `#9AA8BF` | secondary text |
| `--accent` | `#3DD6C3` | primary actions, focus, "private" cues |
| `--ok` | `#5FE0B5` | in range |
| `--watch` | `#F5BF55` | worth checking |
| `--crit` | `#FF8A7E` | contact the flight surgeon |

- Fonts: IBM Plex Sans for text, IBM Plex Mono for numbers (tabular figures). The designs load them from Google Fonts. The app must work offline, so self-host the font files.
- Never show status by color alone. Every status pill has an icon shape and a word: circle "In range", triangle "Watch", diamond "Act now".
- Touch targets at least 44px, primary buttons 56px tall.
- Every health message has three parts: what changed, one next step, and "Contact the flight surgeon if...".
- Footer on every screen: "Decision support, not a diagnosis." and a "Simulated data" label wherever data is simulated.
- Respect `prefers-reduced-motion`. Keep contrast at 4.5:1 or better.

## Concepts

### 1. Own Your Baseline (the product, build first)

Link: https://claude.ai/artifact/SiT5J4GY7ZEPALAvSa6vM7 . Source: `design/own-your-baseline/`.

Screens: Dashboard (`Main.dc.html`), 30-second check-in (`CheckIn.dc.html`, 390x844), Share panel (`Share.dc.html`, 390x844).

Frontend notes:
- Dashboard is a flex-wrap layout: body map on the left, six indicator cards in a grid (`repeat(auto-fit, minmax(210px, 1fr))`), then one "Worth checking" insight card. It stacks on a phone.
- Indicator card: name, status pill, big value with unit, a 7-point sparkline with the last point emphasized, and "Your baseline min to max".
- Body map: build as one SVG with a `<button>` per region (brain and eyes, heart, bones, muscles). Selecting a region opens its explainer: what it does, which measurement, how the five HRP hazards affect it, when to call the flight surgeon. The design only shows labels, so the explainer panel still needs designing.
- Check-in: one question per screen, big segmented buttons (`aria-pressed`), a 4-step progress bar, an "about 20 s left" timer. Heart rate and sleep come from the wearable, never typed.
- Share panel: a switch per item, default off. A dashed "Next export to flight surgeon" box lists exactly what would be sent. Sending queues until the next ground link.
- Blood-count card (needs design, requirement M2b): add a seventh card or an immune/blood region on the body map showing white cells and lymphocytes. Label it "Inspiration4 crew sample, not your labs".
- Real data: show the OSD-569 min and max as an "Earth reference range" beside the astronaut's own baseline. Status color and alerts follow the personal baseline, not the Earth range (see `docs/research/competitors.md`).
- Consult layer (design needed): see the added board "What I see / what ground sees" in the same canvas. Left side lists the astronaut's items, each with a share switch. Right side shows exactly what ground would receive, with hidden items shown as "Not shared", never zero. Below it, the consult brief: included items, the question, and a "Send at next ground link" button.

### 2. Cabin Link

Link: https://claude.ai/artifact/Fa8RRwgeqKbHrhRg6jf3CR . Source: `design/cabin-link/`.

- 1280x760 page. Left: 14-day CO2 line chart with a shaded "above limit" band and triangle markers for headache days. Right: a "Pattern found" card and a "Things to try" card.
- Draw the chart from one scale for x and y. Read the `dataviz` skill first. Label units (parts per million).
- The 3,500 ppm line is a placeholder. Cite a NASA CO2 source (NASA NTRS 20150021777 and the OCHMO brief are in the research notes).
- Wording stays "a pattern to check, not a cause".

### 3. Crew Readiness

Link: https://claude.ai/artifact/24pLRqM1CYeeKgDa5pTqwy . Source: `design/crew-readiness/`.

- Four crew cards in a grid, each with a sleep bar and a workload bar, plus a suggestion card for the commander.
- A hidden item shows "Not shared", never zero, and a member who shares nothing gets a dashed card. This is the core privacy rule. Test it.
- Build the view only from records the astronaut exported. It must have no access to private data.

### 4. Mission Quest

Link: https://claude.ai/artifact/HieiNvoSXnoUneSqwNaFGJ . Source: `design/mission-quest/`.

- 390x844 phone screen: score ring, streak, five quests with a check circle and points, next-badge progress bar.
- Score ring: SVG circle with `stroke-dasharray`, value announced with `aria-label`.
- Tone: quests are reminders and skipping is never reported. No leaderboards, no shaming.

### 5. Environment Switcher

Link: https://claude.ai/artifact/RrUB161Xe9LGeH5kuJ6hqX . Source: `design/environment-switcher/`.

- The only interactive artboard. Four buttons (station, spacecraft, rover, surface base) swap the hazards, key checks and ground-contact delay. Use `aria-pressed`.
- Keep the content in one data file keyed by environment, so teammates can edit copy without touching components.
- The hazard text is a plain summary. Each needs a NASA HRP citation.

### 6. Radiation Budget Coach

Link: https://claude.ai/artifact/QPCMuYvLoQ9Kxkrvo1LHzh . Source: `design/radiation-budget/`.

- A wide progress bar with a solid used segment, a faded projected segment and a dashed marker for projected end of mission. Plus a spike explainer and a "what you can do" card.
- `[BUDGET]` is a placeholder. Use real dose data only if RadLab data is connected; otherwise keep it labeled simulated.
- Roadmap item. Build after the core.

### 7. Camera Check

Link: https://claude.ai/artifact/KydsKCxifXmm25KRvecMxx . Source: `design/camera-check/`.

- 390x844 mock: camera guide outline, last week versus today, and a "Worth checking" card.
- Roadmap only. The image is a drawn example, labeled as such. Photos stay on the device. Do not claim to detect disease.

## Build order for the frontend

1. Tokens and the status pill component (icon + word + color).
2. Indicator card with sparkline, fed by OSD-569 values and ranges.
3. Dashboard layout and body map.
4. Check-in flow.
5. Share panel and Crew Readiness (shared logic: only exported records).
6. Cabin Link chart.
7. Environment Switcher and Mission Quest.
8. Offline: service worker, self-hosted fonts.
