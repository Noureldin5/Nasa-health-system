/**
 * MOCK ONLY. Deterministic 14-day simulated mission for 3 crew.
 * Every value here is SIMULATED (source "sim") and labeled so in the UI.
 * Role C's simulator (pipeline/simulator) replaces this with the same story:
 *   days 1-7  steady baseline (calibration)
 *   days 11-14 sleep-debt drift for M. Okafor (schedule shift on day 11)
 *   days 12-14 cabin CO2 rise in crew module A, mild headache on day 13
 *   day 14 (today) weekly measurement slot, check-in not done yet
 */
import type { CheckIn, CrewId, Point, SeriesKey, SyncItem } from "../api/types";
import { at, DAY_MS, DB, DB_VERSION, iso, todayUtc, type CrewMember } from "./db";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(rand: () => number, sd: number) {
  // Sum of uniforms, close enough to a normal for demo data.
  return (rand() + rand() + rand() - 1.5) * sd * 1.15;
}

const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

export const CREW: CrewMember[] = [
  { id: "a1", name: "Maya Okafor", shortName: "M. Okafor", initials: "MO", role: "Commander" },
  { id: "a2", name: "Daniyar Bekov", shortName: "D. Bekov", initials: "DB", role: "Flight engineer" },
  { id: "a3", name: "Aiko Tanaka", shortName: "A. Tanaka", initials: "AT", role: "Mission specialist" },
];

export const ME: CrewId = "a1";

const WEEKLY_DAYS = [1, 2, 3, 5, 7, 10];

interface Profile {
  sleep: number[];
  hr: number[];
  mood: (number | null)[];
  rested: (number | null)[];
  headacheDays: Record<number, "mild" | "moderate" | "strong">;
  bp: [number, number][];
  glucose: number[];
  temp: number[];
  co2Elevated: boolean;
  skipped: number[];
  checkedInToday: boolean;
}

function okaforProfile(): Profile {
  return {
    sleep: [6.9, 7.1, 6.8, 7.0, 6.7, 7.2, 6.9, 6.8, 7.0, 6.9, 5.7, 5.5, 5.6, 5.6],
    hr: [60, 59, 61, 60, 62, 59, 60, 61, 60, 61, 63, 65, 66, 67],
    mood: [4, 4, 5, 4, 4, null, 4, 4, 4, 4, 4, 4, 4],
    rested: [4, 4, 4, 4, 3, null, 4, 4, 4, 4, 3, 3, 2],
    headacheDays: { 13: "mild" },
    bp: [
      [114, 74],
      [116, 75],
      [113, 72],
      [117, 76],
      [115, 74],
      [116, 73],
    ],
    glucose: [92, 88, 94, 90, 91, 93],
    temp: [36.6, 36.7, 36.5, 36.6, 36.7, 36.6],
    co2Elevated: true,
    skipped: [6],
    checkedInToday: false,
  };
}

function genericProfile(seed: number, base: { sleep: number; hr: number; sys: number; dia: number; glu: number; temp: number }, sleepDrift: boolean, skipped: number[], checkedInToday: boolean): Profile {
  const rand = mulberry32(seed);
  const days = Array.from({ length: 14 }, (_, i) => i + 1);
  return {
    sleep: days.map((d) => round(base.sleep + noise(rand, 0.2) - (sleepDrift && d >= 12 ? 0.9 + (d - 12) * 0.1 : 0), 1)),
    hr: days.map((d) => round(base.hr + noise(rand, 1.2) + (sleepDrift && d >= 13 ? 1 : 0))),
    mood: days.slice(0, 13).map((d) => (skipped.includes(d) ? null : rand() > 0.8 ? 5 : 4)),
    rested: days.slice(0, 13).map((d) => (skipped.includes(d) ? null : sleepDrift && d >= 12 ? 3 : 4)),
    headacheDays: {},
    bp: WEEKLY_DAYS.map(() => [round(base.sys + noise(rand, 2.5)), round(base.dia + noise(rand, 2))] as [number, number]),
    glucose: WEEKLY_DAYS.map(() => round(base.glu + noise(rand, 3))),
    temp: WEEKLY_DAYS.map(() => round(base.temp + noise(rand, 0.1), 1)),
    co2Elevated: false,
    skipped,
    checkedInToday,
  };
}

