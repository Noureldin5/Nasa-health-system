/**
 * Record assistant, browser side. One call for every feature:
 *
 *   1. red-flag and medicine questions get the rule text here, before any network call;
 *   2. otherwise the facts go to the station API (api/routes/ai.py), which holds the key;
 *   3. if the API or the provider is not reachable, the answer is built from the same facts by
 *      fixed rules (the "canned" functions below), so every screen works with the network off.
 *
 * The assistant never changes a status and never writes to the record. Its text is a draft.
 */
import type { MetricKey, PinnedItem } from "../api/types";
import { INDICATORS } from "../content/indicators";
import { buildFacts, citeLabel, citeValue, co2ByDay, valuesByDay, type Cite, type CiteKey, type Facts, type RecordCtx } from "./facts";

/** Astronaut side only: ground gets no assistant text, so nothing ground reads is hidden from the crew. */
export type Feature = "ask" | "explain_alert" | "draft_brief";

export interface AiResult {
  /** model = fresh from the provider; cache = an earlier model answer; rule = safety rule; canned = built here from the facts. */
  source: "model" | "cache" | "rule" | "canned";
  text: string;
  cites: Cite[];
  facts: Facts;
  /** The question or text that went with the facts (shown in "what was sent"). */
  question?: string;
  provider?: string;
  model?: string;
  /** Why the model was not used (shown as a tooltip). */
  reason?: string;
}

const env = import.meta.env as unknown as Record<string, string | undefined>;
const AI_URL = `${(env.VITE_AI_URL ?? env.VITE_API_URL ?? "/api").replace(/\/$/, "")}/ai`;
/** A little above the server's own 4 s, so the server's answer wins when it has one. Demo parameter. */
const CLIENT_TIMEOUT_MS = 5500;

/* ---------- Rules that never reach the model (same lists as api/routes/ai.py) ---------- */

