import type { Indicator, MetricKey, Mission, Point } from "../api/types";
import { INDICATORS } from "../content/indicators";

const DAY = 86_400_000;

/** Station time is GMT, as on the ISS. */
export function fmtTime(isoOrMs: string | number): string {
  const d = new Date(isoOrMs);
  return d.toISOString().slice(11, 16);
}

function utcDay(ms: number) {
  return Math.floor(ms / DAY);
}

/** Mission day of a timestamp, given the current mission state. */
export function missionDayOf(t: string | number, mission: Mission): number {
  const ms = typeof t === "string" ? Date.parse(t) : t;
  return mission.day - (utcDay(Date.parse(mission.now)) - utcDay(ms));
}

export function fmtDayTime(t: string | number, mission: Mission): string {
  return `Day ${missionDayOf(t, mission)}, ${fmtTime(t)}`;
}

export function fmtAgo(t: string | number, mission: Mission): string {
  const ms = Date.parse(mission.now) - (typeof t === "string" ? Date.parse(t) : t);
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60 ? `${min % 60} min ` : ""}ago`;
  return fmtDayTime(t, mission);
}

export function fmtNum(v: number, decimals = 0): string {
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPoint(metric: MetricKey, p: Point | null): string {
  if (!p) return "–";
  const d = INDICATORS[metric].decimals;
  if (metric === "bp" && p.v2 != null) return `${fmtNum(p.v)}/${fmtNum(p.v2)}`;
  return fmtNum(p.v, d);
}

/** "Your usual 57–63 bpm" text for an indicator. */
export function fmtUsual(ind: Indicator): string | null {
  const b = ind.baseline;
  if (b.state !== "ready") return null;
  const d = INDICATORS[ind.key].decimals;
  if (ind.key === "bp" && b.low2 != null && b.high2 != null) {
    return `${fmtNum(b.low)}–${fmtNum(b.high)} / ${fmtNum(b.low2)}–${fmtNum(b.high2)}`;
  }
  if (ind.key === "mood") return `${fmtNum(Math.max(1, b.low), 1)}–${fmtNum(Math.min(5, b.high), 1)}`;
  return `${fmtNum(b.low, d)}–${fmtNum(b.high, d)}`;
}

export function sourceLabel(source: string): string {
  switch (source) {
    case "sim":
      return "Simulated";
    case "nasa":
      return "NASA OSDR";
    case "manual":
      return "Your entry";
    case "checkin":
      return "Check-in";
    default:
      return source;
  }
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