function co2Series(db: DB, rand: () => number, elevated: boolean, until: number): Point[] {
  const pts: Point[] = [];
  // Above the module's usual band (about 2,100-2,600) but below the 3,500 ppm
  // demo limit: the story is "higher than your usual", not "over the limit".
  const elevatedByDay: Record<number, number[]> = {
    12: [2700, 2950, 3150, 3050],
    13: [3150, 3300, 3400, 3250],
    14: [3250, 3200, 3150, 3100],
  };
  for (let day = 1; day <= 14; day++) {
    [0, 6, 12, 18].forEach((h, i) => {
      const t = at(db, day, h);
      if (t > until) return;
      const daytime = h === 12 || h === 18 ? 180 : 0;
      const v = elevated && elevatedByDay[day] ? elevatedByDay[day][i] + noise(rand, 20) : 2250 + daytime + noise(rand, 110);
      pts.push({ t: iso(t), v: Math.round(v / 10) * 10, source: "sim" });
    });
  }
  return pts;
}

function buildSeries(db: DB, p: Profile, seed: number): Record<SeriesKey, Point[]> {
  const rand = mulberry32(seed + 99);
  const sim = "sim" as const;
  const series: Record<SeriesKey, Point[]> = {
    sleep: p.sleep.map((v, i) => ({ t: iso(at(db, i + 1, 6, 0)), v, source: sim })),
    hr: p.hr.map((v, i) => ({ t: iso(at(db, i + 1, 6, 5)), v, source: sim })),
    mood: p.mood.flatMap((v, i) => (v == null ? [] : [{ t: iso(at(db, i + 1, 6, 40)), v, source: sim }])),
    bp: WEEKLY_DAYS.map((d, i) => ({ t: iso(at(db, d, 7, 30)), v: p.bp[i][0], v2: p.bp[i][1], source: sim })),
    glucose: WEEKLY_DAYS.map((d, i) => ({ t: iso(at(db, d, 7, 30)), v: p.glucose[i], source: sim })),
    temp: WEEKLY_DAYS.map((d, i) => ({ t: iso(at(db, d, 7, 35)), v: p.temp[i], source: sim })),
    co2: co2Series(db, rand, p.co2Elevated, db.virtualSeedAt),
  };
  return series;
}

function buildCheckIns(db: DB, crewId: CrewId, p: Profile, counter: { n: number }): CheckIn[] {
  const out: CheckIn[] = [];
  const lastDay = p.checkedInToday ? 14 : 13;
  for (let day = 1; day <= lastDay; day++) {
    if (p.skipped.includes(day)) continue;
    const t = day === 14 ? at(db, 14, 7, 5) : at(db, day, 6, 40);
    const synced = day === 14 ? null : iso(at(db, day + 1, 6, 10));
    counter.n += 1;
    out.push({
      id: `ci-${counter.n}`,
      crewId,
      t: iso(t),
      day,
      sameAsYesterday: false,
      rested: (p.rested[day - 1] ?? 4) as CheckIn["rested"],
      headache: p.headacheDays[day] ?? "none",
      mood: (p.mood[day - 1] ?? 4) as CheckIn["mood"],
      vision: "no",
      source: "sim",
      syncedAt: synced,
    });
  }
  return out;
}

