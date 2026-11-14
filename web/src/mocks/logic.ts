/**
 * MOCK ONLY: placeholder health logic so the frontend demo reacts to input.
 * The real baseline, drift, alert and pinning logic belongs to role B
 * (api/domain/, tested pure functions). Do not port this file to the API;
 * replace it by calling the API (VITE_API_MODE=http).
 *
 * Every number below is a DEMO PARAMETER (project rule: a number without a source is labeled so).
 */
import type {
  Alert,
  Baseline,
  CheckIn,
  CrewId,
  Indicator,
  MetricKey,
  PinnedItem,
  PinRef,
  Point,
  Readout,
  Status,
  WorthChecking,
} from "../api/types";
import { INDICATORS, METRIC_ORDER } from "../content/indicators";
import { BASELINE_METHOD, CALIBRATION_DAYS } from "../content/sources";
import { dayOf, type DB } from "./db";

/** Minimum half-width of the usual band. Demo parameter. */
const MIN_HALF: Record<MetricKey | "co2", number> = { bp: 6, hr: 3, glucose: 8, temp: 0.3, sleep: 0.4, mood: 0.8, co2: 150 };
const MIN_HALF_DIASTOLIC = 5;
const PRIORITY: MetricKey[] = ["sleep", "hr", "mood", "bp", "temp", "glucose"];

function stats(vals: number[]) {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
  return { mean, sd };
}

function band(vals: number[], minHalf: number) {
  const { mean, sd } = stats(vals);
  const half = Math.max(2 * sd, minHalf);
  return { mean, low: mean - half, high: mean + half };
}

export function baselineFor(db: DB, metric: MetricKey | "co2", points: Point[], today: number): Baseline {
  const calDays = CALIBRATION_DAYS.value;
  const cal = points.filter((p) => dayOf(db, p.t) <= calDays);
  if (today <= calDays || cal.length < 3) {
    return { state: "learning", day: Math.min(today, calDays), of: calDays, low: NaN, high: NaN, mean: NaN, n: cal.length, method: BASELINE_METHOD };
  }
  const main = band(
    cal.map((p) => p.v),
    MIN_HALF[metric],
  );
  const base: Baseline = { state: "ready", ...main, n: cal.length, method: BASELINE_METHOD };
  if (metric === "bp") {
    const dia = band(
      cal.map((p) => p.v2 ?? 0),
      MIN_HALF_DIASTOLIC,
    );
    base.low2 = dia.low;
    base.high2 = dia.high;
  }
  return base;
}

function direction(p: Point, b: Baseline): "below" | "above" | null {
  if (p.v < b.low || (p.v2 != null && b.low2 != null && p.v2 < b.low2)) return "below";
  if (p.v > b.high || (p.v2 != null && b.high2 != null && p.v2 > b.high2)) return "above";
  return null;
}

export function assessIndicator(db: DB, metric: MetricKey, series: Point[], today: number): Indicator & { change: string | null } {
  const c = INDICATORS[metric];
  const baseline = baselineFor(db, metric, series, today);
  const latest = series.length ? series[series.length - 1] : null;
  let status: Status = "ok";
  let statusText = "In your usual range";
  let change: string | null = null;

  if (!latest) {
    status = "nodata";
    statusText = "No reading yet";
  } else if (baseline.state === "learning") {
    status = "learning";
    statusText = `Learning your baseline: day ${baseline.day} of ${baseline.of}`;
  } else {
    const dir = direction(latest, baseline);
    if (dir) {
      status = "watch";
      let streak = 0;
      for (let i = series.length - 1; i >= 0 && direction(series[i], baseline) === dir; i--) streak++;
      const unit = metric === "sleep" ? "nights" : c.cadence === "weekly" ? "readings" : "days";
      const word = dir === "below" ? "Below" : "Above";
      statusText = streak > 1 ? `${word} your usual for ${streak} ${unit}` : `${word} your usual ${c.cadence === "weekly" ? "in the latest reading" : "today"}`;
      const recent = series.slice(-streak).map((p) => p.v);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (metric === "sleep") change = `You slept ${(baseline.mean - avg).toFixed(1)} h less than your usual for ${streak} nights.`;
      else if (metric === "hr")
        change = `Resting heart rate is ${Math.round(Math.abs(avg - baseline.mean))} bpm ${dir} your usual for ${streak} days.`;
      else if (metric === "mood") change = "Mood is lower than your usual today.";
      else change = `Your latest ${c.label.toLowerCase()} reading is ${dir} your usual range.`;
    }
  }

  return {
    key: metric,
    label: c.label,
    unit: c.unit,
    latest,
    status,
    statusText,
    baseline,
    series,
    cadence: c.cadence,
    source: latest?.source ?? "sim",
    change,
  };
}

