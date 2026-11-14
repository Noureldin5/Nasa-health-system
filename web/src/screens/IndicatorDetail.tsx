import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { MetricKey, RecordView } from "../api/types";
import { PointTable, TrendChart } from "../components/charts";
import { GroundActions } from "../components/GroundActions";
import { Icon } from "../components/icons";
import { StatusPill } from "../components/status";
import { DemoTag, ErrorNote, SourceTag } from "../components/ui";
import { HAZARDS } from "../content/hazards";
import { RISKS_FOR_METRIC, RISK_PAGES } from "../content/risks";
import { INDICATORS } from "../content/indicators";
import { DISCLAIMER } from "../content/sources";
import { ME, useApp, useQuery } from "../lib/app";
import { fmtDayTime, fmtNum, fmtPoint, fmtUsual, sourceLabel } from "../lib/format";
import { missionWindow } from "../lib/mission";

export function IndicatorDetail() {
  const { metric, id } = useParams();
  const { role } = useApp();
  const crewId = id ?? ME;
  const key = metric as MetricKey;
  const c = INDICATORS[key];
  const rec = useQuery(`${role}-${crewId}`, () => (role === "ground" ? api.getGroundView(crewId) : api.getAstronautView(crewId)));
  const [table, setTable] = useState(false);

  if (!c) return <p>Unknown indicator.</p>;
  const r = rec.data;
  const back = role === "ground" ? `/ground/crew/${crewId}` : "/health";

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={rec.error} />
      <Link to={back} className="crumb">
        <Icon name="chevron-left" size={16} /> {role === "ground" ? r?.crew.name ?? "Record" : "Body & vitals"}
      </Link>
      {!r ? (
        <div className="loading" style={{ minHeight: 500 }} aria-busy="true" />
      ) : (
        <Detail r={r} k={key} table={table} setTable={setTable} role={role} crewId={crewId} />
      )}
    </div>
  );
}