// Demo parameter: the terms repeat our own "contact the flight surgeon if" copy, not a triage list.
const RED_FLAG =
  /chest|breath|faint|passed out|black(ed)? out|dizz|light.?headed|heart attack|stroke|vomit|vision (loss|change|blur)|blurr?(y|ed) vision|double vision|can['’]?t see|lost (my )?vision|(severe|strong|worst|terrible|unbearable) head ?ache|racing heart|palpitation|\bpain\b|confus(ed|ion)|\bnumb(ness)?\b|slurred|seizure|bleeding|suicid|self.harm|hurt myself|kill myself|want to die|overdose/i;
const MEDICINE =
  /\b(dose|dosage|mg(?!\s*\/\s*dl)|pills?|medicine|medication|meds|drugs?|painkillers?|ibuprofen|paracetamol|acetaminophen|aspirin|antibiotics?|sleeping pills?|melatonin|prescri\w*|what (should|can|do) i take|treat(ment)? (it|this))\b/i;
// "Am I ill?" asks for an assessment. Only the flight surgeon gives one.
const ASSESS =
  /\b(am i|is (it|this|that)|could (i|it) be|do i have|have i got|will i)\b[^?.!]*\b(sick|ill|unwell|illness|disease|infect\w*|cancer|serious|dangerous|dying|die|ok|okay|healthy|fever|flu|virus|covid)\b/i;
const ASSESS_TEXT =
  "The record cannot tell you whether you are ill, and neither can this assistant. It can show what changed in your record. For an assessment, send a consult brief: your flight surgeon sees your full record.";
export const RED_FLAG_TEXT =
  "This is on the list to raise with your flight surgeon now. Send a consult brief: the flight surgeon sees your full record. The record assistant does not assess symptoms like this.";
const MEDICINE_TEXT = "The record assistant does not advise on medicines, doses or treatment. Ask your flight surgeon through a consult brief. They see your full record.";
const ACT_ALERT_TEXT =
  "The app marked this as one to raise with your flight surgeon now. Follow the next step on the alert and send a consult brief. The record assistant does not explain alerts at this level.";

function ruleText(feature: Feature, question: string | undefined, facts: Facts): string | null {
  if (question && RED_FLAG.test(question)) return RED_FLAG_TEXT;
  if (feature === "ask" && question && MEDICINE.test(question)) return MEDICINE_TEXT;
  if (feature === "ask" && question && ASSESS.test(question)) return ASSESS_TEXT;
  if (facts.alert?.severity === "act") return ACT_ALERT_TEXT;
  return null;
}

/* ---------- Canned answers: fixed rules over the same facts ---------- */

const TOPICS: { key: CiteKey; re: RegExp }[] = [
  { key: "sleep", re: /sleep|slept|tired|night|rest(ed)?\b/i },
  { key: "hr", re: /heart|pulse|\bhr\b|bpm/i },
  { key: "mood", re: /mood|stress|morale/i },
  { key: "bp", re: /blood pressure|\bbp\b/i },
  { key: "glucose", re: /sugar|glucose/i },
  { key: "temp", re: /temperature|\btemp\b|fever/i },
  { key: "co2", re: /co2|carbon|cabin|\bair\b|ventilat/i },
  { key: "headache", re: /head ?ache|\bhead\b/i },
];

interface Piece {
  text: string;
  cites: Cite[];
}

function metricPiece(ctx: Ctx, key: MetricKey, brief = false): Piece {
  const ind = ctx.rec.indicators.find((i) => i.key === key);
  const c = INDICATORS[key];
  const days = ind ? [...valuesByDay(ind, ctx.rec)] : [];
  if (!ind || !ind.latest || !days.length) return { text: `${c.label}: no reading in your record for the last 14 days.`, cites: [] };
  const [lastDay, last] = days[days.length - 1];
  const b = ind.baseline;
  const usual = b.state === "ready" ? ctx.facts_usual(key) : null;
  const out = b.state === "ready" ? days.filter(([, v]) => v.v < b.low || v.v > b.high || (v.v2 != null && b.low2 != null && (v.v2 < b.low2 || v.v2 > (b.high2 ?? Infinity)))).slice(-4) : [];
  if (brief) {
    const note = `${ind.statusText.charAt(0).toLowerCase()}${ind.statusText.slice(1)}${usual ? `; usual ${usual}` : ""}`;
    return { text: `${c.label} ${last.text} ${c.unit} on day ${lastDay} (${note}).`, cites: [{ metric: key, day: lastDay }] };
  }
  let text = `${c.label}: ${last.text} ${c.unit} on day ${lastDay}. ${ind.statusText}${usual ? `, against your usual ${usual} ${c.unit}` : ""}.`;
  if (out.length > 1) text += ` Outside your usual on ${out.map(([d, v]) => `day ${d} (${v.text})`).join(", ")}.`;
  const cites = (out.length ? out : [[lastDay, last] as const]).map(([d]) => ({ metric: key as CiteKey, day: d }));
  return { text, cites };
}

function co2Piece(ctx: RecordCtx, brief = false): Piece {
  const cabin = ctx.cabin;
  const days = [...co2ByDay(ctx)];
  if (!cabin || !days.length) return { text: "Cabin CO2: no readings in your record.", cites: [] };
  const high = Number.isFinite(cabin.usual.high) ? days.filter(([, v]) => v > cabin.usual.high).slice(-4) : [];
  const [lastDay, last] = days[days.length - 1];
  const fmt = (v: number) => v.toLocaleString("en-US");
  const usual = Number.isFinite(cabin.usual.low) ? ` The usual range for ${cabin.module} is ${fmt(cabin.usual.low)} to ${fmt(cabin.usual.high)} ppm.` : "";
  const text = high.length && brief && Number.isFinite(cabin.usual.low)
    ? `Cabin CO2 daily average above the module's usual on ${high.map(([d, v]) => `day ${d} (${fmt(v)} ppm)`).join(", ")}; usual ${fmt(cabin.usual.low)} to ${fmt(cabin.usual.high)} ppm.`
    : high.length
    ? `Cabin CO2 daily average was above the module's usual on ${high.map(([d, v]) => `day ${d} (${fmt(v)} ppm)`).join(", ")}.${usual}`
    : `Cabin CO2 daily average on day ${lastDay} was ${fmt(last)} ppm, inside the module's usual.${usual}`;
  return { text, cites: (high.length ? high : [[lastDay, last] as const]).map(([d]) => ({ metric: "co2" as CiteKey, day: d })) };
}

function headachePiece(ctx: RecordCtx): Piece {
  const days = ctx.rec.checkIns.filter((c) => c.headache && c.headache !== "none").slice(-5);
  if (!days.length) return { text: "No headache is reported in your check-ins for the last 14 days.", cites: [] };
  return {
    text: `Headache reported in your check-ins on ${days.map((c) => `day ${c.day} (${c.headache})`).join(", ")}.`,
    cites: days.map((c) => ({ metric: "headache" as CiteKey, day: c.day })),
  };
}

function join(pieces: Piece[], tail = ""): Piece {
  const cites: Cite[] = [];
  for (const c of pieces.flatMap((p) => p.cites)) if (!cites.some((x) => x.metric === c.metric && x.day === c.day)) cites.push(c);
  return { text: [...pieces.map((p) => p.text), tail].filter(Boolean).join(" "), cites: cites.slice(0, 6) };
}

type Ctx = RecordCtx & { facts_usual: (k: MetricKey) => string | null };

function piece(ctx: Ctx, key: CiteKey, brief = false): Piece {
  if (key === "co2") return co2Piece(ctx, brief);
  if (key === "headache") return headachePiece(ctx);
  return metricPiece(ctx, key, brief);
}

function overview(ctx: Ctx): Piece {
  const off = ctx.rec.indicators.filter((i) => i.status === "watch" || i.status === "act");
  const ok = ctx.rec.indicators.filter((i) => i.status === "ok").map((i) => i.label.toLowerCase());
  const head = ctx.rec.alert && ctx.rec.alert.state !== "closed" ? `Open alert: ${ctx.rec.alert.title}.` : `${ctx.rec.readout.headline}.`;
  const tail = ok.length ? `In your usual range: ${ok.join(", ")}.` : "";
  return join([{ text: head, cites: [] }, ...off.map((i) => metricPiece(ctx, i.key))], tail);
}

function canned(feature: Feature, ctx: Ctx, question: string | undefined, pinned: PinnedItem[]): Piece | null {
  const alert = ctx.rec.alert && ctx.rec.alert.state !== "closed" ? ctx.rec.alert : null;
  const related = (): Piece[] => {
    const keys = new Set<CiteKey>();
    for (const r of alert?.related ?? []) keys.add(r.kind === "metric" ? r.key : r.kind === "cabin" ? "co2" : "headache");
    for (const p of pinned) keys.add(p.ref.kind === "metric" ? p.ref.key : p.ref.kind === "cabin" ? "co2" : "headache");
    return [...keys].map((k) => piece(ctx, k, true));
  };

  switch (feature) {
    case "ask": {
      const q = question ?? "";
      const topics = TOPICS.filter((t) => t.re.test(q)).map((t) => t.key);
      if (/why|alert|pattern|cause/i.test(q) && alert) {
        return join([{ text: alert.whatChanged, cites: [] }, ...related()], "A pattern to check, not a cause.");
      }
      if (/ground|surgeon|doctor|\bnotes?\b|wrote|reply|replied/i.test(q)) {
        const items = [
          ...ctx.rec.replies.map((r) => ({ t: r.createdAt, who: `${r.author.name}, reply`, text: r.text })),
          ...ctx.rec.notes.map((n) => ({ t: n.createdAt, who: `${n.author.name}, note`, text: n.text })),
          ...ctx.rec.flags.filter((f) => f.active).map((f) => ({ t: f.createdAt, who: `${f.author.name}, watch flag on ${INDICATORS[f.metric].label.toLowerCase()}`, text: f.reason })),
          ...ctx.rec.requests.map((q) => ({ t: q.createdAt, who: `${q.author.name}, request for a ${INDICATORS[q.metric].label.toLowerCase()} reading`, text: q.reason })),
        ]
          .sort((a, b) => Date.parse(b.t) - Date.parse(a.t))
          .slice(0, 2);
        if (!items.length) return { text: "Ground has written nothing in your record yet.", cites: [] };
        return { text: `Latest from ground, word for word. ${items.map((i) => `${i.who}: “${i.text}”`).join(" ")}`, cites: [] };
      }
      if (!topics.length) return overview(ctx);
      return join(topics.slice(0, 3).map((k) => piece(ctx, k)));
    }
    case "explain_alert": {
      if (!alert) return { text: "There is no open alert in your record.", cites: [] };
      return join([{ text: "The app raised this from your own record.", cites: [] }, ...related()], `A pattern to check, not a cause. Next step: ${alert.nextStep}`);
    }
    case "draft_brief": {
      const parts = related();
      const facts = parts.length ? join(parts) : overview(ctx);
      const first = facts.text.replace(/\byour\b/g, "my").replace(/\bYour\b/g, "My").replace(/\byou\b/g, "I");
      return { text: `${first} Is this pattern something to watch, or should I change anything?`, cites: facts.cites };
    }
  }
}

/* ---------- The call ---------- */

const memory = new Map<string, AiResult>();

export interface AskOptions {
  question?: string;
  pinned?: PinnedItem[];
}

/* ---------- Log of what left the station (open record: every send is listed) ---------- */

export interface SendLogEntry {
  day: number;
  feature: Feature;
  provider: string;
  model: string;
  question?: string;
  /** Size of the facts that were sent, in characters. */
  chars: number;
}
const LOG_KEY = "oyb-assistant-log";
export function sendLog(): SendLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as SendLogEntry[];
  } catch {
    return [];
  }
}
function logSend(e: SendLogEntry) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify([e, ...sendLog()].slice(0, 30)));
  } catch {
    /* storage blocked: the per-answer disclosure still shows what was sent */
  }
}

