import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Alert, Brief, Mission, Readout, RecordView, Reply, SyncEntry } from "../api/types";
import { INDICATORS } from "../content/indicators";
import { DISCLAIMER } from "../content/sources";
import { fmtDayTime } from "../lib/format";
import { Icon, type IconName } from "./icons";
import { StatusIcon, StatusPill } from "./status";

/* ---------- Today's readout (U1) ---------- */

export function ReadoutHero({ readout, children }: { readout: Readout; children?: ReactNode }) {
  return (
    <section className="card" aria-label="Today's readout">
      <div className="readout">
        <div className="readout__mark" aria-hidden="true">
          <StatusIcon status={readout.status} size={28} />
        </div>
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="micro">Today's readout · day {readout.day}</span>
            <StatusPill status={readout.status} />
          </div>
          <p className="readout__headline">{readout.headline}</p>
          {readout.change && <p className="readout__change">{readout.change}</p>}
          {readout.tip && (
            <p className="readout__tip">
              <Icon name="arrow-right" size={20} style={{ flex: "none", marginTop: 2, color: "var(--c-link)" }} />
              <span>
                <b>Try this: </b>
                {readout.tip}
              </span>
            </p>
          )}
          {children}
          <p className="small muted" style={{ marginTop: 12 }}>
            {DISCLAIMER} Compared with your own baseline.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Alert with its three parts (M5) ---------- */

export function AlertCard({ alert, mission, actions, perspective = "astronaut" }: {
  alert: Alert;
  mission: Mission;
  actions?: ReactNode;
  perspective?: "astronaut" | "ground";
}) {
  const closed = alert.state === "closed";
  return (
    <section className={`alert alert--${closed ? "closed" : alert.severity}`} aria-label="Alert">
      <div className="alert__head">
        <div className="row" style={{ ["--gap" as string]: "10px" }}>
          <StatusPill status={closed ? "ok" : alert.severity} label={closed ? "Closed" : alert.severity === "act" ? "Act now" : "Worth checking"} />
          <span className="micro">
            {fmtDayTime(alert.createdAt, mission)} · compared with {perspective === "astronaut" ? "your" : "their"} baseline
          </span>
        </div>
        <span className={`tag${alert.syncedAt ? "" : " tag--queued"}`}>{alert.syncedAt ? "Seen by ground" : "Goes to ground at next link"}</span>
      </div>
      <p className="alert__title">{alert.title}</p>
      <dl className="alert__parts">
        <dt className="micro">What changed</dt>
        <dd>{alert.whatChanged}</dd>
        <dt className="micro">Next step</dt>
        <dd className="strong">{alert.nextStep}</dd>
        <dt className="micro">Contact the flight surgeon if</dt>
        <dd>{alert.contactIf.charAt(0).toUpperCase() + alert.contactIf.slice(1)}</dd>
        {closed && (
          <>
            <dt className="micro">Closed</dt>
            <dd>{alert.closedReason}</dd>
          </>
        )}
        {!closed && (
          <>
            <dt className="micro">Follow-up</dt>
            <dd className="text-2">The app watches your next check-ins and the cabin CO2, and closes this alert when things settle. You can close it yourself.</dd>
          </>
        )}
      </dl>
      {actions && <div className="alert__actions">{actions}</div>}
      <p className="small muted" style={{ padding: "0 var(--s-5) var(--s-4) calc(var(--s-5) + 4px)" }}>
        {DISCLAIMER}
      </p>
    </section>
  );
}

/* ---------- Everything ground wrote, word for word (D4, U11) ---------- */

type FeedEntry =
  | { kind: "reply"; t: string; reply: Reply; brief?: Brief }
  | { kind: "note"; t: string; id: string; text: string; target: string; author: string; queued: boolean }
  | { kind: "flag"; t: string; id: string; text: string; target: string; author: string; queued: boolean }
  | { kind: "request"; t: string; id: string; text: string; target: string; metric: string; author: string; queued: boolean; done: boolean };

export function groundFeed(rec: RecordView): FeedEntry[] {
  const label = (k: string) => INDICATORS[k as keyof typeof INDICATORS]?.label ?? k;
  const out: FeedEntry[] = [
    ...rec.replies.map((r) => ({ kind: "reply" as const, t: r.createdAt, reply: r, brief: rec.briefs.find((b) => b.id === r.briefId) })),
    ...rec.notes.map((n) => ({
      kind: "note" as const,
      t: n.createdAt,
      id: n.id,
      text: n.text,
      target: n.target.kind === "metric" ? label(n.target.key) : n.target.kind === "cabin" ? "Cabin CO2" : "Whole record",
      author: n.author.name,
      queued: !n.deliveredAt,
    })),
    ...rec.flags.map((f) => ({ kind: "flag" as const, t: f.createdAt, id: f.id, text: f.reason, target: label(f.metric), author: f.author.name, queued: !f.deliveredAt })),
    ...rec.requests.map((r) => ({
      kind: "request" as const,
      t: r.createdAt,
      id: r.id,
      text: r.reason,
      target: label(r.metric),
      metric: r.metric,
      author: r.author.name,
      queued: !r.deliveredAt,
      done: !!r.doneAt,
    })),
  ];
  return out.sort((a, b) => Date.parse(b.t) - Date.parse(a.t));
}

const FEED_META: Record<FeedEntry["kind"], { icon: IconName; word: string }> = {
  reply: { icon: "consult", word: "Reply to your question" },
  note: { icon: "note", word: "Note" },
  flag: { icon: "flag", word: "Watch flag" },
  request: { icon: "request", word: "Measurement request" },
};

export function GroundFeed({ rec, mission, perspective, onAck, limit }: {
  rec: RecordView;
  mission: Mission;
  perspective: "astronaut" | "ground";
  onAck?: (reply: Reply, ack: "done" | "follow-up") => void;
  limit?: number;
}) {
  const items = groundFeed(rec).slice(0, limit ?? 99);
  if (!items.length) return <div className="empty">Nothing from ground yet. Notes, flags and replies appear here word for word.</div>;
  return (
    <ul className="feed" style={{ listStyle: "none" }}>
      {items.map((it) => {
        const meta = FEED_META[it.kind];
        const queued = it.kind === "reply" ? !it.reply.deliveredAt : it.queued;
        const author = it.kind === "reply" ? it.reply.author.name : it.author;
        return (
          <li key={it.kind === "reply" ? it.reply.id : it.id} className={`feed-item${queued ? " feed-item--queued" : ""}`}>
            <span className="avatar" aria-hidden="true">
              <Icon name={meta.icon} size={18} />
            </span>
            <div>
              <div className="feed-item__meta">
                <b>{meta.word}</b>
                {it.kind !== "reply" && <span>on {it.target}</span>}
                <span>·</span>
                <span>
                  {author}, {fmtDayTime(it.t, mission)}
                </span>
                {queued && <span className="tag tag--queued">{perspective === "ground" ? "Queued for uplink" : "Arrives at next link"}</span>}
                {it.kind === "reply" && it.reply.ack === "done" && <span className="tag tag--done">Marked done</span>}
                {it.kind === "request" && it.done && <span className="tag tag--done">Done</span>}
              </div>
              {it.kind === "reply" ? (
                <>
                  {it.brief && <div className="feed-item__ref">You asked: “{it.brief.question}”</div>}
                  <p className="feed-item__text" style={{ marginTop: 8 }}>
                    {it.reply.text}
                  </p>
                  <p className="small muted" style={{ marginTop: 6 }}>
                    Advice from a colleague, not an order. Your call.
                  </p>
                  {perspective === "astronaut" && onAck && !it.reply.ack && (
                    <div className="feed-item__actions">
                      <button type="button" className="btn btn--secondary" onClick={() => onAck(it.reply, "done")}>
                        <Icon name="check" size={16} /> Mark done
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => onAck(it.reply, "follow-up")}>
                        Ask a follow-up
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="feed-item__text">{it.text}</p>
                  {it.kind === "request" && perspective === "astronaut" && !it.done && !queued && (
                    <div className="feed-item__actions">
                      <Link to={`/measure?metrics=${it.metric}`} className="btn btn--primary">
                        Measure {it.target.toLowerCase()} when it fits your day
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Consult brief (D5) ---------- */

export const BRIEF_STATUS: Record<Brief["status"], { word: string; astronaut: string; ground: string }> = {
  queued: { word: "Queued", astronaut: "Queued, will send at the next ground link", ground: "Not on ground yet" },
  delivered: { word: "On ground", astronaut: "On ground, waiting for a reply", ground: "Waiting for your reply" },
  answered: { word: "Answered", astronaut: "Answered", ground: "Answered" },
};

export function BriefCard({ brief, mission, perspective, children }: { brief: Brief; mission: Mission; perspective: "astronaut" | "ground"; children?: ReactNode }) {
  const st = BRIEF_STATUS[brief.status];
  return (
    <article className="card">
      <header className="card__head">
        <div className="stack" style={{ ["--gap" as string]: "2px" }}>
          <span className="micro">Consult brief · {fmtDayTime(brief.createdAt, mission)}</span>
          <span className="text-2 small">{perspective === "astronaut" ? "Your question" : "Question from the astronaut"}</span>
        </div>
        <span className={`tag${brief.status === "queued" ? " tag--queued" : brief.status === "answered" ? " tag--done" : ""}`}>{st[perspective]}</span>
      </header>
      <div className="card__body stack">
        <p className="brief-question">“{brief.question}”</p>
        {brief.pinned.length > 0 && (
          <div className="stack" style={{ ["--gap" as string]: "8px" }}>
            <span className="micro">Pinned · look here first. The full record is also on ground</span>
            <div className="pins">
              {brief.pinned.map((p, i) => (
                <div key={i} className="pin">
                  <Icon name="pin" size={18} style={{ color: "var(--c-text-2)" }} />
                  <div>
                    <div className="pin__label">{p.label}</div>
                    <div className="pin__summary">{p.summary}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {children}
      </div>
    </article>
  );
}

/* ---------- Sync log (D6) ---------- */

export function SyncLog({ entries, mission, limit }: { entries: SyncEntry[]; mission: Mission; limit?: number }) {
  const list = entries.slice(0, limit ?? entries.length);
  return (
    <div className="synclog" role="list">
      {list.map((e) => (
        <div key={e.id} className="synclog__row" role="listitem">
          <div className="synclog__when">{fmtDayTime(e.t, mission)} GMT</div>
          <div>
            <span className="micro synclog__dir">To ground ↑</span>
            <ul className="synclog__list">
              {e.toGround.map((i, k) => (
                <li key={k}>{i.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="micro synclog__dir">From ground ↓</span>
            <ul className="synclog__list">
              {e.fromGround.length ? e.fromGround.map((i, k) => <li key={k}>{i.label}</li>) : <li className="muted">Nothing new</li>}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
