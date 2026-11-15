import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { HeadacheStrip, PointTable, TrendChart } from "../components/charts";
import { Icon } from "../components/icons";
import { StatusIcon } from "../components/status";
import { DemoTag, ErrorNote, PageHead, SourceTag } from "../components/ui";
import { ME, useApp, useQuery } from "../lib/app";
import { fmtDayTime, fmtNum } from "../lib/format";
import { missionWindow } from "../lib/mission";

/**
 * Cabin Link (S1): cabin CO2 next to headaches from check-ins. Two charts on a
 * shared time axis (small multiples), never a dual axis. Wording stays
 * "a pattern to check, not a cause".
 */
export function Cabin() {
  const { id } = useParams();
  const { role, mission } = useApp();
  const crewId = id ?? ME;
  const cabin = useQuery(`cabin-${crewId}-${role}`, () => api.getCabin(crewId, role));
  const [table, setTable] = useState(false);
  const d = cabin.data;

  if (!d || !mission) return <div className="loading" style={{ minHeight: 500 }} aria-busy="true" />;
  const win = missionWindow(mission);
  const pts = d.co2.map((p) => ({ t: Date.parse(p.t), v: p.v, source: p.source }));
  const latest = d.co2[d.co2.length - 1];
  const heads = d.headaches.map((h) => ({ ...h, t: Date.parse(h.t) }));

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={cabin.error} />
      <PageHead
        crumb={
          role === "ground" ? (
            <Link to={`/ground/crew/${crewId}`} className="crumb">
              <Icon name="chevron-left" size={16} /> Record
            </Link>
          ) : undefined
        }
        title="Cabin Link"
        sub={`When symptoms follow cabin CO2 in ${d.module}. A pattern to check, not a cause.`}
        actions={
          <div className="stat-strip" style={{ gridTemplateColumns: "repeat(2, minmax(140px, 1fr))" }}>
            <div className="stat">
              <span className="micro">CO2 now</span>
              <span className="stat__value">
                {latest ? fmtNum(latest.v) : "–"}
                <small>ppm</small>
              </span>
            </div>
            <div className="stat">
              <span className="micro">Module usual</span>
              <span className="stat__value" style={{ fontSize: 20 }}>
                {fmtNum(d.usual.low)}–{fmtNum(d.usual.high)}
              </span>
            </div>
          </div>
        }
      />

      <div className="grid-main-side">
        <section className="card" aria-labelledby="co2-title">
          <header className="card__head">
            <div className="stack" style={{ ["--gap" as string]: "2px" }}>
              <span className="micro">Mission so far · last {d.days} days at most</span>
              <h2 id="co2-title" style={{ fontSize: "var(--fs-h3)" }}>
                Cabin CO2 and headaches
              </h2>
            </div>
            <div className="row">
              <SourceTag source="sim" />
              <button type="button" className="btn btn--ghost" onClick={() => setTable(!table)} aria-pressed={table}>
                <Icon name="log" size={16} /> {table ? "Show chart" : "Show as table"}
              </button>
            </div>
          </header>
          <div className="card__body stack">
            {table ? (
              <PointTable unit="ppm" rows={[...d.co2].reverse().map((p) => ({ when: `${fmtDayTime(p.t, mission)} GMT`, value: fmtNum(p.v), source: "Simulated" }))} />
            ) : (
              <div>
                <TrendChart
                  label="Cabin CO2 in parts per million, last 14 days"
                  points={pts}
                  xDomain={win.domain}
                  ticks={win.ticks}
                  unit="ppm"
                  decimals={0}
                  band={{ low: d.usual.low, high: d.usual.high, label: "Module usual" }}
                  threshold={{ value: d.limit.value, label: `Limit ${d.limit.label} · demo parameter` }}
                  shadeAbove
                  showDots={false}
                  height={280}
                  formatTime={(t) => `${win.fmt(t)} GMT`}
                />
                <HeadacheStrip items={heads} xDomain={win.domain} ticks={win.ticks} formatTime={(t) => win.fmt(t)} />
              </div>
            )}
            <div className="legend">
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--line" /> CO2, ppm
              </span>
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--band" /> Module usual range
              </span>
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--limit" /> Limit (demo parameter)
              </span>
              <span className="legend__item">
                <svg width="14" height="12" aria-hidden="true">
                  <path d="M7 1 L13 11 L1 11 Z" fill="var(--c-text-strong)" />
                </svg>
                Headache from check-in, size = strength
              </span>
            </div>
            <p className="small muted" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <DemoTag /> {d.limit.source}
            </p>
          </div>
        </section>

        <aside className="stack">
          <section className="card" aria-labelledby="pattern-title">
            <header className="card__head">
              <h2 id="pattern-title" style={{ fontSize: "var(--fs-h3)" }}>
                {d.pattern?.found ? "Pattern found" : "No pattern right now"}
              </h2>
              <StatusIcon status={d.pattern?.found ? "watch" : "ok"} size={16} />
            </header>
            <div className="card__body stack">
              <p>{d.pattern?.text ?? "No headaches in the last 3 days. The app keeps watching CO2 and your check-ins."}</p>
              <p className="small muted">A pattern to check, not a cause. Other things, such as short sleep, can also bring on headaches.</p>
            </div>
          </section>
          <section className="card" aria-labelledby="try-title">
            <header className="card__head">
              <h2 id="try-title" style={{ fontSize: "var(--fs-h3)" }}>
                Things to try
              </h2>
            </header>
            <div className="card__body">
              <ol className="stack" style={{ ["--gap" as string]: "10px", paddingLeft: 18 }}>
                <li>Ask for a ventilation check in {d.module}.</li>
                <li>Take breaks and sleep in a better-ventilated module if you can.</li>
                <li>Keep answering the headache question in the check-in, so the app can tell when it stops.</li>
              </ol>
            </div>
          </section>
          <div className="contact-box">
            <span className="micro" style={{ display: "block", marginBottom: 4 }}>
              Contact the flight surgeon if
            </span>
            The headache is strong, or comes with vision changes.
          </div>
          {role === "astronaut" && (
            <Link to="/consult/new" className="btn btn--secondary btn--lg btn--block">
              <Icon name="consult" size={18} /> Ask the flight surgeon
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
