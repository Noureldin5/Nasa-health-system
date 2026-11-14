import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { Brief, RecordView } from "../../api/types";
import { Dashboard } from "../../components/Dashboard";
import { GroundActions } from "../../components/GroundActions";
import { Icon } from "../../components/icons";
import { AlertCard, BriefCard, GroundFeed, ReadoutHero } from "../../components/record";
import { StatusPill } from "../../components/status";
import { ErrorNote } from "../../components/ui";
import { MOOD_WORDS, RESTED_WORDS } from "../../content/indicators";
import { useAction, useQuery } from "../../lib/app";
import { fmtDayTime } from "../../lib/format";

/** Flight surgeon's view of one astronaut (D7): brief on top of the full record, reply, notes. */
export function GroundRecord() {
  const { id = "a1" } = useParams();
  const rec = useQuery(`ground-${id}`, () => api.getGroundView(id));
  const r = rec.data;

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={rec.error} />
      <Link to="/ground" className="crumb">
        <Icon name="chevron-left" size={16} /> Crew
      </Link>
      {!r ? (
        <div className="loading" style={{ minHeight: 600 }} aria-busy="true" />
      ) : (
        <>
          <div className="page-head" style={{ marginBottom: 0 }}>
            <div className="row" style={{ ["--gap" as string]: "14px" }}>
              <span className="avatar avatar--lg">{r.crew.initials}</span>
              <div className="page-head__title">
                <span className="micro">
                  {r.crew.role} · {r.mission.name}
                </span>
                <div className="row">
                  <h1>{r.crew.name}</h1>
                  <StatusPill status={r.crew.status} label={r.crew.statusText} size="lg" />
                </div>
              </div>
            </div>
            <Link to={`/ground/crew/${id}/cabin`} className="btn btn--secondary">
              <Icon name="cabin" size={18} /> Cabin Link
            </Link>
          </div>
          <div className="banner">
            <Icon name="antenna" size={18} />
            <span>
              <b>Last sync: {fmtDayTime(r.asOf, r.mission)} GMT.</b> Data on this screen is as of then, not live. {r.crew.shortName} sees this same record and everything you write.
            </span>
          </div>
          <RecordBody rec={r} metricHref={(m) => `/ground/crew/${id}/${m}`} />
        </>
      )}
    </div>
  );
}

/** Shared by the ground record and the astronaut's "What ground sees". */
export function RecordBody({ rec, readOnly = false, metricHref }: { rec: RecordView; readOnly?: boolean; metricHref: (m: string) => string }) {
  const waiting = rec.briefs.filter((b) => b.status === "delivered");
  const answered = rec.briefs.filter((b) => b.status === "answered").reverse();

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-6)" }}>
      {waiting.length > 0 && (
        <section className="section" aria-labelledby="waiting-title">
          <h2 id="waiting-title">Question waiting for a reply</h2>
          {waiting.map((b) => (
            <BriefCard key={b.id} brief={b} mission={rec.mission} perspective="ground">
              {!readOnly && <ReplyBox brief={b} name={rec.crew.shortName} />}
            </BriefCard>
          ))}
        </section>
      )}

      <section className="section" aria-labelledby="latest-title">
        <h2 id="latest-title">Latest readout</h2>
        <ReadoutHero readout={rec.readout} />
        {!rec.readout.checkInDone && <p className="small text-2">No check-in from day {rec.readout.day} on ground yet. Skipping a day is fine and never flagged.</p>}
        {rec.alert && <AlertCard alert={rec.alert} mission={rec.mission} perspective="ground" />}
      </section>

      {!readOnly && <GroundActions crewId={rec.crew.id} crewName={rec.crew.shortName} />}

      <Dashboard rec={rec} metricHref={metricHref} canLog={false} />

      <section className="section" aria-labelledby="ci-title">
        <h2 id="ci-title">Check-ins</h2>
        <div className="table-scroll" style={{ maxHeight: 360 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Rested</th>
                <th>Headache</th>
                <th>Mood</th>
                <th>Vision change</th>
                <th>How</th>
              </tr>
            </thead>
            <tbody>
              {[...rec.checkIns].reverse().map((c) => (
                <tr key={c.id}>
                  <td className="num">{fmtDayTime(c.t, rec.mission)}</td>
                  <td>{c.rested ? RESTED_WORDS[c.rested - 1] : <span className="muted">Skipped</span>}</td>
                  <td>{c.headache ?? <span className="muted">Skipped</span>}</td>
                  <td>{c.mood ? MOOD_WORDS[c.mood - 1] : <span className="muted">Skipped</span>}</td>
                  <td>{c.vision ?? <span className="muted">Skipped</span>}</td>
                  <td className="muted">{c.sameAsYesterday ? "Same as yesterday" : "4 questions"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" aria-labelledby="written-title">
        <h2 id="written-title">Written by ground</h2>
        <GroundFeed rec={rec} mission={rec.mission} perspective="ground" />
      </section>

      {answered.length > 0 && (
        <section className="section" aria-labelledby="answered-title">
          <h2 id="answered-title">Earlier questions</h2>
          <div className="grid-2">
            {answered.map((b) => (
              <BriefCard key={b.id} brief={b} mission={rec.mission} perspective="ground" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ReplyBox({ brief, name }: { brief: Brief; name: string }) {
  const [text, setText] = useState("");
  const { run, busy } = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await run(() => api.postReply(brief.id, text), "Reply queued. It reaches the astronaut at the next link.");
    setText("");
  }
  return (
    <form className="stack" style={{ ["--gap" as string]: "10px" }} onSubmit={submit}>
      <label className="field">
        <span className="field__label">Your reply</span>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Worth watching. The CO2 pattern fits. Ask for the ventilation check, and add a temperature reading so we can rule out a fever. Your call on the rest."
        />
        <span className="field__hint">Advice to a colleague, not an order. {name} sees it word for word, with your name.</span>
      </label>
      <button type="submit" className="btn btn--primary btn--lg" disabled={busy || !text.trim()} style={{ alignSelf: "flex-start" }}>
        <Icon name="antenna" size={18} /> Send reply at next link
      </button>
    </form>
  );
}
