/**
 * MOCK ONLY: implements ApiClient in the browser so the whole demo path runs
 * before the backend exists. Same shapes as the planned API.
 *
 * Open record (D3, D4): astronaut and ground views come from ONE function,
 * buildRecord(). The only difference is the simulated ground link:
 *  - ground sees the astronaut's data as of the last sync;
 *  - the astronaut sees what ground writes once the next sync carries it up.
 * Nothing is filtered by role otherwise. There is no ground-only field.
 */
import type { ApiClient } from "../api/client";
import type {
  Brief,
  CabinData,
  CrewId,
  CrewSummary,
  InboxItem,
  Mission,
  Perspective,
  PinRef,
  Readiness,
  RecordView,
  SyncItem,
} from "../api/types";
import { INDICATORS } from "../content/indicators";
import { CO2_LIMIT, LINK_WINDOW_HOURS } from "../content/sources";
import { OSD569 } from "../content/osd569";
import { dayOf, iso, loadDb, nextId, nowMs, saveDb, type DB } from "./db";
import { buildIndicators, buildReadout, co2DailyMean, co2Usual, maybeAlert, pinItems, worstStatus } from "./logic";
import { ME, seedDb } from "./seed";

const LATENCY_MS = 90;
const ONE_WAY_DELAY_SEC = 2;

const wait = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), LATENCY_MS));

function asOfFor(db: DB, perspective: Perspective): number {
  return perspective === "ground" ? db.lastSync : nowMs(db);
}

/** Visibility rule of the simulated link, applied the same way to every record type. */
function visible(db: DB, perspective: Perspective) {
  return {
    fromCrew: (syncedAt: string | null) => perspective === "astronaut" || syncedAt != null,
    fromGround: (deliveredAt: string | null) => perspective === "ground" || (deliveredAt != null && Date.parse(deliveredAt) <= nowMs(db)),
  };
}

function briefStatus(db: DB, b: Brief, perspective: Perspective): Brief["status"] {
  const v = visible(db, perspective);
  const replies = db.replies.filter((r) => r.briefId === b.id && v.fromGround(r.deliveredAt));
  if (replies.length) return "answered";
  return b.syncedAt ? "delivered" : "queued";
}

function buildRecord(db: DB, crewId: CrewId, perspective: Perspective): RecordView {
  const asOf = asOfFor(db, perspective);
  const v = visible(db, perspective);
  const day = dayOf(db, asOf);
  const member = db.crew.find((c) => c.id === crewId)!;

  const checkIns = db.checkIns.filter((c) => c.crewId === crewId && v.fromCrew(c.syncedAt));
  const alerts = db.alerts
    .filter((a) => a.crewId === crewId && v.fromCrew(a.syncedAt))
    // A close that happened after the last sync has not reached ground yet.
    .map((a) =>
      perspective === "ground" && a.state === "closed" && a.closedAt && Date.parse(a.closedAt) > db.lastSync
        ? { ...a, state: "open" as const, closedReason: undefined, closedAt: undefined }
        : a,
    );
  const alert = [...alerts].reverse().find((a) => a.state !== "closed" || a.day === day) ?? null;
  const indicators = buildIndicators(db, crewId, asOf);
  const checkInDone = checkIns.some((c) => c.day === day);
  const { readout, worth } = buildReadout(day, checkInDone, indicators, alert && alert.state !== "closed" ? alert : null);

  const briefs = db.briefs
    .filter((b) => b.crewId === crewId && v.fromCrew(b.syncedAt))
    .map((b) => ({ ...b, status: briefStatus(db, b, perspective) }));
  const replies = db.replies.filter((r) => r.crewId === crewId && v.fromGround(r.deliveredAt));
  const notes = db.notes.filter((n) => n.crewId === crewId && v.fromGround(n.deliveredAt));
  const flags = db.flags.filter((f) => f.crewId === crewId && v.fromGround(f.deliveredAt));
  const requests = db.requests.filter((r) => r.crewId === crewId && v.fromGround(r.deliveredAt));
  const symptoms = db.symptoms.filter((s) => s.crewId === crewId && v.fromCrew(s.syncedAt));

  const openAlert = alert && alert.state !== "closed" ? alert : null;
  const status = worstStatus([...(openAlert ? [openAlert.severity] : []), ...indicators.map((i) => i.status)]);
  const watchCount = indicators.filter((i) => i.status === "watch").length;
  const crew: CrewSummary = {
    id: member.id,
    name: member.name,
    shortName: member.shortName,
    initials: member.initials,
    role: member.role,
    status,
    statusText: openAlert ? "Alert open" : watchCount ? `${watchCount} worth checking` : "In usual range",
    openAlerts: openAlert ? 1 : 0,
    unansweredBriefs: briefs.filter((b) => b.status === "delivered").length,
    lastSync: iso(db.lastSync),
  };

  return {
    perspective,
    asOf: iso(asOf),
    readiness: readinessOf(crewId, status),
    crew,
    mission: mission(db),
    readout,
    indicators: indicators.map(({ change: _c, ...i }) => i),
    alert,
    worthChecking: worth,
    checkIns: checkIns.slice(-14),
    symptoms,
    briefs,
    replies,
    notes,
    flags,
    requests,
  };
}

