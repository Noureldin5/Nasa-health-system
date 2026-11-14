/**
 * HTTP client for the FastAPI backend (role B), written as an adapter: it maps
 * the API's shapes (api/schemas.py, api/openapi.json) onto the view models the
 * screens use (./types.ts), so no screen changes when we switch from mocks.
 *
 * Gaps between the API and the UI are handled here and listed in web/README.md
 * ("Gaps for the backend"). Search this file for "GAP" to find each one.
 */
import type { ApiClient } from "./client";
import type {
  Alert,
  Baseline,
  Brief,
  BriefDraft,
  CabinData,
  CheckIn,
  CheckInResult,
  CrewId,
  CrewSummary,
  Flag,
  Indicator,
  InboxItem,
  LinkState,
  MeasurementRequest,
  MetricKey,
  Mission,
  Note,
  NoteTarget,
  Osd569Reference,
  PinnedItem,
  PinRef,
  Point,
  Readiness,
  Readout,
  RecordView,
  Reply,
  SeriesKey,
  Status,
  SyncEntry,
  SyncItem,
  WorthChecking,
} from "./types";
import { INDICATORS, METRIC_ORDER } from "../content/indicators";
import { OSD569 } from "../content/osd569";
import { CO2_LIMIT, LINK_WINDOW_HOURS } from "../content/sources";

/* ---------- Backend shapes (subset of api/schemas.py) ---------- */

type BKey = "bp_systolic" | "bp_diastolic" | "heart_rate" | "glucose" | "body_temp" | "sleep_hours" | "mood" | "headache" | "co2";
type BStatus = "learning" | "in_range" | "worth_checking" | "contact_surgeon" | "unavailable";
interface BBand { low: number; high: number; mean: number; demo_parameter: boolean }
interface BIndicator { key: BKey; value: number | null; unit: string; status: BStatus; baseline: BBand | null; calibration_day: number | null; source: "sim" | "nasa" }
interface BItemRef { indicator: BKey; start: string; end: string }
interface BAlert { id: string; crew_id: string; indicator: BKey; what_changed: string; next_step: string; contact_if: string; related_items: BItemRef[]; severity: number; state: "open" | "closed"; opened_at: string; closed_at: string | null }
interface BCheckinIn { same_as_yesterday: boolean; rested: number | null; headache: "none" | "mild" | "moderate" | "strong" | null; mood: number | null; vision_change: boolean | null; bp_systolic: number | null; bp_diastolic: number | null; glucose: number | null; body_temp: number | null }
interface BCheckinEntry { day: string; at: string; answers: BCheckinIn }
interface BBrief { id: string; crew_id: string; alert_id: string | null; question: string; pinned_items: BItemRef[]; state: "queued" | "sent" | "answered"; created_at: string; sent_at: string | null }
interface BReply { id: string; brief_id: string; author: string; text: string; created_at: string; delivered_at: string | null }
interface BNote { id: string; crew_id: string; kind: "note" | "watch_flag" | "measurement_request"; target: BKey | null; text: string; reason: string | null; author: string; created_at: string; delivered_at: string | null }
interface BReadiness { crew_id: string; readiness: "ready" | "check" | "learning"; reason: string }
interface BView { crew_id: string; side: "station" | "ground"; as_of: string; indicators: BIndicator[]; alert: BAlert | null; worth_checking: BAlert[]; checkins: BCheckinEntry[]; briefs: BBrief[]; replies: BReply[]; notes: BNote[]; readiness: BReadiness | null; last_sync_at: string | null }
interface BReadout { overall: BStatus; headline: string; tip: string; alert: BAlert | null }
interface BSeries { points: { at: string; value: number; source: "sim" | "nasa" }[] }
interface BCrewRow { crew_id: string; name: string; status: BStatus; open_alerts: number; unanswered_briefs: number; last_sync_at: string | null }
interface BInbox { kind: "brief" | "alert"; crew_id: string; at: string; brief: BBrief | null; alert: BAlert | null }
interface BSync { id: string; at: string; up: Record<string, number>; down: Record<string, number>; item_ids: string[] }
interface BOsd { dataset_id: string; url: string; label: string; placeholder: boolean; indicators: { indicator: string; value: number | null; range_min: number | null; range_max: number | null; unit: string }[] }

