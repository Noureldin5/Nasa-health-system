import type { Mission } from "../api/types";
import type { DayTick } from "../components/charts";
import { fmtDayTime } from "./format";

const DAY = 86_400_000;

/** Time window and day ticks for the last `days` mission days, ending today (never before day 1). */
export function missionWindow(m: Mission, maxDays = 14) {
  const days = Math.max(1, Math.min(maxDays, m.day));
  const now = Date.parse(m.now);
  const end = Math.floor(now / DAY) * DAY + DAY;
  const start = end - days * DAY;
  const ticks: DayTick[] = Array.from({ length: days }, (_, i) => ({
    t: start + i * DAY + DAY / 2,
    label: `D${m.day - days + 1 + i}`,
  }));
  return { domain: [start, end] as [number, number], ticks, fmt: (t: number) => fmtDayTime(t, m) };
}
