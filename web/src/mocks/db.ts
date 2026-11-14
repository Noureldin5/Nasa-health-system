/**
 * MOCK ONLY. In-browser stand-in for the station server's records
 * (SQLite + VictoriaMetrics behind the API). Persisted in localStorage so the
 * demo survives a reload. The virtual clock starts at day 14, 09:40 GMT and
 * never leaves day 14, so the demo story holds however long the tab is open.
 * "Reset demo data" (footer) reseeds.
 */
import type {
  Alert,
  Brief,
  CheckIn,
  CrewId,
  Flag,
  MeasurementRequest,
  Note,
  Person,
  Point,
  Reply,
  SeriesKey,
  SymptomLog,
  SyncEntry,
} from "../api/types";

export const DAY_MS = 86_400_000;

export interface CrewMember {
  id: CrewId;
  name: string;
  shortName: string;
  initials: string;
  role: string;
}

export interface DB {
  version: number;
  seededOn: string;
  realSeedAt: number;
  virtualSeedAt: number;
  missionStart: number;
  missionName: string;
  module: string;
  crew: CrewMember[];
  surgeon: Person;
  series: Record<CrewId, Record<SeriesKey, Point[]>>;
  checkIns: CheckIn[];
  symptoms: SymptomLog[];
  alerts: Alert[];
  briefs: Brief[];
  replies: Reply[];
  notes: Note[];
  flags: Flag[];
  requests: MeasurementRequest[];
  syncLog: SyncEntry[];
  lastSync: number;
  seq: number;
}

export const DB_VERSION = 4;
const KEY = "oyb-mock-db";

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadDb(seed: () => DB): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION) return db;
    }
  } catch {
    // Storage blocked or corrupt: fall through to a fresh seed.
  }
  const db = seed();
  saveDb(db);
  return db;
}

export function saveDb(db: DB): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Private window or full storage: the demo still runs in memory.
  }
}

export function nextId(db: DB, prefix: string): string {
  db.seq += 1;
  return `${prefix}-${db.seq}`;
}

/** Virtual mission clock: starts at 09:40 GMT on day 14 and stops at 23:59, so it never rolls into day 15. */
export function nowMs(db: DB): number {
  const endOfDay14 = db.missionStart + 14 * DAY_MS - 60_000;
  return Math.min(db.virtualSeedAt + (Date.now() - db.realSeedAt), endOfDay14);
}

export function dayOf(db: DB, t: number | string): number {
  const ms = typeof t === "string" ? Date.parse(t) : t;
  return Math.floor((ms - db.missionStart) / DAY_MS) + 1;
}

export function at(db: DB, day: number, hour: number, minute = 0): number {
  return db.missionStart + (day - 1) * DAY_MS + hour * 3_600_000 + minute * 60_000;
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}
