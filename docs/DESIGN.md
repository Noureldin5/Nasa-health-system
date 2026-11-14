# Design and frontend notes

Seven concept designs were made as Claude Design canvases. The sources are in `design/<name>/` (`*.dc.html` plus `canvas.json`). They are reference only: they need the Design canvas runtime and do not render on their own. Open the links to see them.

The links are private until shared. The owner can share each one from its Share menu. If the repo is public, share the links to anyone with the link before submitting, so judges can open them.

All data in the designs is simulated. Thresholds and the radiation budget are placeholders. Each needs a NASA source before the demo (see `docs/research/nasa-datasets.md`).

## Shared design language

Dark, high-contrast, "mission ops console meets clinical record". Since 2026-11-14 the built app (`web/`, branch `FE`) uses tokens taken from real NASA and mission-ops sources instead of the teal-on-navy set in the canvases. Source of truth: `web/src/styles/tokens.css`.

| Token | Value | Use | Source |
|---|---|---|---|
| `--c-bg` | `#17171b` | page background | NASA HDS `carbon-90` (dark default) |
| `--c-surface` | `#1e1e23` | cards | between HDS `carbon-90` and `carbon-80` |
| `--c-line` | `#2e2e32` | borders | HDS `carbon-80` |
| `--c-text` | `#e3e3e3` | main text | HDS `carbon-10` |
| `--c-muted` | `#959599` | secondary text (5.6:1) | HDS `carbon-40` |
| `--c-action` | `#1c67e3` | primary buttons, white text 5.1:1 | HDS `nasa-blue` ("blue means do something here") |
| `--c-link` | `#5aa2ff` | links, focus ring | lighter tint of NASA blue |
| `--c-ok` | `#47da84` | in range | HDS `active-green` |
| `--c-watch` | `#fdc707` | worth checking | NASA Open MCT Espresso, limit-yellow icon |
| `--c-act` | `#ff5c52` | contact the flight surgeon | HDS `nasa-red-tint` |
| `--c-series` | `#3987e5` | chart line (charts only) | checked with the dataviz validator |

Sources: NASA Horizon Design System tokens (https://github.com/nasa/hds-core, `tokens.json`), NASA Open MCT (`src/styles/_constants-espresso.scss`), Astro UXDS status system (https://astrouxds.com/patterns/status-system/), IEC 60601-1-8 alarm colors (red high priority, yellow medium). No NASA insignia is used.

- Fonts: Public Sans for text and DM Mono for numbers and micro-labels, as in NASA HDS. Bundled through `@fontsource`, so the app works offline.
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
- Share panel: superseded by the open record (2026-11-14, see `docs/IDEAS.md`). Drop the switches. Reuse the screen as the sync log: what was sent to ground and when, plus queued briefs.
- Blood-count card (needs design, requirement M2b): add a seventh card or an immune/blood region on the body map showing white cells and lymphocytes. Label it "Inspiration4 crew sample, not your labs".
- Real data: show the OSD-569 min and max as an "Earth reference range" beside the astronaut's own baseline. Status color and alerts follow the personal baseline, not the Earth range (see `docs/research/competitors.md`).
- Consult layer (needs redesign): `Ground.dc.html` was drawn for the old per-item sharing. Rework it for the open record: no switches and no "Not shared". The astronaut's "What ground sees" view shows the same record as the surgeon screen, plus the surgeon's notes. Below it, the consult brief: pinned items, the question, and a "Send at next ground link" button.
- Flight surgeon screen (design needed, requirement D7): a "Ground" role switch. Full dashboard of the astronaut, an inbox of briefs with the question on top, a reply box and a notes field. Everything written here also appears in the astronaut's app.

### 2. Cabin Link

Link: https://claude.ai/artifact/Fa8RRwgeqKbHrhRg6jf3CR . Source: `design/cabin-link/`.

- 1280x760 page. Left: 14-day CO2 line chart with a shaded "above limit" band and triangle markers for headache days. Right: a "Pattern found" card and a "Things to try" card.
- Draw the chart from one scale for x and y. Read the `dataviz` skill first. Label units (parts per million).
- The CO2 limit line is 3 mmHg as a 1-hour average, about 3,947 ppm at 760 mmHg (cited in `pipeline/references.py`). The 3,500 ppm placeholder is gone.
- Wording stays "a pattern to check, not a cause".

### 3. Crew Readiness

Link: https://claude.ai/artifact/24pLRqM1CYeeKgDa5pTqwy . Source: `design/crew-readiness/`.

- Four crew cards in a grid, each with a sleep bar and a workload bar, plus a suggestion card for the commander.
- Open record default (2026-11-14): the commander sees a readiness status per person (sleep and workload level), not raw medical data. The astronaut can see what the commander sees about them. The design's "Not shared" cards are superseded.

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
2. Indicator card with sparkline and personal baseline, fed by the API. OSD-569 goes on the separate blood-count card as an Earth reference range.
3. Dashboard layout and body map.
4. Check-in flow.
5. Consult brief, flight surgeon screen (Ground role), "What ground sees", sync log.
6. Cabin Link chart.
7. Environment Switcher, then Crew Readiness and Mission Quest if time is left.
8. Offline: self-hosted fonts and bundled scripts, no runtime CDN. The app talks only to the local API.
