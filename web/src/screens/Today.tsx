import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { MetricKey, RecordView } from "../api/types";
import { AlertCard, GroundFeed, ReadoutHero } from "../components/record";
import { Icon } from "../components/icons";
import { StatusIcon } from "../components/status";
import { ErrorNote, SourceTag } from "../components/ui";
import { INDICATORS } from "../content/indicators";
import { ME, useAction, useApp, useQuery } from "../lib/app";
import { fmtNum, fmtPoint, fmtTime } from "../lib/format";

/** Weekly slot: due when the last reading is this many days old. Demo parameter. */
const WEEKLY_DUE_DAYS = 4;

export function Today() {
  const { mission } = useApp();
  const nav = useNavigate();
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  const cabin = useQuery(`cabin-${ME}-a`, () => api.getCabin(ME, "astronaut"));
  const { run, busy } = useAction();
  const r = rec.data;

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
              <button type="button" className="btn btn--ghost" onClick={() => run(() => api.closeAlert(openAlert.id), "Alert closed. Ground sees it at the next link.")}>
                Close alert
              </button>
            </>
          }
        />
      )}

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

        <aside className="section" aria-labelledby="glance-title">
          <h2 id="glance-title">At a glance</h2>
          <div className="stat-strip" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
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
