/**
 * Mission replay: what the stored record looked like on each mission day.
 *
 * Past days are re-drawn from the readings in the record against TODAY's usual band. They are
 * marked "inside usual" or "outside usual", never with a status pill: the status the app showed on
 * that day came from the alert logic of that day, which a replay cannot know. Only today's frame
 * uses the record's real statuses. Events (alert, brief, reply, note, sync) are real record events.
 */
import type { CabinData, Headache, MetricKey, RecordView, RegionKey, SyncEntry } from "../api/types";
import { INDICATORS, METRIC_ORDER } from "../content/indicators";
import { REGION_ORDER, REGIONS } from "../content/regions";
import { missionDayOf } from "./format";

export type Mark = "in" | "out" | "learning" | "none";

export const MARK_WORD: Record<Mark, string> = {
  in: "Inside usual",
  out: "Outside usual",
  learning: "Learning",
  none: "No reading",
};

export interface ReplayEvent {
  day: number;
  kind: "baseline" | "band" | "headache" | "alert" | "brief" | "reply" | "note" | "sync";
  text: string;
  /** Higher = more worth a caption. */
  weight: number;
}

export interface SeriesByDay {
  key: MetricKey | "co2";
  label: string;
  unit: string;
  decimals: number;
  band: { low: number; high: number } | null;
  /** value per mission day (index 0 = day 1), null where the record has no reading. */
  values: (number | null)[];
  /** second value for blood pressure */
  values2?: (number | null)[];
}

export interface Replay {
  days: number;
  calibrationDays: number;
  series: SeriesByDay[];
  headache: (Headache | null)[];
  events: ReplayEvent[];
  markOf: (key: MetricKey | "co2", day: number) => Mark;
  regionOf: (region: RegionKey, day: number) => { mark: Mark; why: string };
  captionOf: (day: number) => string;
}