/* ---------- Mapping tables ---------- */

const SERIES_KEYS: Record<MetricKey, BKey[]> = {
  bp: ["bp_systolic", "bp_diastolic"],
  hr: ["heart_rate"],
  glucose: ["glucose"],
  temp: ["body_temp"],
  sleep: ["sleep_hours"],
  mood: ["mood"],
};
const TO_METRIC: Partial<Record<BKey, MetricKey>> = {
  bp_systolic: "bp",
  bp_diastolic: "bp",
  heart_rate: "hr",
  glucose: "glucose",
  body_temp: "temp",
  sleep_hours: "sleep",
  mood: "mood",
};
const STATUS: Record<BStatus, Status> = {
  in_range: "ok",
  worth_checking: "watch",
  contact_surgeon: "act",
  learning: "learning",
  unavailable: "nodata",
};
const RANK: Record<Status, number> = { act: 4, watch: 3, ok: 2, learning: 1, nodata: 0 };
const worst = (a: Status[]) => a.reduce<Status>((w, s) => (RANK[s] > RANK[w] ? s : w), "nodata");

/** The ground persona that signs notes and replies in the demo. */
const SURGEON = "Dr. Elena Ruiz";
/** GAP: the API has no module per crew in its responses yet. B's seed maps a1 and a2 to node1. */
const MODULE = "Node 1";
const ONE_WAY_DELAY_SEC = 2; // Demo parameter, as in the mock.

