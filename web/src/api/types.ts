/**
 * DRAFT API CONTRACT (frontend side).
 *
 * These shapes mirror the endpoints planned in docs/TEAM.md ("First endpoints to
 * agree with A in hour 0"). They are a proposal for B, not the final contract.
 * When api/openapi.json exists, generate types from it and delete this file;
 * the mock layer in src/mocks/ must keep returning the same shapes.
 *
 * Time values are ISO 8601 strings in UTC. Mission time on board is GMT.
 */

export type CrewId = string;
export type Perspective = "astronaut" | "ground";

/** Status of one indicator or a whole record. Always shown with shape + word + color. */
export type Status = "ok" | "watch" | "act" | "learning" | "nodata";

/** Where a value came from. The UI labels "sim" as Simulated and "nasa" with its citation. */
export type Source = "sim" | "nasa" | "manual" | "checkin";

/** The six indicators from the official objective (docs/CHALLENGE.md). */
export type MetricKey = "bp" | "hr" | "glucose" | "temp" | "sleep" | "mood";
export type SeriesKey = MetricKey | "co2";

export type RegionKey = "brain" | "heart" | "blood" | "metabolism" | "bones" | "muscles";
export type Strength = "mild" | "moderate" | "strong";
export type Headache = "none" | Strength;

export interface Point {
  t: string;
  v: number;
  /** Second value, used by blood pressure only: v = systolic, v2 = diastolic. */
  v2?: number;
  source: Source;
}

export interface Baseline {
  state: "learning" | "ready";
  /** Calibration progress while learning: day N of `of`. */
  day?: number;
  of?: number;
  low: number;
  high: number;
  mean: number;
  /** Diastolic band, blood pressure only. */
  low2?: number;
  high2?: number;
  /** Readings used to learn this baseline. */
  n: number;
  /** Plain-language note on how the band is computed (and whether it is a demo parameter). */
  method: string;
}

export interface Indicator {
  key: MetricKey;
  label: string;
  unit: string;
  latest: Point | null;
  status: Status;
  /** Short plain-language status line, e.g. "Below your usual for 4 nights". */
  statusText: string;
  baseline: Baseline;
  /** Daily points for the last 14 days (sparse for weekly measurements). */
  series: Point[];
  cadence: "passive" | "checkin" | "weekly";
  source: Source;
}

export type PinRef =
  | { kind: "metric"; key: MetricKey }
  | { kind: "symptom"; key: "headache" | "vision" }
  | { kind: "cabin"; key: "co2" };

export interface PinnedItem {
  ref: PinRef;
  label: string;
  summary: string;
}

export interface Alert {
  id: string;
  crewId: CrewId;
  createdAt: string;
  day: number;
  severity: "watch" | "act";
  title: string;
  /** Three parts of every alert (docs/REQUIREMENTS.md M5). */
  whatChanged: string;
  nextStep: string;
  contactIf: string;
  /** Items the consult brief pins for this alert (B7). */
  related: PinRef[];
  state: "open" | "following" | "closed";
  closedReason?: string;
  /** When the astronaut (or follow-up) closed it. Ground learns this at the next sync. */
  closedAt?: string;
  /** Set when the alert reached ground in a sync. */
  syncedAt: string | null;
}

export interface WorthChecking {
  id: string;
  title: string;
  detail: string;
  ref?: PinRef;
}

export interface Readout {
  day: number;
  checkInDone: boolean;
  status: Status;
  headline: string;
  change: string | null;
  tip: string | null;
}

export interface CheckInInput {
  sameAsYesterday: boolean;
  /** 1 = exhausted ... 5 = fully rested. null = skipped. */
  rested: 1 | 2 | 3 | 4 | 5 | null;
  headache: Headache | null;
  /** 1 = low ... 5 = great. null = skipped. */
  mood: 1 | 2 | 3 | 4 | 5 | null;
  vision: "no" | "yes" | null;
}

export interface CheckIn extends CheckInInput {
  id: string;
  crewId: CrewId;
  t: string;
  day: number;
  source: Source;
  syncedAt: string | null;
}

export interface CheckInResult {
  checkIn: CheckIn;
  readout: Readout;
  alert: Alert | null;
}

export interface MeasurementInput {
  metric: MetricKey;
  v: number;
  v2?: number;
}

export interface SymptomInput {
  region: RegionKey;
  symptom: string;
  strength: Strength;
}

export interface SymptomLog extends SymptomInput {
  id: string;
  crewId: CrewId;
  t: string;
  day: number;
  syncedAt: string | null;
}

export interface Person {
  id: string;
  name: string;
  role: string;
}

