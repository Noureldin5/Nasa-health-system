import type { RecordView, RegionKey, Status } from "../api/types";
import { INDICATORS } from "../content/indicators";
import { REGIONS } from "../content/regions";

const RANK: Record<Status, number> = { act: 4, watch: 3, ok: 2, learning: 1, nodata: 0 };

/** Status of a body region = worst of its indicators and today's symptoms. */
export function regionStatus(rec: RecordView, key: RegionKey): { status: Status; reason: string } {
  const region = REGIONS[key];
  const day = rec.readout.day;
  const parts: { status: Status; why: string }[] = [];

  for (const m of region.metrics) {
    const ind = rec.indicators.find((i) => i.key === m);
    if (ind) parts.push({ status: ind.status, why: INDICATORS[m].label.toLowerCase() });
  }
  if (key === "brain") {
    const today = rec.checkIns.find((c) => c.day === day);
    if (today?.headache && today.headache !== "none")
      parts.push({ status: today.headache === "strong" ? "act" : "watch", why: `${today.headache} headache` });
    if (today?.vision === "yes") parts.push({ status: "act", why: "vision change" });
  }
  for (const s of rec.symptoms.filter((x) => x.region === key && x.day === day)) {
    parts.push({ status: s.strength === "strong" ? "act" : "watch", why: `${s.symptom.toLowerCase()} logged` });
  }

  if (!parts.length) return { status: "nodata", reason: "Not tracked" };
  const worst = parts.reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a));
  if (worst.status === "ok") return { status: "ok", reason: "In your usual range" };
  if (worst.status === "learning") return { status: "learning", reason: "Learning your baseline" };
  const reasons = parts
    .filter((p) => p.status === worst.status)
    .map((p) => p.why)
    .join(", ");
  return { status: worst.status, reason: reasons.charAt(0).toUpperCase() + reasons.slice(1) };
}