export function buildReplay(rec: RecordView, cabin: CabinData | null, log: SyncEntry[]): Replay {
  const m = rec.mission;
  const days = m.day;
  const cal = rec.indicators.find((i) => i.baseline.of)?.baseline.of ?? 7;
  const dayOf = (t: string) => missionDayOf(t, m);
  const empty = () => Array.from({ length: days }, () => null as number | null);

  const series: SeriesByDay[] = METRIC_ORDER.map((key) => {
    const ind = rec.indicators.find((i) => i.key === key)!;
    const values = empty();
    const values2 = empty();
    for (const p of ind.series) {
      const d = dayOf(p.t);
      if (d < 1 || d > days) continue;
      values[d - 1] = p.v;
      if (p.v2 != null) values2[d - 1] = p.v2;
    }
    const b = ind.baseline;
    return {
      key,
      label: INDICATORS[key].label,
      unit: INDICATORS[key].unit,
      decimals: INDICATORS[key].decimals,
      band: b.state === "ready" && Number.isFinite(b.low) ? { low: b.low, high: b.high } : null,
      values,
      values2: key === "bp" ? values2 : undefined,
    };
  });

  // Cabin CO2: one mean per mission day.
  const sums = Array.from({ length: days }, () => ({ s: 0, n: 0 }));
  for (const p of cabin?.co2 ?? []) {
    const d = dayOf(p.t);
    if (d >= 1 && d <= days) {
      sums[d - 1].s += p.v;
      sums[d - 1].n += 1;
    }
  }
  series.push({
    key: "co2",
    label: "Cabin CO2",
    unit: "ppm",
    decimals: 0,
    band: cabin && Number.isFinite(cabin.usual.low) ? { low: cabin.usual.low, high: cabin.usual.high } : null,
    values: sums.map((e) => (e.n ? Math.round(e.s / e.n) : null)),
  });

  const headache: (Headache | null)[] = Array.from({ length: days }, () => null);
  for (const c of rec.checkIns) if (c.day >= 1 && c.day <= days) headache[c.day - 1] = c.headache ?? null;

  const bp2 = rec.indicators.find((i) => i.key === "bp")?.baseline;
  function markOf(key: MetricKey | "co2", day: number): Mark {
    const s = series.find((x) => x.key === key)!;
    // The latest reading on or before this day (weekly measurements keep their last value).
    let i = day - 1;
    while (i >= 0 && s.values[i] == null) i--;
    if (i < 0) return "none";
    if (day <= cal || !s.band) return "learning";
    const v = s.values[i]!;
    if (v < s.band.low || v > s.band.high) return "out";
    const v2 = s.values2?.[i];
    if (v2 != null && bp2?.low2 != null && bp2.high2 != null && (v2 < bp2.low2 || v2 > bp2.high2)) return "out";
    return "in";
  }

  function regionOf(region: RegionKey, day: number): { mark: Mark; why: string } {
    const parts = REGIONS[region].metrics.map((k) => ({ mark: markOf(k, day), why: INDICATORS[k].label.toLowerCase() }));
    const h = headache[day - 1];
    if (region === "brain" && h && h !== "none") parts.push({ mark: "out", why: `${h} headache reported` });
    if (!parts.length) return { mark: "none", why: "Not tracked" };
    const out = parts.filter((p) => p.mark === "out");
    if (out.length) return { mark: "out", why: out.map((p) => p.why).join(", ") };
    if (parts.every((p) => p.mark === "learning" || p.mark === "none")) return { mark: parts.some((p) => p.mark === "learning") ? "learning" : "none", why: "Learning your baseline" };
    return { mark: "in", why: "Inside your usual band" };
  }

  /* ---------- Events ---------- */

  const events: ReplayEvent[] = [];
  if (days > cal) events.push({ day: cal + 1, kind: "baseline", text: `Calibration ends after day ${cal}. Readings are now compared with your own usual band.`, weight: 2 });
  for (const s of series) {
    let was = false;
    for (let d = cal + 1; d <= days; d++) {
      const out = s.values[d - 1] != null && markOf(s.key, d) === "out";
      if (out && !was) {
        const v = s.values[d - 1]!;
        const side = s.band && v > s.band.high ? "above" : "below";
        const whose = s.key === "co2" ? "the module's usual band" : "your usual band";
        events.push({ day: d, kind: "band", text: `${s.label} goes ${side} ${whose}.`, weight: s.key === "co2" ? 5 : 4 });
      }
      if (s.values[d - 1] != null) was = out;
    }
  }
  headache.forEach((h, i) => {
    if (h && h !== "none") events.push({ day: i + 1, kind: "headache", text: `Headache reported in the check-in (${h}).`, weight: 6 });
  });
  const a = rec.alert;
  if (a) {
    events.push({ day: a.day, kind: "alert", text: `Alert raised: ${a.title}.`, weight: 9 });
    if (a.closedAt) events.push({ day: dayOf(a.closedAt), kind: "alert", text: "Alert closed.", weight: 7 });
  }
  for (const b of rec.briefs) events.push({ day: dayOf(b.createdAt), kind: "brief", text: `Question to the flight surgeon: “${b.question}”`, weight: 8 });
  for (const r of rec.replies) events.push({ day: dayOf(r.deliveredAt ?? r.createdAt), kind: "reply", text: `Reply from ${r.author.name}${r.deliveredAt ? " arrives" : " written, waiting for the next link"}.`, weight: 8 });
  for (const n of rec.notes) events.push({ day: dayOf(n.deliveredAt ?? n.createdAt), kind: "note", text: `Note from ${n.author.name}: “${n.text}”`, weight: 7 });
  for (const f of rec.flags) events.push({ day: dayOf(f.deliveredAt ?? f.createdAt), kind: "note", text: `Watch flag from ${f.author.name} on ${INDICATORS[f.metric].label.toLowerCase()}.`, weight: 6 });
  for (const r of rec.requests) events.push({ day: dayOf(r.deliveredAt ?? r.createdAt), kind: "note", text: `${r.author.name} asks for a ${INDICATORS[r.metric].label.toLowerCase()} reading.`, weight: 6 });
  const syncDays = new Set(log.map((e) => e.day).filter((d) => d >= 1 && d <= days));
  for (const d of syncDays) events.push({ day: d, kind: "sync", text: "Ground link: the record syncs to ground.", weight: 1 });
  const inRange = events.filter((e) => e.day >= 1 && e.day <= days).sort((x, y) => x.day - y.day || y.weight - x.weight);

  function captionOf(day: number): string {
    const top = inRange.filter((e) => e.day === day && e.kind !== "sync")[0];
    if (top) return top.text;
    if (day <= cal) return `Learning your baseline: day ${day} of ${cal}.`;
    const out = series.filter((s) => s.values[day - 1] != null && markOf(s.key, day) === "out").map((s) => (s.key === "co2" ? "cabin CO2" : s.label.toLowerCase()));
    if (out.length) return `Still outside the usual band: ${out.join(", ")}.`;
    return "No reading is outside its usual band on this day.";
  }

  return { days, calibrationDays: cal, series, headache, events: inRange, markOf, regionOf, captionOf };
}

export const REPLAY_REGIONS = REGION_ORDER;