export function buildIndicators(db: DB, crewId: CrewId, asOf: number): (Indicator & { change: string | null })[] {
  const today = dayOf(db, asOf);
  const from = asOf - 14 * 86_400_000;
  return METRIC_ORDER.map((m) => {
    const pts = (db.series[crewId]?.[m] ?? []).filter((p) => {
      const t = Date.parse(p.t);
      return t <= asOf && t > from;
    });
    return assessIndicator(db, m, pts, today);
  });
}

export function co2Usual(db: DB, crewId: CrewId) {
  const pts = (db.series[crewId]?.co2 ?? []).filter((p) => dayOf(db, p.t) <= CALIBRATION_DAYS.value);
  const b = band(
    pts.map((p) => p.v),
    MIN_HALF.co2,
  );
  return { low: Math.round(b.low / 10) * 10, high: Math.round(b.high / 10) * 10 };
}

export function co2DailyMean(db: DB, crewId: CrewId, day: number, asOf: number): number | null {
  const pts = (db.series[crewId]?.co2 ?? []).filter((p) => dayOf(db, p.t) === day && Date.parse(p.t) <= asOf);
  if (!pts.length) return null;
  return pts.reduce((a, p) => a + p.v, 0) / pts.length;
}

export function buildReadout(
  day: number,
  checkInDone: boolean,
  indicators: (Indicator & { change: string | null })[],
  alert: Alert | null,
): { readout: Readout; worth: WorthChecking[] } {
  const watch = indicators
    .filter((i) => i.status === "watch" || i.status === "act")
    .sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
  const toWorth = (i: Indicator & { change: string | null }): WorthChecking => ({
    id: `wc-${i.key}`,
    title: `${i.label}: ${i.statusText.toLowerCase()}`,
    detail: i.change ?? i.statusText,
    ref: { kind: "metric", key: i.key },
  });

  if (alert && alert.state !== "closed" && alert.day === day) {
    return {
      readout: {
        day,
        checkInDone,
        status: alert.severity,
        headline: alert.severity === "act" ? "Contact your flight surgeon" : "1 thing worth checking",
        change: alert.title,
        tip: alert.nextStep,
      },
      worth: watch.map(toWorth),
    };
  }
  if (watch.length) {
    const top = watch[0];
    return {
      readout: {
        day,
        checkInDone,
        status: "watch",
        headline: watch.length === 1 ? "1 thing worth checking" : `${watch.length} things worth checking`,
        change: top.change,
        tip: INDICATORS[top.key].tip,
      },
      worth: watch.slice(1).map(toWorth),
    };
  }
  return {
    readout: {
      day,
      checkInDone,
      status: "ok",
      headline: "All in your usual range",
      change: null,
      tip: "Keep tonight's sleep slot at the usual time.",
    },
    worth: [],
  };
}

export function worstStatus(statuses: Status[]): Status {
  if (statuses.includes("act")) return "act";
  if (statuses.includes("watch")) return "watch";
  if (statuses.length && statuses.every((s) => s === "learning")) return "learning";
  if (statuses.length && statuses.every((s) => s === "nodata")) return "nodata";
  return "ok";
}

