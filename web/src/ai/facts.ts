/**
 * Compact facts for the record assistant (api/routes/ai.py, class Facts).
 *
 * Everything here was computed by our own logic and is already on screen: values, usual ranges,
 * statuses, the alert's three parts, ground's notes word for word. The model receives nothing
 * else and only puts these facts into plain words. No wall-clock time is included, so the same
 * record gives the same facts and the answer cache replays a rehearsed demo offline.
 */
import type { CabinData, Indicator, MetricKey, PinnedItem, RecordView } from "../api/types";
import { INDICATORS, MOOD_WORDS, RESTED_WORDS } from "../content/indicators";
import { STATUS_WORD } from "../components/status";
import { fmtNum, fmtPoint, fmtUsual, missionDayOf } from "../lib/format";

export type CiteKey = MetricKey | "co2" | "headache";

export interface Cite {
  metric: CiteKey;
  day: number;
}

export interface Facts {
  mission_day: number;
  perspective: "astronaut";
  crew: string;
  calibration_days?: number;
  readout?: string;
  tip?: string;
  metrics: { key: MetricKey; label: string; unit: string; status: string; status_text: string; usual?: string; values: Record<string, string> }[];
  checkins: { day: number; rested?: string; headache?: string; mood?: string; vision_change?: string }[];
  cabin?: { module: string; unit: string; usual: string; daily_mean: Record<string, string> };
  alert?: { day: number; severity: string; state: string; title: string; what_changed: string; next_step: string; contact_if: string };
  ground: { kind: string; day: number; author: string; on?: string; text: string }[];
  pinned: { label: string; summary: string }[];
}

/** The record plus the cabin series: what every assistant feature reads from. */
export interface RecordCtx {
  rec: RecordView;
  cabin: CabinData | null;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const range = (s: string) => s.replace(/–/g, " to ");

/** Latest reading per mission day, for the last 14 days. */
export function valuesByDay(ind: Indicator, rec: RecordView): Map<number, { v: number; v2?: number; text: string }> {
  const out = new Map<number, { v: number; v2?: number; text: string }>();
  for (const p of ind.series) {
    const day = missionDayOf(p.t, rec.mission);
    if (day < 1 || day <= rec.mission.day - 14) continue;
    out.set(day, { v: p.v, v2: p.v2, text: fmtPoint(ind.key, p) });
  }
  return out;
}

/** Mean cabin CO2 per mission day. */
export function co2ByDay(ctx: RecordCtx): Map<number, number> {
  const sums = new Map<number, { s: number; n: number }>();
  for (const p of ctx.cabin?.co2 ?? []) {
    const day = missionDayOf(p.t, ctx.rec.mission);
    if (day < 1) continue;
    const e = sums.get(day) ?? { s: 0, n: 0 };
    e.s += p.v;
    e.n += 1;
    sums.set(day, e);
  }
  return new Map([...sums].sort((a, b) => a[0] - b[0]).map(([d, e]) => [d, Math.round(e.s / e.n)]));
}

export function buildFacts(ctx: RecordCtx, pinned: PinnedItem[] = []): Facts {
  const { rec, cabin } = ctx;
  const m = rec.mission;
  const learning = rec.indicators.find((i) => i.baseline.of)?.baseline.of;

  const metrics = rec.indicators.map((ind) => {
    const usual = fmtUsual(ind);
    return {
      key: ind.key,
      label: ind.label,
      unit: ind.unit,
      status: STATUS_WORD[ind.status],
      status_text: clip(ind.statusText, 120),
      usual: usual ? clip(range(usual), 40) : undefined,
      values: Object.fromEntries([...valuesByDay(ind, rec)].slice(-14).map(([d, v]) => [String(d), v.text])),
    };
  });

  const checkins = rec.checkIns.slice(-14).map((c) => ({
    day: c.day,
    rested: c.rested ? RESTED_WORDS[c.rested - 1] : undefined,
    headache: c.headache ?? undefined,
    mood: c.mood ? MOOD_WORDS[c.mood - 1] : undefined,
    vision_change: c.vision ?? undefined,
  }));

  const co2 = [...co2ByDay(ctx)].slice(-14);
  const cabinFacts =
    cabin && co2.length
      ? {
          module: clip(cabin.module, 40),
          unit: "ppm",
          usual: Number.isFinite(cabin.usual.low) ? `${fmtNum(cabin.usual.low)} to ${fmtNum(cabin.usual.high)}` : "still learning",
          daily_mean: Object.fromEntries(co2.map(([d, v]) => [String(d), fmtNum(v)])),
        }
      : undefined;

  const a = rec.alert;
  const label = (k: string) => INDICATORS[k as MetricKey]?.label ?? k;
  const ground = [
    ...rec.replies.map((r) => ({ kind: "reply", t: r.createdAt, author: r.author.name, on: undefined as string | undefined, text: r.text })),
    ...rec.notes.map((n) => ({ kind: "note", t: n.createdAt, author: n.author.name, on: n.target.kind === "metric" ? label(n.target.key) : n.target.kind === "cabin" ? "Cabin CO2" : undefined, text: n.text })),
    ...rec.flags.filter((f) => f.active).map((f) => ({ kind: "watch flag", t: f.createdAt, author: f.author.name, on: label(f.metric), text: f.reason })),
    ...rec.requests.filter((r) => !r.doneAt).map((r) => ({ kind: "request", t: r.createdAt, author: r.author.name, on: label(r.metric), text: r.reason })),
  ]
    .sort((x, y) => Date.parse(x.t) - Date.parse(y.t))
    .slice(-12)
    // Names stay on board: the provider only learns that the author is the flight surgeon.
    .map(({ t, ...g }) => ({ ...g, day: missionDayOf(t, m), author: "Flight surgeon", text: clip(g.text, 600) }));

  return {
    mission_day: m.day,
    perspective: "astronaut",
    crew: "Crew member",
    calibration_days: learning,
    readout: clip([rec.readout.headline, rec.readout.change].filter(Boolean).join(". "), 300),
    tip: rec.readout.tip ? clip(rec.readout.tip, 300) : undefined,
    metrics,
    checkins,
    cabin: cabinFacts,
    alert:
      a && a.state !== "closed"
        ? { day: a.day, severity: a.severity, state: a.state, title: clip(a.title, 200), what_changed: clip(a.whatChanged, 400), next_step: clip(a.nextStep, 300), contact_if: clip(a.contactIf, 300) }
        : undefined,
    ground,
    pinned: pinned.slice(0, 6).map((p) => ({ label: clip(p.label, 40), summary: clip(p.summary, 200) })),
  };
}

/** The value a cite points at, read from the facts (never from the model's text). */
export function citeValue(facts: Facts, c: Cite): string | null {
  const day = String(c.day);
  if (c.metric === "co2") return facts.cabin?.daily_mean[day] ? `${facts.cabin.daily_mean[day]} ppm` : null;
  if (c.metric === "headache") return facts.checkins.find((x) => x.day === c.day)?.headache ?? null;
  const m = facts.metrics.find((x) => x.key === c.metric);
  return m?.values[day] ? `${m.values[day]} ${m.unit}` : null;
}

export function citeLabel(c: Cite): string {
  if (c.metric === "co2") return "Cabin CO2";
  if (c.metric === "headache") return "Headache";
  return INDICATORS[c.metric]?.label ?? c.metric;
}
