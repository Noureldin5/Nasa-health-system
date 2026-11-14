# Messages from C to the team (2026-11-14)

Texts to paste into the team chat. Details behind them: `docs/DECISIONS.md` (sections 5, 6, 10) and `docs/HANDOFF.md`, "Role C status".

## To B

> B, the data pipeline is ready. Three things:
>
> 1. I confirmed all 8 rows of DECISIONS section 10 (see "C's answer to section 10"). Use `pipeline.crew.module_of` instead of your own crew-to-module map. In the real metrics adapter, make `seed` call `pipeline.reset.demo_reset(day)`, so `POST /demo/reset` resets both stores (SQLite and VictoriaMetrics). There was no importable call for this before; now there is.
> 2. Row 9 is new and needs your answer. The API groups by the UTC calendar date, but a mission day runs from 18:00 UTC to 18:00 UTC (midnight to midnight in Bishkek). Simplest fix on your side: one helper that groups by `(at + timedelta(hours=6)).date()`. Without it, mission day 9 values land on day 10 once the real adapter is on.
> 3. Two traps in the numbers. Build the baseline through `today - 1` and do not compare today's heart-rate mean to it: today is a partial day (`DailyValue.complete` is `False`) and its mean sits about 5 bpm low. The daily maximum of CO2 is a 5-minute peak, not a 1-hour average, so do not compare it to the limit; use `hours_above_limit` from `cabin_link`.

## To A

> A, three notes for the data screens:
>
> 1. **Cabin Link.** Draw the day overlay: CO2 per day, above-usual, hours above the limit, the symptom. Write the sentence from `lead_days`, for example "CO2 rose on day 9, your headache came on day 10". Show `lags` and `best_lag` only when `correlation_ready` is true, as a small line under the overlay. On demo day 10 it is false, so the overlay is the whole screen. Always show `caveat` and `limit` with the numbers.
> 2. **OSD-569 blood-count card.** Each value has `quality` (`ok` or `suspect`), and `vs_range` can be `null` for suspect values. One indicator can have two female reference ranges (hemoglobin, red cells, hematocrit), so do not assume a single min and max. Label: "Inspiration4 crew sample, not your labs". Source and DOI are in the JSON.
> 3. **Environment Switcher.** Texts are in `data/processed/hazards.json`. `nasa_quotes` are verbatim from NASA pages. The `app_link` text is ours and says so in `provenance`.

## To the whole team

> Four questions I need answered, because they change the demo story and the docs (DECISIONS section 7):
>
> 1. **Which mission day is "today" at the demo?** I propose day 10, because the live headache check-in is on day 10 in `docs/USER-FLOW.md`. If today is day 14, the live check-in comes after the story is over.
> 2. **Do we allow a third `source` value, `manual`,** for values typed in the app? I propose yes. It is already implemented, and it lets the UI label typed values honestly and clear them without reloading the mission.
> 3. **How often do blood pressure, glucose and temperature appear?** I propose one simulated reading per mission day, with the weekly slot adding a typed point on top. M2 asks for a 7-day trend and a baseline for each, and two points in 14 days give neither.
> 4. **What does the blood-count card say?** The requirement says "beside the personal baseline", but OSD-569 has no in-flight samples to build a baseline from. I propose showing the Inspiration4 values with the Earth range, no personal baseline.
>
> Also open for B and A: the day boundary (row 9 above). Once we answer, the affected lines in `docs/TEAM.md`, `docs/REQUIREMENTS.md` and `docs/USER-FLOW.md` get a one-line update in one `shared/` PR.