/** Placeholder alert rule. One alert per day at most (U4). */
export function maybeAlert(db: DB, crewId: CrewId, ci: CheckIn, asOf: number, id: string): Alert | null {
  if (db.alerts.some((a) => a.crewId === crewId && a.day === ci.day)) return null;
  const recent = db.checkIns.filter((c) => c.crewId === crewId && c.day >= ci.day - 2 && c.day <= ci.day);
  const headacheDays = recent.filter((c) => c.headache && c.headache !== "none");
  const usual = co2Usual(db, crewId);
  const co2High = headacheDays.filter((c) => (co2DailyMean(db, crewId, c.day, asOf) ?? 0) > usual.high);
  const base = { id, crewId, createdAt: new Date(asOf).toISOString(), day: ci.day, state: "open" as const, syncedAt: null };

  const vision = ci.vision === "yes";
  if (ci.headache === "strong" || vision) {
    const what = vision && ci.headache && ci.headache !== "none" ? "a headache with a change in vision" : vision ? "a change in vision" : "a strong headache";
    return {
      ...base,
      severity: "act",
      title: `You reported ${what} today`,
      whatChanged: `You reported ${what} in today's check-in.${co2High.length ? " Cabin CO2 in your module is also above its usual level." : ""}`,
      nextStep: "Rest in a quiet, well-ventilated module and send a consult brief now. The flight surgeon sees your full record.",
      contactIf: "now. A strong headache or a change in vision is on the list to raise with your flight surgeon.",
      related: [
        { kind: "symptom", key: "headache" },
        ...(vision ? [{ kind: "symptom", key: "vision" } as PinRef] : []),
        { kind: "cabin", key: "co2" },
      ],
    };
  }
  if (headacheDays.length >= 2) {
    const n = headacheDays.length;
    if (co2High.length) {
      return {
        ...base,
        severity: "watch",
        title: `Headaches on ${n} of the last 3 days, with cabin CO2 above your module's usual`,
        whatChanged: `Headaches on ${n} of the last 3 days. Cabin CO2 in ${db.module} was above its usual level on those days. This is a pattern to check, not a cause.`,
        nextStep: "Ask for a ventilation check and take your breaks in a better-ventilated module.",
        contactIf: "the headache is strong, or comes with vision changes.",
        related: [
          { kind: "symptom", key: "headache" },
          { kind: "cabin", key: "co2" },
          { kind: "metric", key: "sleep" },
        ],
      };
    }
    const sleepLow = buildIndicators(db, crewId, asOf).find((i) => i.key === "sleep")?.status === "watch";
    return {
      ...base,
      severity: "watch",
      title: `Headaches on ${n} of the last 3 days`,
      whatChanged: `Headaches on ${n} of the last 3 days.${sleepLow ? " Your sleep is also below your usual." : ""} A pattern to check, not a cause.`,
      nextStep: "Drink water, and note when the headaches start in the next check-in.",
      contactIf: "the headache is strong, or comes with vision changes.",
      related: [{ kind: "symptom", key: "headache" }, ...(sleepLow ? [{ kind: "metric", key: "sleep" } as PinRef] : [])],
    };
  }
  return null;
}

const fmtPpm = (v: number) => `${Math.round(v).toLocaleString("en-US")} ppm`;

export function pinItems(db: DB, crewId: CrewId, refs: PinRef[], asOf: number): PinnedItem[] {
  const today = dayOf(db, asOf);
  const inds = buildIndicators(db, crewId, asOf);
  return refs.map((ref): PinnedItem => {
    if (ref.kind === "metric") {
      const ind = inds.find((i) => i.key === ref.key)!;
      const c = INDICATORS[ref.key];
      const val = ind.latest ? `${ind.latest.v.toFixed(c.decimals)}${ind.latest.v2 != null ? `/${ind.latest.v2}` : ""} ${c.unit}` : "no reading";
      return { ref, label: c.label, summary: `Latest ${val}. ${ind.statusText}.` };
    }
    if (ref.kind === "symptom") {
      const cis = db.checkIns.filter((c) => c.crewId === crewId && c.day >= today - 2);
      if (ref.key === "vision") {
        const days = cis.filter((c) => c.vision === "yes").map((c) => `day ${c.day}`);
        return { ref, label: "Vision change", summary: days.length ? `Reported on ${days.join(", ")}.` : "None reported in the last 3 days." };
      }
      const days = cis.filter((c) => c.headache && c.headache !== "none").map((c) => `day ${c.day} ${c.headache}`);
      const text = days.join(", ");
      return { ref, label: "Headache", summary: days.length ? `${text.charAt(0).toUpperCase()}${text.slice(1)}.` : "None in the last 3 days." };
    }
    const usual = co2Usual(db, crewId);
    let peakDay = today;
    let peak = 0;
    for (let d = today - 2; d <= today; d++) {
      const m = co2DailyMean(db, crewId, d, asOf);
      if (m != null && m > peak) {
        peak = m;
        peakDay = d;
      }
    }
    return {
      ref,
      label: "Cabin CO2",
      summary: `Day ${peakDay} average ${fmtPpm(peak)}. Module usual ${fmtPpm(usual.low)} to ${fmtPpm(usual.high)}.`,
    };
  });
}
