import type {
  Alert,
  Brief,
  BriefDraft,
  CabinData,
  CheckInInput,
  CheckInResult,
  CrewId,
  CrewSummary,
  Flag,
  InboxItem,
  Indicator,
  LinkState,
  MeasurementInput,
  MeasurementRequest,
  MetricKey,
  Mission,
  Note,
  NoteTarget,
  Osd569Reference,
  Point,
  Readiness,
  RecordView,
  Reply,
  SeriesKey,
  SymptomInput,
  SymptomLog,
  SyncEntry,
} from "./types";
import { createMockApi } from "../mocks/mockApi";
import { createHttpApi } from "./http";

/**
 * Everything the web app needs from the backend. The app calls only this
 * interface, never VictoriaMetrics or data files (docs/TEAM.md, section A).
 *
 * Two implementations:
 *  - mock (default): in-browser store in src/mocks/, works with no backend.
 *  - http: calls the FastAPI routes. Switch with VITE_API_MODE=http.
 */
/** What the connected backend can do. The UI hides what it cannot back yet. */
export interface ApiSupports {
  /** Symptom logging from the body map (U8). */
  symptoms: boolean;
  /** A measurement can be saved without today's check-in. */
  standaloneMeasurements: boolean;
  /** The astronaut can untick pinned items before sending a brief. */
  pinEditing: boolean;
  /** "Mark done" on a reply is stored by the API (otherwise only in this browser). */
  replyAckOnServer: boolean;
}

export interface ApiClient {
  readonly mode: "mock" | "http";
  readonly supports: ApiSupports;

  getMission(): Promise<Mission>;
  getCrew(): Promise<CrewSummary[]>;
  getAstronautView(id: CrewId): Promise<RecordView>;
  getGroundView(id: CrewId): Promise<RecordView>;
  getSeries(id: CrewId, metric: SeriesKey, days: number): Promise<Point[]>;
  getCabin(id: CrewId, perspective: "astronaut" | "ground"): Promise<CabinData>;
  getOsd569(): Promise<Osd569Reference>;
  /** Crew readiness for the commander (S3). */
  getReadiness(): Promise<Readiness[]>;

  postCheckIn(id: CrewId, input: CheckInInput): Promise<CheckInResult>;
  postMeasurement(id: CrewId, input: MeasurementInput): Promise<Indicator>;
  postSymptom(id: CrewId, input: SymptomInput): Promise<SymptomLog>;
  closeAlert(alertId: string): Promise<Alert>;

  draftBrief(id: CrewId, alertId: string | null): Promise<BriefDraft>;
  createBrief(id: CrewId, draft: BriefDraft): Promise<Brief>;
  ackReply(replyId: string, ack: "done" | "follow-up"): Promise<Reply>;

  getInbox(): Promise<InboxItem[]>;
  postReply(briefId: string, text: string): Promise<Reply>;
  postNote(id: CrewId, target: NoteTarget, text: string): Promise<Note>;
  postFlag(id: CrewId, metric: MetricKey, reason: string): Promise<Flag>;
  postRequest(id: CrewId, metric: MetricKey, reason: string): Promise<MeasurementRequest>;

  getLink(): Promise<LinkState>;
  getLinkLog(): Promise<SyncEntry[]>;
  /** Simulated ground link: send queued items both ways now (demo control, B8). */
  syncNow(): Promise<SyncEntry>;

  /** Mock only: reload the 14-day demo mission. */
  resetDemo?(): Promise<void>;
}

const mode = import.meta.env.VITE_API_MODE === "http" ? "http" : "mock";

/** In http mode the dev server proxies /api to FastAPI on :8000 (vite.config.ts), so no CORS setup is needed. */
export const api: ApiClient = mode === "http" ? createHttpApi(import.meta.env.VITE_API_URL ?? "/api") : createMockApi();
