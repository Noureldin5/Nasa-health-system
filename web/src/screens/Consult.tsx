import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { BriefCard, GroundFeed, SyncLog } from "../components/record";
import { Icon } from "../components/icons";
import { LinkDistance } from "../components/SignalPath";
import { Empty, ErrorNote, PageHead } from "../components/ui";
import { LINK_WINDOW_HOURS } from "../content/sources";
import { ME, useAction, useApp, useQuery } from "../lib/app";
import { fmtDayTime, fmtTime } from "../lib/format";
import { MyReadiness } from "./Readiness";

/** Consult layer for the astronaut: replies and notes from ground, own briefs, sync log (D5, D6). */
export function Consult() {
  const nav = useNavigate();
  const { link, syncNow, syncing, linkProfile } = useApp();
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  const log = useQuery("link-log", () => api.getLinkLog());
  const { run } = useAction();
  const r = rec.data;

  if (!r) return <div className="loading" style={{ minHeight: 500 }} aria-busy="true" />;
  const briefs = [...r.briefs].reverse();

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-6)" }}>
      <ErrorNote error={rec.error} />
      <PageHead
        title="Consult"
        sub="Ask ground a question when you want to. Your flight surgeon sees the same record you do, and you see everything they write."
        actions={
          <>
            <Link to="/consult/ground-view" className="btn btn--secondary btn--lg">
              <Icon name="eye" size={18} /> What ground sees
            </Link>
            <Link to={`/consult/new${r.alert && r.alert.state !== "closed" ? `?alert=${r.alert.id}` : ""}`} className="btn btn--primary btn--lg">
              <Icon name="consult" size={18} /> Ask the flight surgeon
            </Link>
          </>
        }
      />

      {link && (
        <section className="card" aria-label="Ground link">
          <div className="card__body row row--between">
            <div className="row" style={{ ["--gap" as string]: "var(--s-5)" }}>
              <div className="stack" style={{ ["--gap" as string]: "2px" }}>
                <span className="micro">Last sync</span>
                <span className="mono strong">{fmtDayTime(link.lastSync, r.mission)} GMT</span>
              </div>
              <div className="stack" style={{ ["--gap" as string]: "2px" }}>
                <span className="micro">Next link window</span>
                <span className="mono strong">{fmtTime(link.nextWindow)} GMT</span>
              </div>
              <div className="stack" style={{ ["--gap" as string]: "2px" }}>
                <span className="micro">Waiting to send / receive</span>
                <span className="mono strong">
                  {link.pendingToGround} ↑ · {link.pendingFromGround} ↓
                </span>
              </div>
              <div className="stack" style={{ ["--gap" as string]: "2px" }}>
                <span className="micro">Signal delay</span>
                <span className="mono strong">{linkProfile.delayText} one way</span>
              </div>
            </div>
            <button type="button" className="btn btn--secondary btn--lg" onClick={syncNow} disabled={syncing}>
              <Icon name="sync" size={18} /> Sync now (demo)
            </button>
          </div>
          <div className="card__foot">
            <LinkDistance />
          </div>
          <div className="card__foot small muted">
            Everything works offline on the station server. Items wait in a queue and go at the next window, about every {LINK_WINDOW_HOURS.value} h (demo parameter).
          </div>
        </section>
      )}

      <MyReadiness readiness={r.readiness} />

      <section className="section" aria-labelledby="fg-title">
        <h2 id="fg-title">From ground</h2>
        <GroundFeed
          rec={r}
          mission={r.mission}
          perspective="astronaut"
          onAck={(rep, ack) => (ack === "follow-up" ? nav(`/consult/new?followup=${rep.briefId}`) : run(() => api.ackReply(rep.id, ack), "Marked done."))}
        />
      </section>

      <section className="section" aria-labelledby="briefs-title">
        <h2 id="briefs-title">Your questions</h2>
        {briefs.length ? (
          <div className="grid-2">
            {briefs.map((b) => (
              <BriefCard key={b.id} brief={b} mission={r.mission} perspective="astronaut" />
            ))}
          </div>
        ) : (
          <Empty>No questions yet. When an alert comes up, “Ask the flight surgeon” drafts one for you.</Empty>
        )}
      </section>

      <section className="section" aria-labelledby="log-title">
        <div className="section__head">
          <h2 id="log-title">Sync log</h2>
          <span className="small text-2">Every sync to and from ground, with what was sent. Nothing leaves the station without a line here.</span>
        </div>
        {log.data && <SyncLog entries={log.data} mission={r.mission} limit={8} />}
      </section>
    </div>
  );
}