/** Commander's view (S3): a level and a reason, no raw medical data. Same wording as the API. */
function readinessOf(crewId: CrewId, status: CrewSummary["status"]): Readiness {
  if (status === "learning") return { crewId, level: "learning", reason: "Learning their baseline" };
  if (status === "watch" || status === "act") return { crewId, level: "check", reason: "Something worth checking" };
  return { crewId, level: "ready", reason: "In their usual range" };
}

function mission(db: DB): Mission {
  const now = nowMs(db);
  return { name: db.missionName, environment: "station", day: dayOf(db, now), now: iso(now), module: db.module };
}

function pendingToGround(db: DB): SyncItem[] {
  const items: SyncItem[] = [];
  const name = (id: CrewId) => db.crew.find((c) => c.id === id)?.shortName ?? id;
  db.checkIns.filter((c) => !c.syncedAt).forEach((c) => items.push({ kind: "checkin", label: `Check-in, day ${c.day} (${name(c.crewId)})` }));
  db.symptoms.filter((s) => !s.syncedAt).forEach((s) => items.push({ kind: "symptom", label: `Symptom: ${s.symptom.toLowerCase()}, ${s.strength} (${name(s.crewId)})` }));
  db.alerts.filter((a) => !a.syncedAt).forEach((a) => items.push({ kind: "alert", label: `Alert: ${a.title}` }));
  db.alerts
    .filter((a) => a.syncedAt && a.closedAt && Date.parse(a.closedAt) > db.lastSync)
    .forEach((a) => items.push({ kind: "alert", label: `Alert closed: ${a.title}` }));
  db.briefs.filter((b) => !b.syncedAt).forEach((b) => items.push({ kind: "brief", label: `Consult brief: "${b.question}"` }));
  const manual = Object.entries(db.series).flatMap(([crewId, s]) =>
    Object.entries(s).flatMap(([k, pts]) => pts.filter((p) => p.source === "manual" && Date.parse(p.t) > db.lastSync).map(() => ({ crewId, k }))),
  );
  manual.forEach(({ crewId, k }) =>
    items.push({ kind: "measurement", label: `${INDICATORS[k as keyof typeof INDICATORS]?.label ?? k} reading (${name(crewId)})` }),
  );
  return items;
}

function pendingFromGround(db: DB): SyncItem[] {
  const metric = (k: string) => INDICATORS[k as keyof typeof INDICATORS]?.label ?? k;
  return [
    ...db.replies.filter((r) => !r.deliveredAt).map((r) => ({ kind: "reply" as const, label: `Reply from ${r.author.name}` })),
    ...db.notes
      .filter((n) => !n.deliveredAt)
      .map((n) => ({ kind: "note" as const, label: `Note on ${n.target.kind === "metric" ? metric(n.target.key) : n.target.kind === "cabin" ? "cabin CO2" : "the record"}` })),
    ...db.flags.filter((f) => !f.deliveredAt).map((f) => ({ kind: "flag" as const, label: `Watch flag: ${metric(f.metric)}` })),
    ...db.requests.filter((r) => !r.deliveredAt).map((r) => ({ kind: "request" as const, label: `Measurement request: ${metric(r.metric)}` })),
  ];
}

