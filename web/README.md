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

## Mission replay, light-time link, record assistant (added 2026-11-15)

Three additions on top of the demo path. All work in mock and http mode, and with the network off.

- **Mission replay** (`/replay`, and `/ground/crew/:id/replay` from the ground copy): one scrubber over the mission. The 3D body map, cabin CO2, headaches, sleep, heart rate and mood move under one playhead, and the record's real events (alert, brief, reply, note) are marked on the track. Past days are drawn as "inside / outside today's usual band" with square marks, never with a status pill: the status the app gave on that day came from that day's alert logic, which a replay cannot know. Only today's frame shows the record's real statuses (`src/lib/replay.ts`). Playback starts at the last calibration day.
- **Light-time link**: the Consult screen has a mission distance (LEO, Moon, Mars). Pressing Sync shows the record and the brief travelling to ground and the reply coming back, with a clock in real signal time (`src/components/SignalPath.tsx`, `src/content/lightTime.ts`). Only the Mars figure is a NASA statement ("a communication delay of up to 20 minutes one way", https://www.nasa.gov/hrp/hazard-distance-from-earth/). Moon (1.28 s) and LEO are derived from NASA distances divided by the speed of light and labeled "derived". The animation is time-compressed and says by how much.
- **Record assistant** (`/ask`, "Why this alert?" on Today, "Draft from pinned items" in the brief composer): plain-words text built from facts the app already computed. Every answer has cite chips (metric, day, value) whose values are read from the record, and the cited days light up on the charts (`?hl=12,13` on the indicator and Cabin Link screens).
  - Without a model it still works: the answer is built by fixed rules from the same facts (`src/ai/assistant.ts`) and is tagged "Fixed rules". This is the path that runs with the network off.
  - With a key on the station server, a language model rephrases the same facts (`api/routes/ai.py`). The key never reaches the browser. Timeout 4 s, answers cached in `api/.ai_cache.json` so a rehearsed demo replays offline.
  - Strong symptoms, questions about medicines and any open "Act now" alert get a fixed "contact the flight surgeon" text and never reach the model. Model text that reads like a dose or a diagnosis is dropped.
  - Open record: each answer has "What was sent to <provider>" with the exact facts, or "Nothing left the station", and the Ask screen lists every send. No names are sent ("Crew member", "Flight surgeon"). The assistant is on the astronaut side only, so ground never reads assistant text the astronaut cannot see. It never writes to the record and never changes a status.
  - With the mission distance set to Mars the model is not called at all: there is no live link, so the fixed rules answer.
  - The cloud model is a stand-in for an on-board model: on a Mars-distance mission there is no link to call it over, and the fixed-rules path is what remains.

Set it up: copy `.env.example` to `.env` in the repo root, set `AI_PROVIDER` (gemini, deepseek or openai) and `AI_API_KEY`, restart the API. `GET /api/ai/status` says whether a key is set. Checked on 2026-11-15: Gemini has a free tier for `gemini-3.5-flash-lite` (https://ai.google.dev/gemini-api/docs/pricing), Kyrgyzstan is in Google's region list (https://ai.google.dev/gemini-api/docs/available-regions), and free-tier content is used to improve Google products, which is acceptable here because every value is simulated and no names are sent. DeepSeek's pricing page lists no free tier (https://api-docs.deepseek.com/quick_start/pricing). Gemini was called with a real key on 2026-11-15: `gemini-3.5-flash-lite` with `reasoning_effort: minimal` answers in 1 to 2 s, inside the 4 s limit. DeepSeek has not been called with a real key; that preset was only tested against a local stand-in server.

Files outside `web/` (for B and C): new `api/routes/ai.py` and `api/tests/routes/test_ai.py`; one import and one router line in `api/app.py`; optional `env_file` on the `api` service in `deploy/docker-compose.yml`; `!.env.example` and the cache file in `.gitignore`; `**/.env*` and the cache file in `.dockerignore`; new `.env.example`. `api/openapi.json` was not regenerated (`uv run python scripts/export_openapi.py`).

## Structure

```
src/
  api/types.ts        DRAFT contract (record shapes). Replace with types generated from api/openapi.json
  api/client.ts       ApiClient interface; picks mock or http by VITE_API_MODE
  api/http.ts         fetch client for FastAPI. "planned" paths are in docs/TEAM.md, "proposed" ones need B's OK
  mocks/              MOCK ONLY: seeded 14-day mission (3 crew), in-browser store, placeholder logic
  mocks/fixtures/osd569.ts   REAL NASA OSDR OSD-569 values (generated from the CSV, cited)
  content/            all copy: indicators, body regions, HRP hazards, thresholds with sources
  ai/                 record assistant: facts sent to the model, safety rules, fixed-rule answers
  components/         Shell, Dashboard (one record view), BodyMap, charts, IndicatorCard, record parts,
                      assistant (draft block, cite chips), SignalPath (ground link in flight)
  lib/replay.ts       per-day marks and events for the mission replay
  screens/            Today, CheckIn, Health, IndicatorDetail, Measure, Cabin, Consult, BriefComposer,
                      WhatGroundSees, Replay, Ask, ground/Crew, ground/Inbox, ground/Record
  styles/tokens.css   design tokens with their sources
  styles/features.css replay, signal path, assistant and Today layout (same tokens)
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
- Each region is also tinted on the suit itself in its status color (a small shader addition to NASA's material), and pulses gently for Watch and Act now. The hotspot still carries the shape and the word, so status is never color alone. Labels sit on the outside of the body, so they do not cross the torso.
- Lighting is kept low and from the side (`lightScene`, `LOOK`), because the suit texture is near white and washes out under a bright front light. A soft contact shadow sits under the boots.
- The 2D map is the same astronaut: a front render of the NASA model made with the same lighting (`public/models/nasa-astronaut-emu-front.webp`, 26 kB), with status markers, a status tint and callouts drawn over it in SVG. It needs no WebGL.
- A row of region buttons under the model keeps large, fixed targets for gloves.
- three.js and the model load in a separate chunk only when the 3D view is open.
- Falls back to the 2D SVG map when WebGL is missing or the model fails. The 3D/2D choice is remembered. Phones start in 2D.
- `prefers-reduced-motion`: no auto-rotate, no scan band, no pulse.

## Rules the UI follows

- Status = shape + word + color (circle In range, triangle Watch, diamond Act now). Never color alone.
- Every health message: what changed, one next step, "Contact the flight surgeon if...". The line "Decision support, not a diagnosis" and the "Simulated data" tag in the top bar were removed from the screens on 2026-11-15 (frontend owner's decision); the record assistant block keeps "not a diagnosis".
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
