import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { assistantStatus, citeLabel, sendLog, type AiResult, type AiStatus } from "../ai/assistant";
import type { CiteKey, RecordCtx } from "../ai/facts";
import { api } from "../api/client";
import type { MetricKey } from "../api/types";
import { AssistantNote, citeHref, useAssist } from "../components/assistant";
import { HeadacheStrip, TrendChart } from "../components/charts";
import { Icon } from "../components/icons";
import { ErrorNote, PageHead } from "../components/ui";
import { INDICATORS } from "../content/indicators";
import { ME, useApp, useQuery } from "../lib/app";
import { daySpan, missionWindow } from "../lib/mission";

/**
 * "Ask my record": a free question about your own data. The answer cites days and values, and the
 * same days light up on the charts next to it. The model only restates facts the app computed;
 * red-flag questions get the rule-based text. Astronaut side only, so ground never reads assistant
 * text about you that you cannot see.
 */
export function Ask() {
  const [params, setParams] = useSearchParams();
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  const cabin = useQuery(`cabin-${ME}-a`, () => api.getCabin(ME, "astronaut"));
  const [status, setStatus] = useState<AiStatus | null | undefined>(undefined);
  const [text, setText] = useState(params.get("q") ?? "");
  const [asked, setAsked] = useState<string | null>(null);
  const { result, busy, run } = useAssist();
  const { linkProfile } = useApp();
  const started = useRef(false);
  // Every send to the model is listed (open record). Re-read after each answer.
  const sends = useMemo(() => sendLog(), [result]);

  const ctx: RecordCtx | null = useMemo(() => (rec.data ? { rec: rec.data, cabin: cabin.data ?? null } : null), [rec.data, cabin.data]);

  useEffect(() => {
    assistantStatus().then(setStatus);
  }, []);

  function ask(q: string) {
    const question = q.trim();
    if (!question || !ctx) return;
    setAsked(question);
    setText(question);
    setParams({ q: question }, { replace: true });
    void run("ask", ctx, { question });
  }

  // A question handed over in the URL (from Today or the guided demo) is asked once the record is in.
  useEffect(() => {
    const q = params.get("q");
    if (q && ctx && cabin.data && !started.current) {
      started.current = true;
      ask(q);
    }
  });

  const r = rec.data;
  const suggestions = r
    ? [
        ...(r.alert && r.alert.state !== "closed" ? ["Why did this alert come up?"] : []),
        "How has my sleep been this week?",
        "Is my resting heart rate different from my usual?",
        "Did cabin CO2 change on the days I had a headache?",
        "What did ground write about me?",
      ].slice(0, 4)
    : [];

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(text);
  }

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={rec.error} />
      <PageHead title="Ask my record" sub="Ask about your own data in your own words. The answer points at days and values, and the charts light up where it points." />

      <div className="grid-main-side">
        <div className="stack">
          <form className="ask" onSubmit={submit} role="search" aria-label="Ask my record">
            <Icon name="ask" size={22} />
            <label className="sr-only" htmlFor="ask-q">
              Your question
            </label>
            <input id="ask-q" className="ask__input" value={text} onChange={(e) => setText(e.target.value)} placeholder="How has my sleep been this week?" maxLength={400} autoComplete="off" autoFocus />
            <button type="submit" className="btn btn--primary btn--lg" disabled={!text.trim() || !ctx || busy}>
              {busy ? "Reading" : "Ask"}
            </button>
          </form>
          <div className="row" role="group" aria-label="Suggested questions">
            {suggestions.map((s) => (
              <button key={s} type="button" className="btn btn--secondary" onClick={() => ask(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>

          {asked && (
            <section className="stack" aria-label="Answer">
              <p className="ask__q">
                <span className="micro">You asked</span>
                {asked}
              </p>
              <AssistantNote result={busy ? null : result} busy={busy}>
                {result?.source === "rule" && (
                  <Link to="/consult/new" className="btn btn--primary btn--lg" style={{ justifySelf: "start" }}>
                    <Icon name="consult" size={18} /> Ask the flight surgeon
                  </Link>
                )}
              </AssistantNote>
              {!busy && result && ctx && <Evidence result={result} ctx={ctx} />}
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="card card--pad stack" aria-label="How the assistant works">
            <span className="micro">How it works</span>
            <ul className="rules">
              <li>It reads only facts this app already computed from your record: values, your usual ranges, statuses, ground's notes.</li>
              <li>It restates them in plain words. It does not diagnose, name medicines or doses, or change a status.</li>
              <li>Strong symptoms and questions about medicines get a fixed answer: contact the flight surgeon.</li>
              <li>The numbers on the chips are read from your record, not from the model's text.</li>
            </ul>
          </section>
          <section className="card card--pad stack" aria-label="Assistant status">
            <span className="micro">Language model</span>
            {linkProfile.key === "mars" ? (
              <>
                <p className="strong">Not used at Mars distance</p>
                <p className="small text-2">A call to Earth and back would take up to 40 minutes of signal time. Answers are built on board by fixed rules from the same facts.</p>
              </>
            ) : status === undefined ? (
              <p className="small text-2">Checking the station server.</p>
            ) : status?.configured ? (
              <>
                <p className="strong">
                  {status.model} <span className="muted small">via {status.provider}</span>
                </p>
                <p className="small text-2">A hosted model, standing in for one that would run on board. Called from the station server, which holds the key. It needs a link to Earth; everything else in this app works without one.</p>
              </>
            ) : (
              <>
                <p className="strong">Not in use</p>
                <p className="small text-2">Answers are built on board by fixed rules from the same facts, so this screen works with no link. They are marked “Fixed rules”.</p>
              </>
            )}
          </section>
          <section className="card card--pad stack" aria-label="What left the station">
            <span className="micro">Sent to the model · log</span>
            {sends.length ? (
              <ul className="sendlog">
                {sends.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    <span className="num">Day {e.day}</span>
                    <span>
                      {e.question ? `“${e.question}”` : e.feature === "explain_alert" ? "Why this alert" : "Brief draft"} · {e.chars.toLocaleString("en-US")} characters of facts to {e.provider}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small text-2">Nothing has left the station. Each model answer is listed here, and shows exactly what was sent.</p>
            )}
            <p className="small muted">No names are sent: the facts say “Crew member” and “Flight surgeon”. Kept in this browser.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** The cited days, highlighted on the real charts (one small chart per cited indicator). */
function Evidence({ result, ctx }: { result: AiResult; ctx: RecordCtx }) {
  const { rec, cabin } = ctx;
  const win = missionWindow(rec.mission);
  const groups = new Map<CiteKey, number[]>();
  for (const c of result.cites) groups.set(c.metric, [...(groups.get(c.metric) ?? []), c.day]);
  if (!groups.size) return null;

  // CO2 and headaches share one chart pair, as on Cabin Link.
  const cabinDays = [...new Set([...(groups.get("co2") ?? []), ...(groups.get("headache") ?? [])])];
  const metrics = [...groups.keys()].filter((k): k is MetricKey => k !== "co2" && k !== "headache").slice(0, 3);
  const spans = (days: number[]) => days.map((d) => daySpan(rec.mission, d));

  return (
    <div className="evidence">
      <span className="micro">Where it points on your charts</span>
      <div className="evidence__grid">
        {metrics.map((k) => {
          const ind = rec.indicators.find((i) => i.key === k)!;
          const c = INDICATORS[k];
          const b = ind.baseline;
          const days = groups.get(k)!;
          return (
            <section key={k} className="card" aria-label={`${c.label}, cited days highlighted`}>
              <header className="card__head">
                <h3>{c.label}</h3>
                <Link to={citeHref(result.cites, { metric: k, day: days[0] })} className="btn btn--ghost">
                  Open <Icon name="chevron-right" size={16} />
                </Link>
              </header>
              <div className="card__body">
                <TrendChart
                  label={`${c.label}, last 14 days, days ${days.join(", ")} highlighted`}
                  points={ind.series.map((p) => ({ t: Date.parse(p.t), v: p.v, v2: p.v2, source: p.source }))}
                  xDomain={win.domain}
                  ticks={win.ticks}
                  kind={k === "bp" ? "range" : "line"}
                  unit={c.unit}
                  decimals={c.decimals}
                  band={b.state === "ready" ? { low: b.low, high: b.high } : null}
                  band2={b.state === "ready" && b.low2 != null ? { low: b.low2, high: b.high2! } : null}
                  lastStatus={ind.status}
                  height={190}
                  formatTime={(t) => `${win.fmt(t)} GMT`}
                  highlightSpans={spans(days)}
                />
              </div>
            </section>
          );
        })}
        {cabinDays.length > 0 && cabin && (
          <section className="card" aria-label="Cabin CO2 and headaches, cited days highlighted">
            <header className="card__head">
              <h3>{citeLabel({ metric: "co2", day: 0 })} and headaches</h3>
              <Link to={`/cabin?hl=${cabinDays.join(",")}`} className="btn btn--ghost">
                Open <Icon name="chevron-right" size={16} />
              </Link>
            </header>
            <div className="card__body">
              <TrendChart
                label={`Cabin CO2 in parts per million, days ${cabinDays.join(", ")} highlighted`}
                points={cabin.co2.map((p) => ({ t: Date.parse(p.t), v: p.v, source: p.source }))}
                xDomain={win.domain}
                ticks={win.ticks}
                unit="ppm"
                decimals={0}
                band={Number.isFinite(cabin.usual.low) ? { low: cabin.usual.low, high: cabin.usual.high } : null}
                showDots={false}
                height={190}
                formatTime={(t) => `${win.fmt(t)} GMT`}
                highlightSpans={spans(cabinDays)}
              />
              <HeadacheStrip items={cabin.headaches.map((h) => ({ ...h, t: Date.parse(h.t) }))} xDomain={win.domain} ticks={win.ticks} formatTime={(t) => win.fmt(t)} highlightSpans={spans(cabinDays)} />
            </div>
          </section>
        )}
      </div>
      <p className="small muted">Grey band: your usual range. Lit columns: the days the answer refers to.</p>
    </div>
  );
}