/** GAP: timestamps come without a zone; they are UTC (api/clock.py). Parse them as UTC, never local time. */
const utc = (s: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
const ms = (s: string) => Date.parse(utc(s));
const isoOf = (s: string) => new Date(ms(s)).toISOString();
const DAY = 86_400_000;
const dateMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

function labelOf(k: BKey): string {
  const m = TO_METRIC[k];
  if (m) return INDICATORS[m].label;
  return k === "co2" ? "Cabin CO2" : "Headache";
}

function pinRefOf(k: BKey): PinRef {
  if (k === "headache") return { kind: "symptom", key: "headache" };
  if (k === "co2") return { kind: "cabin", key: "co2" };
  return { kind: "metric", key: TO_METRIC[k]! };
}

function toBKey(target: NoteTarget | MetricKey): BKey | null {
  if (typeof target === "string") return SERIES_KEYS[target][0];
  if (target.kind === "record") return null;
  if (target.kind === "cabin") return "co2";
  return SERIES_KEYS[target.key][0];
}

export function createHttpApi(base: string): ApiClient {
  const url = (path: string) => `${base.replace(/\/$/, "")}${path}`;

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(url(path));
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }
  async function post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify((await res.json()).detail);
      } catch {
        /* no body */
      }
      throw new Error(`POST ${path} failed: ${res.status} ${detail}`);
    }
    return (await res.json()) as T;
  }

  /* ---------- Mission clock ---------- */

  /**
   * GAP: the API does not expose the mission day (docs/DECISIONS.md section 4,
   * OPEN 1). Until B adds GET /mission, day 1 is the date of the earliest
   * check-in in the record, which is how POST /demo/reset seeds the story.
   */
  let missionStart: number | null = null;
  async function missionFrom(view?: BView): Promise<Mission> {
    const v = view ?? (await get<BView>("/astronaut/a1/view"));
    const dates = v.checkins.map((c) => dateMs(c.day));
    const nowMs = ms(v.as_of);
    if (dates.length) missionStart = Math.min(...dates);
    const start = missionStart ?? Math.floor(nowMs / DAY) * DAY;
    return {
      name: "Expedition KPS-1",
      environment: "station",
      day: Math.floor((nowMs - start) / DAY) + 1,
      now: new Date(nowMs).toISOString(),
      module: MODULE,
    };
  }
  const missionDay = (t: number, m: Mission) => m.day - (Math.floor(Date.parse(m.now) / DAY) - Math.floor(t / DAY));

  /* ---------- Reply "done", kept in this browser (GAP: no API field) ---------- */

  const ACK_KEY = "oyb-reply-ack";
  const readAcks = (): Record<string, "done" | "follow-up"> => {
    try {
      return JSON.parse(localStorage.getItem(ACK_KEY) ?? "{}");
    } catch {
      return {};
    }
  };

  /* ---------- Crew ---------- */

  function crewSummary(r: BCrewRow): CrewSummary {
    const clean = r.name.replace(/\s*\(simulated\)\s*/i, "").trim();
    const initials = clean
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const status = STATUS[r.status];
    return {
      id: r.crew_id,
      name: clean,
      shortName: clean,
      initials: initials || r.crew_id.toUpperCase(),
      role: "Crew member · simulated",
      status,
      statusText: r.open_alerts ? "Alert open" : status === "watch" ? "Worth checking" : status === "act" ? "Contact the flight surgeon" : status === "learning" ? "Learning baseline" : "In usual range",
      openAlerts: r.open_alerts,
      unansweredBriefs: r.unanswered_briefs,
      lastSync: r.last_sync_at ? isoOf(r.last_sync_at) : new Date(0).toISOString(),
    };
  }
  const getCrew = async () => (await get<BCrewRow[]>("/crew")).map(crewSummary);

  /* ---------- Record ---------- */

  async function seriesOf(id: CrewId, key: BKey, days: number, until: number | null): Promise<Point[]> {
    // GAP: /series is astronaut-side only. For the ground view we cut it at the last sync here.
    const s = await get<BSeries>(`/astronaut/${id}/series/${key}?days=${days}`);
    return s.points.filter((p) => until == null || ms(p.at) <= until).map((p) => ({ t: isoOf(p.at), v: p.value, source: p.source }));
  }

  function statusText(st: Status, ind: BIndicator, latest: Point | null): string {
    if (st === "learning") return `Learning your baseline: day ${ind.calibration_day ?? "?"} of 7`;
    if (st === "nodata") return "No reading available";
    if (st === "act") return "Contact the flight surgeon";
    if (st === "watch" && latest && ind.baseline) return latest.v < ind.baseline.low ? "Below your usual" : latest.v > ind.baseline.high ? "Above your usual" : "Worth checking";
    if (st === "watch") return "Worth checking";
    return "In your usual range";
  }

  function indicator(metric: MetricKey, inds: BIndicator[], series: Record<string, Point[]>): Indicator {
    const c = INDICATORS[metric];
    const keys = SERIES_KEYS[metric];
    const main = inds.find((i) => i.key === keys[0]);
    const second = keys[1] ? inds.find((i) => i.key === keys[1]) : undefined;
    let pts = series[keys[0]] ?? [];
    if (metric === "bp") {
      // Join systolic and diastolic readings by day into one point with v and v2.
      const dia = new Map((series[keys[1]] ?? []).map((p) => [p.t.slice(0, 10), p.v]));
      pts = pts.map((p) => ({ ...p, v2: dia.get(p.t.slice(0, 10)) }));
    }
    const latest = pts.length ? pts[pts.length - 1] : null;
    const status = main ? worst([STATUS[main.status], ...(second ? [STATUS[second.status]] : [])]) : "nodata";
    const b = main?.baseline;
    const baseline: Baseline = b
      ? {
          state: status === "learning" ? "learning" : "ready",
          day: main?.calibration_day ?? undefined,
          of: 7,
          low: b.low,
          high: b.high,
          mean: b.mean,
          low2: second?.baseline?.low,
          high2: second?.baseline?.high,
          n: pts.length,
          method: "From the API: mean plus or minus 2 standard deviations of the days before the 3-day drift window. Demo parameter.",
        }
      : { state: "learning", day: main?.calibration_day ?? 1, of: 7, low: NaN, high: NaN, mean: NaN, n: 0, method: "Learning: the API needs 7 days with data." };
    return {
      key: metric,
      label: c.label,
      unit: c.unit,
      latest,
      status,
      statusText: main ? statusText(status, main, latest) : "No reading available",
      baseline,
      series: pts,
      cadence: c.cadence,
      source: main?.source ?? "sim",
    };
  }

  function alertOf(a: BAlert, m: Mission, inds: BIndicator[], lastSync: number | null): Alert {
    const ind = inds.find((i) => i.key === a.indicator);
    return {
      id: a.id,
      crewId: a.crew_id,
      createdAt: isoOf(a.opened_at),
      day: missionDay(ms(a.opened_at), m),
      severity: ind?.status === "contact_surgeon" ? "act" : "watch",
      title: firstSentence(a.what_changed).replace(/\.$/, ""),
      whatChanged: a.what_changed,
      nextStep: a.next_step,
      // The API sentence already starts with the label the UI prints above it.
      contactIf: a.contact_if.replace(/^contact the flight surgeon if\s*/i, ""),
      related: a.related_items.map((r) => pinRefOf(r.indicator)),
      state: a.state,
      closedAt: a.closed_at ? isoOf(a.closed_at) : undefined,
      closedReason: a.closed_at ? "Closed" : undefined,
      syncedAt: lastSync != null && ms(a.opened_at) <= lastSync ? new Date(lastSync).toISOString() : null,
    };
  }

  function pinnedOf(r: BItemRef, m: Mission): PinnedItem {
    const d1 = missionDay(dateMs(r.start), m);
    const d2 = missionDay(dateMs(r.end), m);
    return { ref: pinRefOf(r.indicator), label: labelOf(r.indicator), summary: d1 === d2 ? `Day ${d1}` : `Days ${d1} to ${d2}` };
  }

  function checkInOf(c: BCheckinEntry, crewId: CrewId, m: Mission, lastSync: number | null): CheckIn {
    const a = c.answers;
    return {
      id: `ci-${crewId}-${c.day}`,
      crewId,
      t: isoOf(c.at),
      day: missionDay(dateMs(c.day), m),
      sameAsYesterday: a.same_as_yesterday,
      rested: a.rested as CheckIn["rested"],
      headache: a.headache,
      mood: a.mood as CheckIn["mood"],
      vision: a.vision_change == null ? null : a.vision_change ? "yes" : "no",
      source: "checkin",
      syncedAt: lastSync != null && ms(c.at) <= lastSync ? new Date(lastSync).toISOString() : null,
    };
  }

  function readoutFrom(v: BView, m: Mission, indicators: Indicator[], alert: Alert | null, checkInDone: boolean, server?: BReadout): Readout {
    if (server) {
      return {
        day: m.day,
        checkInDone,
        status: STATUS[server.overall],
        headline: server.headline,
        change: server.alert ? firstSentence(server.alert.what_changed) : v.worth_checking[0] ? firstSentence(v.worth_checking[0].what_changed) : null,
        tip: server.tip,
      };
    }
    // Ground side: the API has no readout as of the last sync, so it is built from the same view.
    const open = alert && alert.state !== "closed" ? alert : null;
    const watch = indicators.filter((i) => i.status === "watch" || i.status === "act");
    return {
      day: m.day,
      checkInDone,
      status: open ? open.severity : watch.length ? "watch" : "ok",
      headline: open ? "1 thing worth checking" : watch.length ? `${watch.length} thing${watch.length > 1 ? "s" : ""} worth checking` : "All in the usual range",
      change: open ? open.title : watch[0] ? `${watch[0].label}: ${watch[0].statusText.toLowerCase()}` : null,
      tip: open ? open.nextStep : null,
    };
  }

  async function buildRecord(id: CrewId, side: "station" | "ground"): Promise<RecordView> {
    const path = side === "station" ? `/astronaut/${id}/view` : `/ground/${id}/view`;
    const [v, crewRows, readout] = await Promise.all([
      get<BView>(path),
      get<BCrewRow[]>("/crew"),
      side === "station" ? get<BReadout>(`/astronaut/${id}/readout`) : Promise.resolve(undefined),
    ]);
    const m = await missionFrom(side === "station" && id === "a1" ? v : undefined);
    const lastSync = v.last_sync_at ? ms(v.last_sync_at) : null;
    const until = side === "ground" ? lastSync : null;
    const keys = [...new Set(METRIC_ORDER.flatMap((k) => SERIES_KEYS[k]))];
    const seriesList = await Promise.all(keys.map((k) => seriesOf(id, k, 14, until)));
    const series = Object.fromEntries(keys.map((k, i) => [k, seriesList[i]]));
    const indicators = METRIC_ORDER.map((k) => indicator(k, v.indicators, series));
    const alert = v.alert ? alertOf(v.alert, m, v.indicators, lastSync) : null;
    const today = new Date(ms(v.as_of)).toISOString().slice(0, 10);
    const checkInDone = v.checkins.some((c) => c.day === today);
    const acks = readAcks();
    const row = crewRows.find((r) => r.crew_id === id);

    const notes: Note[] = [];
    const flags: Flag[] = [];
    const requests: MeasurementRequest[] = [];
    for (const n of v.notes) {
      const author = { id: n.author, name: n.author, role: "Flight surgeon" };
      const metric = n.target ? TO_METRIC[n.target] : undefined;
      const common = { id: n.id, crewId: n.crew_id, author, createdAt: isoOf(n.created_at), deliveredAt: n.delivered_at ? isoOf(n.delivered_at) : null };
      if (n.kind === "watch_flag" && metric) flags.push({ ...common, metric, reason: n.reason ?? n.text, active: true });
      else if (n.kind === "measurement_request" && metric) requests.push({ ...common, metric, reason: n.reason ?? n.text, doneAt: null });
      else {
        const target: NoteTarget = metric ? { kind: "metric", key: metric } : n.target === "co2" ? { kind: "cabin" } : { kind: "record" };
        notes.push({ ...common, target, text: n.kind === "note" ? n.text : `${n.text}${n.reason ? ` (${n.reason})` : ""}` });
      }
    }

    const worth: WorthChecking[] = v.worth_checking.map((a) => ({
      id: a.id,
      title: `${labelOf(a.indicator)}: worth checking`,
      detail: a.what_changed,
      ref: pinRefOf(a.indicator),
    }));

    return {
      perspective: side === "station" ? "astronaut" : "ground",
      asOf: isoOf(v.as_of),
      crew: row ? crewSummary(row) : crewSummary({ crew_id: id, name: id, status: "unavailable", open_alerts: 0, unanswered_briefs: 0, last_sync_at: v.last_sync_at }),
      mission: m,
      readout: readoutFrom(v, m, indicators, alert, checkInDone, readout),
      indicators,
      alert,
      worthChecking: worth,
      checkIns: v.checkins.map((c) => checkInOf(c, id, m, lastSync)),
      symptoms: [], // GAP: no symptom log in the API
      briefs: v.briefs.map((b) => briefOf(b, m)),
      replies: v.replies.map((r) => replyOf(r, id, acks)),
      notes,
      flags,
      requests,
      readiness: v.readiness ? { crewId: v.readiness.crew_id, level: v.readiness.readiness, reason: v.readiness.reason } : null,
    };
  }

  function briefOf(b: BBrief, m: Mission): Brief {
    return {
      id: b.id,
      crewId: b.crew_id,
      createdAt: isoOf(b.created_at),
      question: b.question,
      pinned: b.pinned_items.map((p) => pinnedOf(p, m)),
      alertId: b.alert_id,
      status: b.state === "sent" ? "delivered" : b.state,
      syncedAt: b.sent_at ? isoOf(b.sent_at) : null,
    };
  }

  function replyOf(r: BReply, crewId: CrewId, acks: Record<string, "done" | "follow-up">): Reply {
    return {
      id: r.id,
      briefId: r.brief_id,
      crewId,
      author: { id: r.author, name: r.author, role: "Flight surgeon" },
      createdAt: isoOf(r.created_at),
      text: r.text,
      deliveredAt: r.delivered_at ? isoOf(r.delivered_at) : null,
      ack: acks[r.id] ?? null,
    };
  }

  function syncEntryOf(s: BSync, m: Mission): SyncEntry {
    const items = (d: Record<string, number>, kindOf: (k: string) => SyncItem["kind"]) =>
      Object.entries(d)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => ({ kind: kindOf(k), label: `${n} ${n === 1 ? k.replace(/s$/, "") : k}` }));
    const up = items(s.up, (k) => (k === "checkins" ? "checkin" : k === "briefs" ? "brief" : k === "alerts" ? "alert" : "record"));
    return {
      id: s.id,
      t: isoOf(s.at),
      day: missionDay(ms(s.at), m),
      toGround: up.length ? up : [{ kind: "record", label: "Record snapshot, nothing new" }],
      fromGround: items(s.down, (k) => (k === "replies" ? "reply" : "note")),
    };
  }

  /* ---------- Client ---------- */

  return {
    mode: "http",
    supports: { symptoms: false, standaloneMeasurements: false, pinEditing: false, replyAckOnServer: false },

    getMission: () => missionFrom(),
    getCrew,
    getAstronautView: (id) => buildRecord(id, "station"),
    getGroundView: (id) => buildRecord(id, "ground"),
    getSeries: async (id, metric: SeriesKey, days) => seriesOf(id, metric === "co2" ? "co2" : SERIES_KEYS[metric][0], days, null),
    getReadiness: async () => (await get<BReadiness[]>("/crew/readiness")).map((r): Readiness => ({ crewId: r.crew_id, level: r.readiness, reason: r.reason })),

    getCabin: async (id, perspective) => {
      const v = await get<BView>(perspective === "ground" ? `/ground/${id}/view` : `/astronaut/${id}/view`);
      const m = await missionFrom();
      const lastSync = v.last_sync_at ? ms(v.last_sync_at) : null;
      const co2 = await seriesOf(id, "co2", 14, perspective === "ground" ? lastSync : null);
      const ind = v.indicators.find((i) => i.key === "co2");
      const related = v.alert && (v.alert.indicator === "headache" || v.alert.related_items.some((r) => r.indicator === "co2")) ? v.alert : null;
      const data: CabinData = {
        module: MODULE,
        co2,
        usual: { low: ind?.baseline?.low ?? NaN, high: ind?.baseline?.high ?? NaN },
        limit: { value: CO2_LIMIT.value, label: `${CO2_LIMIT.value.toLocaleString("en-US")} ppm`, source: CO2_LIMIT.source },
        headaches: v.checkins.map((c) => ({ day: missionDay(dateMs(c.day), m), t: isoOf(c.at), strength: c.answers.headache ?? "none" })),
        pattern: related ? { found: true, text: related.what_changed } : null,
        days: 14,
      };
      return data;
    },

    getOsd569: async () => {
      const r = await get<BOsd>("/reference/osd569");
      // GAP: until role C's ETL lands, the API returns a placeholder. Show the bundled copy of the
      // real NASA file (src/content/osd569.ts, generated from the OSDR CSV, cited) so NASA data is
      // always visible (requirement M8). The card says where the numbers come from.
      if (r.placeholder || !r.indicators.length) return { ...OSD569, bundledCopy: true };
      // GAP: the API shape has one value and range per indicator, no per-crew time points.
      const out: Osd569Reference = {
        placeholder: r.placeholder || !r.indicators.length,
        datasetId: r.dataset_id,
        title: r.label,
        url: r.url,
        file: "data/processed/osd569.json",
        accessed: "",
        timepoints: ["Sample"],
        indicators: r.indicators.map((i) => ({
          key: i.indicator,
          label: i.indicator.replace(/_/g, " "),
          unit: i.unit,
          sourceColumn: i.indicator,
          earthRange: { min: i.range_min ?? NaN, max: i.range_max ?? NaN },
          samples: i.value == null ? [] : [{ crew: "Inspiration4", timepoint: "Sample", value: i.value }],
        })),
      };
      return out;
    },

    postCheckIn: async (id, input) => {
      const r = await post<BReadout>(`/astronaut/${id}/checkin`, {
        same_as_yesterday: input.sameAsYesterday,
        rested: input.rested,
        headache: input.headache,
        mood: input.mood,
        vision_change: input.vision == null ? null : input.vision === "yes",
      });
      const rec = await buildRecord(id, "station");
      const today = rec.checkIns[rec.checkIns.length - 1];
      return { checkIn: today, readout: rec.readout, alert: r.alert ? rec.alert : null } satisfies CheckInResult;
    },

    postMeasurement: async (id, input) => {
      // GAP: no measurement endpoint. CheckinIn carries bp, glucose and temperature, and the API
      // upserts the whole day, so we resend today's answers with the reading added.
      const v = await get<BView>(`/astronaut/${id}/view`);
      const today = new Date(ms(v.as_of)).toISOString().slice(0, 10);
      const entry = v.checkins.find((c) => c.day === today);
      if (!entry) throw new Error("Do today's check-in first. The API saves readings together with it.");
      if (input.metric === "bp" && input.v2 == null) throw new Error("Blood pressure needs both numbers.");
      const field: Record<string, number> =
        input.metric === "bp" ? { bp_systolic: input.v, bp_diastolic: input.v2! } : input.metric === "glucose" ? { glucose: input.v } : input.metric === "temp" ? { body_temp: input.v } : {};
      if (!Object.keys(field).length) throw new Error("This reading comes from the wearable, it cannot be typed in yet.");
      await post(`/astronaut/${id}/checkin`, { ...entry.answers, same_as_yesterday: false, ...field });
      const rec = await buildRecord(id, "station");
      return rec.indicators.find((i) => i.key === input.metric)!;
    },

    postSymptom: async () => {
      throw new Error("Symptom logging is not in the API yet.");
    },

    closeAlert: async (alertId) => {
      const a = await post<BAlert>(`/alerts/${alertId}/close`);
      const m = await missionFrom();
      return alertOf(a, m, [], null);
    },

    draftBrief: async (id, alertId) => {
      const d = await get<{ question_suggestion: string; pinned_items: BItemRef[]; alert_id: string | null }>(`/astronaut/${id}/briefs/draft`);
      const m = await missionFrom();
      const draft: BriefDraft = { question: d.question_suggestion, pinned: d.pinned_items.map((p) => pinnedOf(p, m)), alertId: d.alert_id ?? alertId };
      return draft;
    },

    createBrief: async (id, draft) => {
      const b = await post<BBrief>(`/astronaut/${id}/briefs`, { question: draft.question.trim(), alert_id: draft.alertId });
      return briefOf(b, await missionFrom());
    },

    ackReply: async (replyId, ack) => {
      const acks = readAcks();
      acks[replyId] = ack;
      try {
        localStorage.setItem(ACK_KEY, JSON.stringify(acks));
      } catch {
        /* storage blocked: the ack lasts for this page only */
      }
      return { id: replyId, briefId: "", crewId: "", author: { id: "", name: "", role: "" }, createdAt: "", text: "", deliveredAt: null, ack };
    },

    getInbox: async () => {
      const [items, crew] = await Promise.all([get<BInbox[]>("/ground/inbox"), get<BCrewRow[]>("/crew")]);
      const m = await missionFrom();
      return items.map((i): InboxItem => {
        const row = crew.find((c) => c.crew_id === i.crew_id)!;
        return {
          kind: i.kind,
          crew: crewSummary(row),
          brief: i.brief ? briefOf(i.brief, m) : undefined,
          alert: i.alert ? alertOf(i.alert, m, [], null) : undefined,
        };
      });
    },

    postReply: async (briefId, text) => {
      const r = await post<BReply>(`/briefs/${briefId}/reply`, { author: SURGEON, text: text.trim() });
      return replyOf(r, "", readAcks());
    },

    postNote: async (id, target, text) => {
      const n = await post<BNote>(`/ground/${id}/notes`, { kind: "note", target: toBKey(target), text: text.trim(), author: SURGEON });
      return { id: n.id, crewId: id, target, author: { id: SURGEON, name: SURGEON, role: "Flight surgeon" }, createdAt: isoOf(n.created_at), text: n.text, deliveredAt: null };
    },

    postFlag: async (id, metric, reason) => {
      const n = await post<BNote>(`/ground/${id}/notes`, { kind: "watch_flag", target: toBKey(metric), text: reason.trim(), reason: reason.trim(), author: SURGEON });
      return { id: n.id, crewId: id, metric, reason: n.reason ?? n.text, author: { id: SURGEON, name: SURGEON, role: "Flight surgeon" }, createdAt: isoOf(n.created_at), deliveredAt: null, active: true };
    },

    postRequest: async (id, metric, reason) => {
      const n = await post<BNote>(`/ground/${id}/notes`, { kind: "measurement_request", target: toBKey(metric), text: reason.trim(), reason: reason.trim(), author: SURGEON });
      return { id: n.id, crewId: id, metric, reason: n.reason ?? n.text, author: { id: SURGEON, name: SURGEON, role: "Flight surgeon" }, createdAt: isoOf(n.created_at), deliveredAt: null, doneAt: null };
    },

    getLink: async () => {
      // GAP: no link status endpoint. Pending counts are read from the views.
      const [astro, ground, log] = await Promise.all([
        get<BView>("/astronaut/a1/view"),
        get<BView>("/ground/a1/view"),
        get<BSync[]>("/link/log"),
      ]);
      const last = astro.last_sync_at ? ms(astro.last_sync_at) : log[0] ? ms(log[0].at) : Date.now();
      const m = await missionFrom(astro);
      const pendingUp =
        astro.briefs.filter((b) => b.state === "queued").length + astro.checkins.filter((c) => ms(c.at) > last).length + (astro.alert && ms(astro.alert.opened_at) > last ? 1 : 0);
      const pendingDown = ground.notes.filter((n) => !n.delivered_at).length + ground.replies.filter((r) => !r.delivered_at).length;
      const state: LinkState = {
        lastSync: new Date(last).toISOString(),
        lastSyncDay: missionDay(last, m),
        nextWindow: new Date(last + LINK_WINDOW_HOURS.value * 3_600_000).toISOString(),
        oneWayDelaySec: ONE_WAY_DELAY_SEC,
        pendingToGround: pendingUp,
        pendingFromGround: pendingDown,
      };
      return state;
    },

    getLinkLog: async () => {
      const [log, m] = await Promise.all([get<BSync[]>("/link/log"), missionFrom()]);
      return log.map((s) => syncEntryOf(s, m));
    },

    syncNow: async () => {
      const s = await post<BSync>("/link/sync");
      return syncEntryOf(s, await missionFrom());
    },

    resetDemo: async () => {
      await post("/demo/reset?day=10");
      missionStart = null;
      try {
        localStorage.removeItem(ACK_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
