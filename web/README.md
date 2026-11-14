# web: Own Your Baseline frontend (role A)

React 18 + TypeScript + Vite. Runs fully in the browser on mock data until the API (role B) is ready.

## Run

```bash
cd web
npm install
npm run dev        # mock mode, http://localhost:5173
npm run build      # typecheck + production build in dist/
```

With the real backend (role B):

```bash
cd api && uv run uvicorn app:create_app --factory --port 8000     # terminal 1
cd web && VITE_API_MODE=http npm run dev                           # terminal 2
```

The dev server proxies `/api` to `http://localhost:8000` (`vite.config.ts`), so no CORS setup is needed. In http mode, "Reset demo data" calls `POST /demo/reset?day=10`, so today is mission day 10 (B's seed). In mock mode today is day 14.

The built app has no runtime CDN: fonts (Public Sans, DM Mono), chart code, three.js and the 3D model are bundled, so it runs with the network off. Checked with every non-localhost request blocked.

## Demo path (3 minutes)

0. Click **Reset demo data** in the footer before you start. Mock mode: today is mission day 14 (09:40 GMT, the clock stays on day 14). Http mode: today is day 10 (B's seed), the check-in with a mild headache raises the same CO2 alert. Keep "request a measurement" out of the live script for now (gap 12).
1. **Today** (`/`): check-in not done yet. Wearable values are shown, not asked.
2. **Start check-in** (`/checkin`): 4 taps, or "Same as yesterday". Pick a mild or moderate headache.
3. The readout and an alert appear: headaches on 2 of the last 3 days, cabin CO2 above the module's usual level.
4. **Ask the flight surgeon** (`/consult/new`): items pinned, question editable, "Send at next ground link".
5. **Sync now** (top bar): the brief goes to ground and is listed in the sync log.
6. Role switch to **Ground** (`/ground`): crew list, then the inbox, then the record. Write a reply and a note.
7. **Sync now** again, switch back to **Astronaut**: the reply and the note are on Today and Consult, word for word.
8. **What ground sees** (`/consult/ground-view`): the surgeon's screen, from the same record.
9. Optional: **Crew readiness** (`/readiness`): the commander's view, a level and a reason per person. Each astronaut sees the same object about themselves on Consult.

The demo state is kept in the browser (localStorage), so a reload keeps your check-in, brief and notes until you reset.

## Structure

```
src/
  api/types.ts        DRAFT contract (record shapes). Replace with types generated from api/openapi.json
  api/client.ts       ApiClient interface; picks mock or http by VITE_API_MODE
  api/http.ts         fetch client for FastAPI. "planned" paths are in docs/TEAM.md, "proposed" ones need B's OK
  mocks/              MOCK ONLY: seeded 14-day mission (3 crew), in-browser store, placeholder logic
  mocks/fixtures/osd569.ts   REAL NASA OSDR OSD-569 values (generated from the CSV, cited)
  content/            all copy: indicators, body regions, HRP hazards, thresholds with sources
  components/         Shell, Dashboard (one record view), BodyMap, charts, IndicatorCard, record parts
  screens/            Today, CheckIn, Health, IndicatorDetail, Measure, Cabin, Consult, BriefComposer,
                      WhatGroundSees, ground/Crew, ground/Inbox, ground/Record
  styles/tokens.css   design tokens with their sources
```

## Backend integration (done for the demo path)

`src/api/http.ts` is an adapter: it maps the API's shapes (`api/schemas.py`) onto the view models the screens use (`src/api/types.ts`), so screens do not change between mock and http mode. The full demo path (check-in, alert, brief, sync, ground reply and note, sync, astronaut sees both) passes against the live API with no errors.

`ApiClient.supports` tells the UI what the backend can do. In http mode the UI hides symptom logging, shows pinned items read-only, and keeps "Mark done" on replies in this browser only.

### Gaps for the backend (B), each marked `GAP` in `src/api/http.ts`

| # | Gap | Workaround in the adapter | Proposal |
|---|---|---|---|
| 1 | No mission day or mission start in the API | Day 1 = earliest check-in date | `GET /mission` → `{mission_start, day, now, module}` |
| 2 | Timestamps have no time zone | Parsed as UTC | Return `...Z` (aware datetimes) |
| 3 | `POST /checkin` upserts the whole day, and there is no measurement endpoint | A reading resends today's answers plus the reading; needs today's check-in first | `POST /astronaut/{id}/measurements` |
| 4 | `/series` is astronaut-side only | Ground charts are cut at `last_sync_at` in the adapter | `?side=ground` or `as_of` |
| 5 | No symptom log | Hidden in http mode | `POST /astronaut/{id}/symptoms` (U8) |
| 6 | No reply acknowledgement | Kept in localStorage | `POST /replies/{id}/ack` |
| 7 | Brief pins are fixed by the API | Pins shown read-only | Accept `pinned_items` in `BriefIn` |
| 8 | No link status (pending counts, next window) | Counted from the two views | `GET /link` |
| 9 | No module per crew in responses | "Node 1" | Add `module` to `CrewRow` |
| 10 | OSD-569 returns a placeholder; shape has one value per indicator, no per-crew time points | Shows the bundled copy of the real NASA file (`src/content/osd569.ts`, cited, generated from the OSDR CSV) and says so on the card | C's ETL: keep per-sample values (crew, timepoint) so the dot chart works |
| 12 | Measurement requests never close (no link between a reading and a request) | Request stays open | Close the request when a matching reading arrives |
| 11 | Crew names are "Astronaut A (simulated)", no role | Shown as is, role "Crew member · simulated" | Add `role` to `CrewRow` |

`src/mocks/logic.ts` stays a stand-in for mock mode only. Do not port it to the API.

## 3D body map

`src/components/BodyMap3D.tsx`: NASA's own astronaut model in the EMU spacesuit, from NASA 3D Resources (`public/models/`, source and terms in `public/models/README.md`). Physically based lighting with an environment map, a reflective gold visor, a cool rim light, a slow scan band added to NASA's materials, and a scanner ring on the selected region. The file is Draco-compressed; the decoder is bundled in `public/draco/`. Drag to rotate, scroll to zoom, auto-rotates when idle.

- Region hotspots are HTML buttons that follow anchors snapped to the skin, so they work with the keyboard and screen readers. Hotspots on the far side dim.
- A row of region buttons under the model keeps large, fixed targets for gloves.
- three.js and the model load in a separate chunk only when the 3D view is open.
- Falls back to the 2D SVG map when WebGL is missing or the model fails. The 3D/2D choice is remembered. Phones start in 2D.
- `prefers-reduced-motion`: no auto-rotate, no scan band, no pulse.

## Rules the UI follows

- Status = shape + word + color (circle In range, triangle Watch, diamond Act now). Never color alone.
- Every health message: what changed, one next step, "Contact the flight surgeon if...". Footer: "Decision support, not a diagnosis."
- Simulated values carry a "Simulated" tag. The OSD-569 card says "Inspiration4 crew sample, not your labs" and cites the dataset.
- Any number without a source is labeled "Demo parameter" (`src/content/sources.ts`).
- Open record: the astronaut's Health screen, the Ground record and "What ground sees" render the same `Dashboard` from the same record shape.
- 44px minimum touch targets, 56px primary buttons, keyboard access, `prefers-reduced-motion`, contrast 4.5:1 or better.

## Design references

Tokens come from real NASA and mission-ops sources, not a generic palette (details in `src/styles/tokens.css` and `docs/DESIGN.md`):

- NASA Horizon Design System, https://github.com/nasa/hds-core : carbon neutrals, NASA blue, active green, Public Sans and DM Mono.
- NASA Open MCT (mission control framework), Espresso theme: limit yellow.
- Astro UXDS status system (space ground systems): status as symbol + color.
- Medical alarm convention (IEC 60601-1-8): red for high priority, yellow for medium.