export interface Brief {
  id: string;
  crewId: CrewId;
  createdAt: string;
  question: string;
  pinned: PinnedItem[];
  alertId: string | null;
  /** queued = waiting for the next ground link; delivered = on ground; answered = reply written. */
  status: "queued" | "delivered" | "answered";
  syncedAt: string | null;
}

export interface BriefDraft {
  question: string;
  pinned: PinnedItem[];
  alertId: string | null;
}

export interface Reply {
  id: string;
  briefId: string;
  crewId: CrewId;
  author: Person;
  createdAt: string;
  text: string;
  /** null until the next ground link carries it up to the station. */
  deliveredAt: string | null;
  ack: "done" | "follow-up" | null;
}

export type NoteTarget = { kind: "record" } | { kind: "metric"; key: MetricKey } | { kind: "cabin" };

export interface Note {
  id: string;
  crewId: CrewId;
  target: NoteTarget;
  author: Person;
  createdAt: string;
  text: string;
  deliveredAt: string | null;
}

export interface Flag {
  id: string;
  crewId: CrewId;
  metric: MetricKey;
  reason: string;
  author: Person;
  createdAt: string;
  deliveredAt: string | null;
  active: boolean;
}

export interface MeasurementRequest {
  id: string;
  crewId: CrewId;
  metric: MetricKey;
  reason: string;
  author: Person;
  createdAt: string;
  deliveredAt: string | null;
  doneAt: string | null;
}

export interface SyncItem {
  kind: "record" | "checkin" | "symptom" | "measurement" | "alert" | "brief" | "reply" | "note" | "flag" | "request";
  label: string;
}

export interface SyncEntry {
  id: string;
  t: string;
  day: number;
  /** What went from the station to ground. */
  toGround: SyncItem[];
  /** What came from ground to the station. */
  fromGround: SyncItem[];
}

export interface LinkState {
  lastSync: string;
  lastSyncDay: number;
  nextWindow: string;
  /** One-way signal delay in seconds (depends on the mission: station, Moon, Mars). */
  oneWayDelaySec: number;
  pendingToGround: number;
  pendingFromGround: number;
}

export interface Mission {
  name: string;
  environment: "station" | "spacecraft" | "rover" | "surface";
  day: number;
  now: string;
  module: string;
}

export interface CrewSummary {
  id: CrewId;
  name: string;
  shortName: string;
  initials: string;
  role: string;
  status: Status;
  statusText: string;
  openAlerts: number;
  unansweredBriefs: number;
  lastSync: string;
}

export interface CabinData {
  module: string;
  co2: Point[];
  /** Usual CO2 band for this module, learned like a personal baseline. */
  usual: { low: number; high: number };
  limit: { value: number; label: string; source: string };
  headaches: { day: number; t: string; strength: Headache }[];
  pattern: { found: boolean; text: string } | null;
  days: number;
}

/**
 * Crew readiness for the commander (S3): a level and a reason, never raw
 * medical data. The astronaut sees the same object about themselves.
 */
export interface Readiness {
  crewId: CrewId;
  level: "ready" | "check" | "learning";
  reason: string;
}

/** One record, two views (docs/REQUIREMENTS.md D3, D4). */
export interface RecordView {
  perspective: Perspective;
  /** Ground sees data as of the last sync. The astronaut sees live data. */
  asOf: string;
  crew: CrewSummary;
  mission: Mission;
  readout: Readout;
  indicators: Indicator[];
  alert: Alert | null;
  worthChecking: WorthChecking[];
  checkIns: CheckIn[];
  symptoms: SymptomLog[];
  briefs: Brief[];
  replies: Reply[];
  notes: Note[];
  flags: Flag[];
  requests: MeasurementRequest[];
  /** What the commander sees about this person (S3). */
  readiness: Readiness | null;
}

export interface InboxItem {
  kind: "brief" | "alert";
  crew: CrewSummary;
  brief?: Brief;
  alert?: Alert;
}

export interface Osd569Sample {
  crew: string;
  timepoint: string;
  value: number;
}

export interface Osd569Indicator {
  key: string;
  label: string;
  unit: string;
  sourceColumn: string;
  earthRange: { min: number; max: number };
  samples: Osd569Sample[];
}

export interface Osd569Reference {
  /** True until role C's ETL writes data/processed/osd569.json: no numbers to show. */
  placeholder?: boolean;
  /** True when the app shows its bundled copy of the real NASA file because the API has none yet. */
  bundledCopy?: boolean;
  datasetId: string;
  title: string;
  url: string;
  file: string;
  accessed: string;
  timepoints: string[];
  indicators: Osd569Indicator[];
}