export function seedDb(): DB {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const db: DB = {
    version: DB_VERSION,
    seededOn: todayUtc(),
    realSeedAt: Date.now(),
    virtualSeedAt: midnight + 9 * 3_600_000 + 40 * 60_000,
    missionStart: midnight - 13 * DAY_MS,
    missionName: "Expedition KPS-1",
    module: "Crew module A",
    crew: CREW,
    surgeon: { id: "fs1", name: "Dr. Elena Ruiz", role: "Flight surgeon" },
    series: {},
    checkIns: [],
    symptoms: [],
    alerts: [],
    briefs: [],
    replies: [],
    notes: [],
    flags: [],
    requests: [],
    syncLog: [],
    lastSync: 0,
    seq: 1000,
  };

  const profiles: Record<CrewId, Profile> = {
    a1: okaforProfile(),
    a2: genericProfile(7, { sleep: 7.3, hr: 55, sys: 121, dia: 78, glu: 95, temp: 36.5 }, false, [], true),
    a3: genericProfile(11, { sleep: 7.0, hr: 63, sys: 110, dia: 70, glu: 87, temp: 36.7 }, true, [4, 9], false),
  };

  const counter = { n: 0 };
  for (const c of CREW) {
    db.series[c.id] = buildSeries(db, profiles[c.id], c.id.charCodeAt(1) * 31);
    db.checkIns.push(...buildCheckIns(db, c.id, profiles[c.id], counter));
  }
  // Bekov checked in at 07:05 today: after the 06:10 sync, so ground has not seen it.
  const bekovMood = db.checkIns.find((ci) => ci.crewId === "a2" && ci.day === 14);
  if (bekovMood) db.series.a2.mood.push({ t: bekovMood.t, v: bekovMood.mood ?? 4, source: "sim" });

  // Earlier consult on day 5, answered on day 6: shows the reply flow in history.
  db.briefs.push({
    id: "br-1",
    crewId: "a1",
    createdAt: iso(at(db, 5, 7, 0)),
    question: "The new shift pattern starts on day 11. Should I change anything about sleep before then?",
    pinned: [{ ref: { kind: "metric", key: "sleep" }, label: "Sleep", summary: "6.9 h average over days 1 to 4" }],
    alertId: null,
    status: "answered",
    syncedAt: iso(at(db, 6, 6, 10)),
  });
  db.replies.push({
    id: "rp-1",
    briefId: "br-1",
    crewId: "a1",
    author: db.surgeon,
    createdAt: iso(at(db, 6, 9, 0)),
    text: "Thanks for asking ahead. Your sleep and resting heart rate are steady, so nothing to change yet. If the shift starts to bite, the screen-free hour before sleep is the first thing I would try. Your call.",
    deliveredAt: iso(at(db, 7, 6, 10)),
    ack: "done",
  });
  db.notes.push({
    id: "nt-1",
    crewId: "a1",
    target: { kind: "metric", key: "sleep" },
    author: db.surgeon,
    createdAt: iso(at(db, 11, 15, 0)),
    text: "The shift change on day 11 moves your sleep window 2 hours earlier. A few short nights are expected this week. I will look at sleep and resting heart rate again on day 15.",
    deliveredAt: iso(at(db, 12, 6, 10)),
  });

  // Daily sync at 06:10 GMT (demo parameter). Log each one with what moved.
  for (let day = 2; day <= 14; day++) {
    const t = at(db, day, 6, 10);
    const toGround: SyncItem[] = [{ kind: "record", label: `Passive data through day ${day} 06:10 (3 crew)` }];
    const cis = db.checkIns.filter((ci) => ci.syncedAt === iso(t));
    if (cis.length) toGround.push({ kind: "checkin", label: `${cis.length} check-in${cis.length > 1 ? "s" : ""} from day ${day - 1}` });
    const briefs = db.briefs.filter((b) => b.syncedAt === iso(t));
    briefs.forEach((b) => toGround.push({ kind: "brief", label: `Consult brief: "${b.question.slice(0, 48)}..."` }));
    const fromGround: SyncItem[] = [
      ...db.replies.filter((r) => r.deliveredAt === iso(t)).map((r) => ({ kind: "reply" as const, label: `Reply from ${r.author.name}` })),
      ...db.notes.filter((n) => n.deliveredAt === iso(t)).map((n) => ({ kind: "note" as const, label: `Note from ${n.author.name}` })),
    ];
    db.syncLog.push({ id: `sy-${day}`, t: iso(t), day, toGround, fromGround });
  }
  db.lastSync = at(db, 14, 6, 10);
  return db;
}
