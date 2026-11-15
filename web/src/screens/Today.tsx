import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { MetricKey, RecordView } from "../api/types";
import { AssistantNote, useAssist } from "../components/assistant";
import { AlertCard, GroundFeed, ReadoutHero } from "../components/record";
import { Icon } from "../components/icons";
import { MarkIcon, StatusIcon } from "../components/status";
import { ErrorNote, SourceTag } from "../components/ui";
import { INDICATORS } from "../content/indicators";
import { ME, useAction, useApp, useQuery } from "../lib/app";
import { fmtNum, fmtPoint, fmtTime } from "../lib/format";
import { buildReplay, MARK_WORD, type Mark } from "../lib/replay";

/** Weekly slot: due when the last reading is this many days old. Demo parameter. */
const WEEKLY_DUE_DAYS = 4;

/**
 * Mission Quest (S4): a gentle streak of completed check-ins. It counts check-ins only, never health
 * values, and reporting a symptom never lowers it (docs/REQUIREMENTS.md U7). A missed day pauses the
 * streak at yesterday instead of showing a failure.
 */
export function Streak({ days, today }: { days: number[]; today: number }) {
  const done = new Set(days);
  let end = done.has(today) ? today : today - 1;
  let streak = 0;
  while (end > 0 && done.has(end)) {
    streak += 1;
    end -= 1;
  }
  const week = Array.from({ length: 7 }, (_, i) => today - 6 + i).filter((d) => d > 0);
  return (
    <section className="card streak" aria-label="Check-in streak">
      <span>
        <b className="strong">
          {streak} {streak === 1 ? "day" : "days"} in a row
        </b>{" "}
        · check-in streak. Counts check-ins only, never your health values.
      </span>
      <ol className="streak__days" aria-label="Last 7 days">
        {week.map((d) => (
          <li key={d} className={done.has(d) ? "is-done" : ""} aria-label={`Day ${d}: ${done.has(d) ? "checked in" : d === today ? "not yet" : "no check-in"}`}>
            {done.has(d) ? "✓" : d}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Today() {
  const { mission } = useApp();
  const nav = useNavigate();
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  const cabin = useQuery(`cabin-${ME}-a`, () => api.getCabin(ME, "astronaut"));
  const { run, busy } = useAction();
  const explain = useAssist();
  const [question, setQuestion] = useState("");
  const r = rec.data;
  // One mark per mission day for the replay entry: was anything outside the usual band that day?
  const ribbon = useMemo(() => {
    if (!r) return [];
    const rp = buildReplay(r, cabin.data ?? null, []);
    return Array.from({ length: rp.days }, (_, i) => {
      const day = i + 1;
      const h = rp.headache[i];
      const marks = rp.series.map((x) => rp.markOf(x.key, day));
      const mark: Mark = day <= rp.calibrationDays ? "learning" : marks.includes("out") || (h != null && h !== "none") ? "out" : "in";
      return { day, mark };
    });
  }, [r, cabin.data]);

  if (!r || !mission) return <div className="loading" style={{ minHeight: 400 }} aria-busy="true" />;

  const ind = (k: MetricKey) => r.indicators.find((i) => i.key === k)!;
  const sleep = ind("sleep");
  const hr = ind("hr");
  const co2 = cabin.data?.co2[cabin.data.co2.length - 1];
  const weeklyDue = (["bp", "glucose", "temp"] as MetricKey[]).filter((k) => {
    const l = ind(k).latest;
    return !l || Math.floor((Date.parse(r.mission.now) - Date.parse(l.t)) / 86_400_000) >= WEEKLY_DUE_DAYS;
  });
  const openAlert = r.alert && r.alert.state !== "closed" ? r.alert : null;

  function ask(e: FormEvent) {
    e.preventDefault();
    if (question.trim()) nav(`/ask?q=${encodeURIComponent(question.trim())}`);
  }
  const suggestions = [openAlert ? "Why did this alert come up?" : "How has my sleep been this week?", "What did ground write about me?"];

  async function sameAsYesterday() {
    await run(() => api.postCheckIn(ME, { sameAsYesterday: true, rested: null, headache: null, mood: null, vision: null }), "Check-in saved: same as yesterday.");
  }

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={rec.error} />
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div className="page-head__title">
          <span className="micro">
            {r.mission.name} · mission day {r.mission.day} · {fmtTime(mission.now)} GMT
          </span>
          <h1>Today</h1>
        </div>
        <Link to="/consult/ground-view" className="btn btn--ghost">
          <Icon name="eye" size={18} /> What ground sees
        </Link>
      </div>

      <div className="today-top">
        <div className="stack">
      {!r.readout.checkInDone ? (
        <section className="card" aria-labelledby="ci-title">
          <div className="card__body" style={{ display: "grid", gap: "var(--s-5)", gridTemplateColumns: "minmax(0,1fr)" }}>
            <div className="row row--between row--top">
              <div className="stack" style={{ ["--gap" as string]: "6px", maxWidth: 560 }}>
                <span className="micro">Morning check-in · about 20 seconds</span>
                <h2 id="ci-title" style={{ fontSize: 26 }}>
                  How are you this morning?
                </h2>
                <p className="text-2">Four quick questions, or one tap if nothing changed since yesterday. Any question can be skipped.</p>
              </div>
              <div className="passive-strip" aria-label="Already measured by your wearable">
                <div className="passive-strip__item">
                  <span className="micro">Sleep last night</span>
                  <b>
                    {fmtPoint("sleep", sleep.latest)} <span className="small text-2">h</span>
                  </b>
                </div>
                <div className="passive-strip__item">
                  <span className="micro">Resting HR</span>
                  <b>
                    {fmtPoint("hr", hr.latest)} <span className="small text-2">bpm</span>
                  </b>
                </div>
                <div className="passive-strip__item" style={{ justifyContent: "flex-end" }}>
                  <SourceTag source="sim" />
                  <span className="small muted">From your wearable</span>
                </div>
              </div>
            </div>
            <div className="row">
              <button type="button" className="btn btn--primary btn--lg" onClick={() => nav("/checkin")}>
                Start check-in
                <Icon name="arrow-right" size={18} />
              </button>
              <button type="button" className="btn btn--secondary btn--lg" onClick={sameAsYesterday} disabled={busy}>
                <Icon name="check" size={18} />
                Same as yesterday
              </button>
            </div>
          </div>
        </section>
      ) : (
        <ReadoutHero readout={r.readout} />
      )}

      <Streak days={r.checkIns.map((c) => c.day)} today={r.mission.day} />
        </div>
        <aside className="stack" aria-labelledby="glance-title">
          <h2 id="glance-title" className="sr-only">
            At a glance
          </h2>
          <div className="glance">
            <Glance to="/health/sleep" label="Sleep last night" value={fmtPoint("sleep", sleep.latest)} unit="h" r={r} k="sleep" />
            <Glance to="/health/hr" label="Resting heart rate" value={fmtPoint("hr", hr.latest)} unit="bpm" r={r} k="hr" />
            <Link to="/cabin" className="stat">
              <span className="micro">Cabin CO2 now · {r.mission.module}</span>
              <span className="stat__value">
                {co2 ? fmtNum(co2.v) : "–"}
                <small>ppm</small>
              </span>
              <span className="stat__sub">
                {cabin.data && co2 && co2.v > cabin.data.usual.high ? (
                  <>
                    <StatusIcon status="watch" /> Above the module's usual {fmtNum(cabin.data.usual.low)}–{fmtNum(cabin.data.usual.high)}
                  </>
                ) : (
                  <>
                    <StatusIcon status="ok" /> In the module's usual range
                  </>
                )}
              </span>
            </Link>
          </div>
        </aside>
      </div>

      {openAlert && (
        <AlertCard
          alert={openAlert}
          mission={r.mission}
          actions={
            <>
              <Link to={`/consult/new?alert=${openAlert.id}`} className="btn btn--primary btn--lg">
                <Icon name="consult" size={18} /> Ask the flight surgeon
              </Link>
              <Link to="/cabin" className="btn btn--secondary btn--lg">
                <Icon name="cabin" size={18} /> See cabin CO2
              </Link>
              <button type="button" className="btn btn--secondary btn--lg" onClick={() => explain.run("explain_alert", { rec: r, cabin: cabin.data ?? null })} disabled={explain.busy}>
                <Icon name="ask" size={18} /> Why this alert?
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => run(() => api.closeAlert(openAlert.id), "Alert closed. Ground sees it at the next link.")}>
                Close alert
              </button>
            </>
          }
        />
      )}

      {openAlert && <AssistantNote result={explain.result} busy={explain.busy} title="Why this alert" />}

      <div className="tools">
        <form className="tool" onSubmit={ask} role="search" aria-labelledby="ask-title">
          <span className="micro">Ask my record</span>
          <span id="ask-title" className="tool__title">
            Ask about your own data, get days and values back
          </span>
          <div className="ask">
            <Icon name="ask" size={20} />
            <label className="sr-only" htmlFor="today-ask">
              Your question
            </label>
            <input id="today-ask" className="ask__input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How has my sleep been this week?" maxLength={400} autoComplete="off" />
            <button type="submit" className="btn btn--primary" disabled={!question.trim()}>
              Ask
            </button>
          </div>
          <div className="row">
            {suggestions.map((q) => (
              <Link key={q} to={`/ask?q=${encodeURIComponent(q)}`} className="btn btn--secondary">
                {q}
              </Link>
            ))}
          </div>
        </form>
        <Link to="/replay?play=1" className="tool" aria-label="Mission replay: play the mission day by day">
          <span className="micro">Mission replay</span>
          <span className="tool__title">
            <Icon name="play" size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Play the mission, day by day
          </span>
          <div className="ribbon" aria-hidden="true">
            {ribbon.map((d) => (
              <span key={d.day} className={`ribbon__day${d.mark === "out" ? " ribbon__day--out" : ""}`} title={`Day ${d.day}: ${MARK_WORD[d.mark].toLowerCase()}`}>
                <MarkIcon mark={d.mark} size={10} />
                {d.day}
              </span>
            ))}
          </div>
          <span className="small text-2">Body map, cabin CO2, headaches, sleep and heart rate under one playhead.</span>
        </Link>
      </div>

      {weeklyDue.length > 0 && (
        <section className="card" aria-labelledby="weekly-title">
          <div className="card__body row row--between">
            <div className="row" style={{ ["--gap" as string]: "14px", flexWrap: "nowrap" }}>
              <span className="avatar avatar--lg" aria-hidden="true">
                <Icon name="clock" size={20} />
              </span>
              <div>
                <span className="micro">Weekly slot · about {weeklyDue.reduce((a, k) => a + (INDICATORS[k].minutes ?? 0), 0)} min</span>
                <h2 id="weekly-title" style={{ fontSize: "var(--fs-h3)" }}>
                  Weekly measurements: {weeklyDue.map((k) => INDICATORS[k].label.toLowerCase()).join(", ")}
                </h2>
                <p className="text-2 small">Keeps your baseline fresh. Each one has a short how-to. Do it when it fits your day.</p>
              </div>
            </div>
            <Link to={`/measure?metrics=${weeklyDue.join(",")}`} className="btn btn--secondary btn--lg">
              Start measurements
            </Link>
          </div>
        </section>
      )}

      <div className="grid-main-side">
        <section className="section" aria-labelledby="ground-title">
          <div className="section__head">
            <h2 id="ground-title">From ground</h2>
            <Link to="/consult" className="btn btn--ghost">
              All consults <Icon name="chevron-right" size={16} />
            </Link>
          </div>
          <GroundFeed rec={r} mission={r.mission} perspective="astronaut" limit={3} onAck={(rep, ack) => (ack === "follow-up" ? nav(`/consult/new?followup=${rep.briefId}`) : run(() => api.ackReply(rep.id, ack), "Marked done."))} />
        </section>

        <aside className="section" aria-labelledby="worth-title" style={{ marginTop: 0 }}>
          <div className="section__head">
            <h2 id="worth-title">Worth checking</h2>
          </div>
          {r.worthChecking.length === 0 && <div className="empty">Nothing else is outside your usual range.</div>}
          {r.worthChecking.length > 0 && (
            <div className="kv-list" style={{ background: "var(--c-surface)" }}>
              {r.worthChecking.map((w) => (
                <Link key={w.id} to={w.ref?.kind === "metric" ? `/health/${w.ref.key}` : "/health"} className="kv-row">
                  <span className="row" style={{ ["--gap" as string]: "10px", flexWrap: "nowrap" }}>
                    <StatusIcon status="watch" />
                    <span className="small">{w.title}</span>
                  </span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Glance({ to, label, value, unit, r, k }: { to: string; label: string; value: string; unit: string; r: RecordView; k: MetricKey }) {
  const ind = r.indicators.find((i) => i.key === k)!;
  return (
    <Link to={to} className="stat">
      <span className="micro">{label}</span>
      <span className="stat__value">
        {value}
        <small>{unit}</small>
      </span>
      <span className="stat__sub">
        <StatusIcon status={ind.status} /> {ind.statusText}
      </span>
    </Link>
  );
}