function Detail({ r, k, table, setTable, role, crewId }: {
  r: RecordView;
  k: MetricKey;
  table: boolean;
  setTable: (v: boolean) => void;
  role: "astronaut" | "ground";
  crewId: string;
}) {
  const c = INDICATORS[k];
  const ind = r.indicators.find((i) => i.key === k)!;
  const win = missionWindow(r.mission);
  const b = ind.baseline;
  const usual = fmtUsual(ind);
  const notes = r.notes.filter((n) => n.target.kind === "metric" && n.target.key === k);
  const flags = r.flags.filter((f) => f.metric === k && f.active);
  const pts = ind.series.map((p) => ({ t: Date.parse(p.t), v: p.v, v2: p.v2, source: p.source }));
  const canMeasure = role === "astronaut" && (c.cadence === "weekly" || k === "hr");

  return (
    <>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div className="page-head__title">
          <span className="micro">
            {role === "ground" ? `${r.crew.name} · as of last sync` : "Indicator"} · {c.cadenceText}
          </span>
          <div className="row" style={{ ["--gap" as string]: "14px" }}>
            <h1>{c.label}</h1>
            <StatusPill status={ind.status} size="lg" />
          </div>
          <p className="text-2">{ind.statusText}</p>
        </div>
        <div className="row row--top" style={{ ["--gap" as string]: "var(--s-5)" }}>
          <div className="stack" style={{ ["--gap" as string]: "2px" }}>
            <span className="micro">Latest</span>
            <span className="mono" style={{ fontSize: 40, fontWeight: 500, color: "var(--c-text-strong)", lineHeight: 1 }}>
              {fmtPoint(k, ind.latest)} <span style={{ fontSize: 15, color: "var(--c-text-2)" }}>{c.unit}</span>
            </span>
            {ind.latest && (
              <span className="small muted">
                {fmtDayTime(ind.latest.t, r.mission)} GMT · {sourceLabel(ind.latest.source)}
              </span>
            )}
          </div>
          <div className="stack" style={{ ["--gap" as string]: "2px" }}>
            <span className="micro">{role === "ground" ? "Their" : "Your"} usual</span>
            <span className="mono" style={{ fontSize: 22, color: "var(--c-text)", lineHeight: 1.2 }}>
              {usual ?? "Learning"}
            </span>
            <span className="small muted">{b.state === "ready" ? `Learned from ${b.n} readings` : `Day ${b.day} of ${b.of}`}</span>
          </div>
        </div>
      </div>

      <div className="grid-main-side">
        <div className="stack">
          <section className="card" aria-labelledby="trend-title">
            <header className="card__head">
              <div className="stack" style={{ ["--gap" as string]: "2px" }}>
                <span className="micro">Trend · last 14 days</span>
                <h2 id="trend-title" style={{ fontSize: "var(--fs-h3)" }}>
                  {c.label} against {role === "ground" ? "their" : "your"} baseline
                </h2>
              </div>
              <div className="row">
                <SourceTag source={ind.source} />
                <button type="button" className="btn btn--ghost" onClick={() => setTable(!table)} aria-pressed={table}>
                  <Icon name="log" size={16} /> {table ? "Show chart" : "Show as table"}
                </button>
              </div>
            </header>
            <div className="card__body stack">
              {table ? (
                <PointTable
                  unit={c.unit}
                  rows={[...ind.series].reverse().map((p) => ({ when: `${fmtDayTime(p.t, r.mission)} GMT`, value: fmtPoint(k, p), source: sourceLabel(p.source) }))}
                />
              ) : (
                <TrendChart
                  label={`${c.label}, last 14 days`}
                  points={pts}
                  xDomain={win.domain}
                  ticks={win.ticks}
                  kind={k === "bp" ? "range" : "line"}
                  unit={c.unit}
                  decimals={c.decimals}
                  band={b.state === "ready" ? { low: b.low, high: b.high, label: k === "bp" ? "Usual systolic" : "Usual range" } : null}
                  band2={b.state === "ready" && b.low2 != null ? { low: b.low2, high: b.high2!, label: "Usual diastolic" } : null}
                  lastStatus={ind.status}
                  formatTime={(t) => `${win.fmt(t)} GMT`}
                  yFloor={k === "mood" ? 0.5 : undefined}
                  yCeil={k === "mood" ? 5.5 : undefined}
                />
              )}
              <div className="legend">
                <span className="legend__item">
                  <span className="legend__swatch legend__swatch--line" /> {k === "bp" ? "Reading, systolic to diastolic" : "Reading"}
                </span>
                <span className="legend__item">
                  <span className="legend__swatch legend__swatch--band" /> {role === "ground" ? "Their" : "Your"} usual range
                </span>
                <span className="legend__item muted">Latest point carries the status shape and color</span>
              </div>
              <p className="small muted" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <DemoTag /> {b.method}
              </p>
            </div>
          </section>

          {(notes.length > 0 || flags.length > 0) && (
            <section className="card" aria-labelledby="notes-title">
              <header className="card__head">
                <h2 id="notes-title" style={{ fontSize: "var(--fs-h3)" }}>
                  From ground on this indicator
                </h2>
              </header>
              <div className="card__body feed">
                {flags.map((f) => (
                  <div key={f.id} className={`feed-item${f.deliveredAt ? "" : " feed-item--queued"}`}>
                    <span className="avatar">
                      <Icon name="flag" size={18} />
                    </span>
                    <div>
                      <div className="feed-item__meta">
                        <b>Watch flag</b> · {f.author.name}, {fmtDayTime(f.createdAt, r.mission)}
                        {!f.deliveredAt && <span className="tag tag--queued">Queued for uplink</span>}
                      </div>
                      <p className="feed-item__text">{f.reason}</p>
                    </div>
                  </div>
                ))}
                {notes.map((n) => (
                  <div key={n.id} className={`feed-item${n.deliveredAt ? "" : " feed-item--queued"}`}>
                    <span className="avatar">
                      <Icon name="note" size={18} />
                    </span>
                    <div>
                      <div className="feed-item__meta">
                        <b>Note</b> · {n.author.name}, {fmtDayTime(n.createdAt, r.mission)}
                        {!n.deliveredAt && <span className="tag tag--queued">Queued for uplink</span>}
                      </div>
                      <p className="feed-item__text">{n.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {role === "ground" && <GroundActions crewId={crewId} crewName={r.crew.shortName} metric={k} />}
        </div>

        <aside className="stack">
          {canMeasure && (
            <Link to={`/measure?metrics=${k}`} className="btn btn--primary btn--lg btn--block">
              <Icon name="plus" size={18} /> Add a reading
            </Link>
          )}
          <section className="card card--pad stack">
            <span className="micro">What it is</span>
            <p>{c.what}</p>
            <span className="micro">Why it matters</span>
            <p className="text-2">{c.why}</p>
          </section>
          <section className="card card--pad stack">
            <span className="micro">How to measure</span>
            <ol className="stack" style={{ ["--gap" as string]: "8px", paddingLeft: 18 }}>
              {c.howTo.map((s) => (
                <li key={s} className="small">
                  {s}
                </li>
              ))}
            </ol>
          </section>
          <section className="card card--pad stack">
            <span className="micro">How spaceflight affects it</span>
            <ul className="hazard-list">
              {c.hazards.map((h) => (
                <li key={h.hazard}>
                  <span>{HAZARDS[h.hazard].name}</span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card card--pad stack" aria-label="NASA sources">
            <span className="micro">Read more at NASA</span>
            <ul className="stack" style={{ ["--gap" as string]: "6px", listStyle: "none" }}>
              {RISKS_FOR_METRIC[k].map((r) => (
                <li key={r} className="small">
                  <a href={RISK_PAGES[r].url} target="_blank" rel="noreferrer">
                    NASA HRP: {RISK_PAGES[r].title}
                  </a>
                </li>
              ))}
            </ul>
            <p className="small muted">Which page goes with this measurement is our pairing, not NASA's. Opens online; the app works offline without it.</p>
          </section>
          <div className="contact-box">
            <span className="micro" style={{ display: "block", marginBottom: 4 }}>
              Contact the flight surgeon if
            </span>
            {c.contactIf.charAt(0).toUpperCase() + c.contactIf.slice(1)}
          </div>
          <p className="small muted">
            {DISCLAIMER} {k === "mood" ? "Self-reported in the check-in." : ""} {b.state === "ready" ? `Band ${fmtNum(b.low, c.decimals)}–${fmtNum(b.high, c.decimals)} ${c.unit}.` : ""}
          </p>
        </aside>
      </div>
    </>
  );
}