export function createMockApi(): ApiClient {
  let db = loadDb(seedDb);
  const commit = () => saveDb(db);
  const crewIds = () => db.crew.map((c) => c.id);

  return {
    mode: "mock",
    supports: { symptoms: true, standaloneMeasurements: true, pinEditing: true, replyAckOnServer: true },

    getMission: async () => wait(mission(db)),
    getReadiness: async () => wait(crewIds().map((id) => buildRecord(db, id, "ground").readiness!)),
    getCrew: async () => wait(crewIds().map((id) => buildRecord(db, id, "ground").crew)),
    getAstronautView: async (id) => wait(buildRecord(db, id, "astronaut")),
    getGroundView: async (id) => wait(buildRecord(db, id, "ground")),

    getSeries: async (id, metric, days) => {
      const now = nowMs(db);
      const from = now - days * 86_400_000;
      return wait((db.series[id]?.[metric] ?? []).filter((p) => Date.parse(p.t) > from && Date.parse(p.t) <= now));
    },

    getCabin: async (id, perspective) => {
      const asOf = asOfFor(db, perspective);
      const today = dayOf(db, asOf);
      const usual = co2Usual(db, id);
      const cis = db.checkIns.filter((c) => c.crewId === id && (perspective === "astronaut" || c.syncedAt));
      const headaches = cis.map((c) => ({ day: c.day, t: c.t, strength: c.headache ?? "none" }));
      const recentHead = cis.filter((c) => c.day >= today - 2 && c.headache && c.headache !== "none");
      const highDays = recentHead.filter((c) => (co2DailyMean(db, id, c.day, asOf) ?? 0) > usual.high);
      const data: CabinData = {
        module: db.module,
        co2: (db.series[id]?.co2 ?? []).filter((p) => Date.parse(p.t) <= asOf),
        usual,
        limit: { value: CO2_LIMIT.value, label: `${CO2_LIMIT.value.toLocaleString("en-US")} ppm`, source: CO2_LIMIT.source },
        headaches,
        pattern:
          recentHead.length >= 2 && highDays.length
            ? {
                found: true,
                text: `Headaches on ${recentHead.length} of the last 3 days, and CO2 in ${db.module} was above its usual level on ${highDays.length === recentHead.length ? "each of those days" : `${highDays.length} of them`}. A pattern to check, not a cause.`,
              }
            : recentHead.length
              ? { found: false, text: "One headache in the last 3 days. Not a pattern yet. The app keeps watching CO2 and your check-ins." }
              : null,
        days: 14,
      };
      return wait(data);
    },

    getOsd569: async () => wait(OSD569),

    postCheckIn: async (id, input) => {
      const now = nowMs(db);
      const day = dayOf(db, now);
      let answers = input;
      if (input.sameAsYesterday) {
        const prev = [...db.checkIns].reverse().find((c) => c.crewId === id && c.day < day);
        answers = { sameAsYesterday: true, rested: prev?.rested ?? null, headache: prev?.headache ?? null, mood: prev?.mood ?? null, vision: prev?.vision ?? null };
      }
      // Replace an earlier check-in from today, if any (re-doing it is allowed).
      db.checkIns = db.checkIns.filter((c) => !(c.crewId === id && c.day === day && !c.syncedAt));
      const ci = { ...answers, id: nextId(db, "ci"), crewId: id, t: iso(now), day, source: "checkin" as const, syncedAt: null };
      db.checkIns.push(ci);
      if (ci.mood != null) {
        db.series[id].mood = db.series[id].mood.filter((p) => dayOf(db, p.t) !== day);
        db.series[id].mood.push({ t: ci.t, v: ci.mood, source: "checkin" });
      }
      const alert = maybeAlert(db, id, ci, now, nextId(db, "al"));
      if (alert) db.alerts.push(alert);
      commit();
      const rec = buildRecord(db, id, "astronaut");
      return wait({ checkIn: ci, readout: rec.readout, alert: rec.alert });
    },

    postMeasurement: async (id, input) => {
      const now = nowMs(db);
      const pts = db.series[id][input.metric];
      pts.push({ t: iso(now), v: input.v, v2: input.v2, source: "manual" });
      db.requests.filter((r) => r.crewId === id && r.metric === input.metric && !r.doneAt && r.deliveredAt).forEach((r) => (r.doneAt = iso(now)));
      commit();
      const ind = buildRecord(db, id, "astronaut").indicators.find((i) => i.key === input.metric)!;
      return wait(ind);
    },

    postSymptom: async (id, input) => {
      const now = nowMs(db);
      const log = { ...input, id: nextId(db, "sx"), crewId: id, t: iso(now), day: dayOf(db, now), syncedAt: null };
      db.symptoms.push(log);
      commit();
      return wait(log);
    },

    closeAlert: async (alertId) => {
      const a = db.alerts.find((x) => x.id === alertId);
      if (!a) throw new Error("Alert not found");
      a.state = "closed";
      a.closedReason = "Closed by you";
      a.closedAt = iso(nowMs(db)); // ground keeps seeing it open until the next link carries this change
      commit();
      return wait(a);
    },

    draftBrief: async (id, alertId) => {
      const now = nowMs(db);
      const alert = alertId ? db.alerts.find((a) => a.id === alertId) : null;
      let refs: PinRef[] = alert?.related ?? [];
      if (!refs.length) {
        refs = buildIndicators(db, id, now)
          .filter((i) => i.status === "watch")
          .map((i) => ({ kind: "metric", key: i.key }) as PinRef);
      }
      return wait({
        question: alert ? "Is this pattern something to watch, or should I change anything?" : "Is there anything here you would like me to keep an eye on?",
        pinned: pinItems(db, id, refs, now),
        alertId: alert?.id ?? null,
      });
    },

    createBrief: async (id, draft) => {
      const brief: Brief = {
        id: nextId(db, "br"),
        crewId: id,
        createdAt: iso(nowMs(db)),
        question: draft.question.trim(),
        pinned: draft.pinned,
        alertId: draft.alertId,
        status: "queued",
        syncedAt: null,
      };
      db.briefs.push(brief);
      commit();
      return wait(brief);
    },

    ackReply: async (replyId, ack) => {
      const r = db.replies.find((x) => x.id === replyId);
      if (!r) throw new Error("Reply not found");
      r.ack = ack;
      commit();
      return wait(r);
    },

    getInbox: async () => {
      const items: InboxItem[] = [];
      for (const id of crewIds()) {
        const rec = buildRecord(db, id, "ground");
        rec.briefs.filter((b) => b.status === "delivered").forEach((b) => items.push({ kind: "brief", crew: rec.crew, brief: b }));
      }
      for (const id of crewIds()) {
        const rec = buildRecord(db, id, "ground");
        if (rec.alert && rec.alert.state !== "closed") items.push({ kind: "alert", crew: rec.crew, alert: rec.alert });
      }
      return wait(items);
    },

    postReply: async (briefId, text) => {
      const brief = db.briefs.find((b) => b.id === briefId);
      if (!brief) throw new Error("Brief not found");
      const reply = { id: nextId(db, "rp"), briefId, crewId: brief.crewId, author: db.surgeon, createdAt: iso(nowMs(db)), text: text.trim(), deliveredAt: null, ack: null };
      db.replies.push(reply);
      commit();
      return wait(reply);
    },

    postNote: async (id, target, text) => {
      const note = { id: nextId(db, "nt"), crewId: id, target, author: db.surgeon, createdAt: iso(nowMs(db)), text: text.trim(), deliveredAt: null };
      db.notes.push(note);
      commit();
      return wait(note);
    },

    postFlag: async (id, metric, reason) => {
      const flag = { id: nextId(db, "fl"), crewId: id, metric, reason: reason.trim(), author: db.surgeon, createdAt: iso(nowMs(db)), deliveredAt: null, active: true };
      db.flags.push(flag);
      commit();
      return wait(flag);
    },

    postRequest: async (id, metric, reason) => {
      const req = { id: nextId(db, "rq"), crewId: id, metric, reason: reason.trim(), author: db.surgeon, createdAt: iso(nowMs(db)), deliveredAt: null, doneAt: null };
      db.requests.push(req);
      commit();
      return wait(req);
    },

    getLink: async () => {
      const lastSync = db.lastSync;
      return wait({
        lastSync: iso(lastSync),
        lastSyncDay: dayOf(db, lastSync),
        nextWindow: iso(lastSync + LINK_WINDOW_HOURS.value * 3_600_000),
        oneWayDelaySec: ONE_WAY_DELAY_SEC,
        pendingToGround: pendingToGround(db).length,
        pendingFromGround: pendingFromGround(db).length,
      });
    },

    getLinkLog: async () => wait([...db.syncLog].reverse()),

    syncNow: async () => {
      const now = nowMs(db);
      const toGround: SyncItem[] = [{ kind: "record", label: `Passive data since ${new Date(db.lastSync).toISOString().slice(11, 16)} GMT (3 crew)` }, ...pendingToGround(db)];
      const fromGround = pendingFromGround(db);
      const stamp = iso(now);
      db.checkIns.forEach((c) => (c.syncedAt ??= stamp));
      db.symptoms.forEach((s) => (s.syncedAt ??= stamp));
      db.alerts.forEach((a) => (a.syncedAt ??= stamp));
      db.briefs.forEach((b) => (b.syncedAt ??= stamp));
      db.replies.forEach((r) => (r.deliveredAt ??= stamp));
      db.notes.forEach((n) => (n.deliveredAt ??= stamp));
      db.flags.forEach((f) => (f.deliveredAt ??= stamp));
      db.requests.forEach((r) => (r.deliveredAt ??= stamp));
      db.lastSync = now;
      const entry = { id: nextId(db, "sy"), t: stamp, day: dayOf(db, now), toGround, fromGround };
      db.syncLog.push(entry);
      commit();
      return wait(entry);
    },

    resetDemo: async () => {
      db = seedDb();
      commit();
      return wait(undefined);
    },
  };
}

export const MOCK_ME = ME;