/** At Mars distance there is no live link to call a model over, so the on-board rules answer. */
function noLiveLink(): boolean {
  try {
    return localStorage.getItem("oyb-link-profile") === "mars";
  } catch {
    return false;
  }
}

export async function assist(feature: Feature, ctx: RecordCtx, opts: AskOptions = {}): Promise<AiResult> {
  const facts = buildFacts(ctx, opts.pinned);
  const question = opts.question?.trim() || undefined;
  const full: Ctx = { ...ctx, facts_usual: (k) => facts.metrics.find((m) => m.key === k)?.usual ?? null };

  const rule = ruleText(feature, question, facts);
  if (rule) return { source: "rule", text: rule, cites: [], facts, question };

  const key = JSON.stringify([feature, question?.toLowerCase(), facts]);
  const hit = memory.get(key);
  if (hit) return hit;

  let reason = "offline";
  if (noLiveLink()) reason = "no_live_link";
  else try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS);
    const res = await fetch(`${AI_URL}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, question, facts }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const out = (await res.json()) as { source: "model" | "cache" | "rule" | "unavailable"; text: string; cites: Cite[]; reason?: string; provider?: string; model?: string };
      if (out.source !== "unavailable" && out.text) {
        const result: AiResult = { source: out.source, text: out.text, cites: (out.cites ?? []).filter((c) => citeValue(facts, c)), facts, question, provider: out.provider, model: out.model, reason: out.reason };
        if (out.source === "model") logSend({ day: facts.mission_day, feature, provider: out.provider ?? "", model: out.model ?? "", question, chars: JSON.stringify(facts).length });
        if (out.source !== "rule") memory.set(key, result);
        return result;
      }
      reason = out.reason ?? "unavailable";
    } else {
      reason = `http_${res.status}`;
    }
  } catch {
    reason = "offline";
  }

  const fallback = canned(feature, full, question, opts.pinned ?? []);
  return { source: "canned", text: fallback?.text ?? "", cites: (fallback?.cites ?? []).filter((c) => citeValue(facts, c)), facts, question, reason };
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
}

/** Whether the station API has a provider key. Resolves to null when the API is not reachable. */
export async function assistantStatus(): Promise<AiStatus | null> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`${AI_URL}/status`, { signal: ctl.signal });
    clearTimeout(timer);
    return res.ok ? ((await res.json()) as AiStatus) : null;
  } catch {
    return null;
  }
}

export const SOURCE_NOTE: Record<AiResult["source"], string> = {
  model: "Written by the language model from your record's facts",
  cache: "Saved model answer for this exact record",
  rule: "Safety rule, not the model",
  canned: "Built on board by fixed rules from your record. No language model was used",
};

export { citeLabel, citeValue };
