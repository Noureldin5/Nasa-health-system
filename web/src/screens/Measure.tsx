import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Indicator, MetricKey } from "../api/types";
import { Icon } from "../components/icons";
import { StatusPill } from "../components/status";
import { PageHead } from "../components/ui";
import { INDICATORS } from "../content/indicators";
import { DISCLAIMER } from "../content/sources";
import { ME, useAction, useQuery } from "../lib/app";
import { fmtPoint } from "../lib/format";

/**
 * Input sanity bounds: reject typos, not health judgements. These are not
 * medical thresholds and never raise an alert.
 */
const BOUNDS: Partial<Record<MetricKey, { min: number; max: number; min2?: number; max2?: number }>> = {
  bp: { min: 60, max: 250, min2: 30, max2: 160 },
  hr: { min: 25, max: 220 },
  glucose: { min: 20, max: 600 },
  temp: { min: 33, max: 43 },
};

export function Measure() {
  const [params] = useSearchParams();
  const metrics = (params.get("metrics") ?? "bp,glucose,temp").split(",").filter((m): m is MetricKey => m in INDICATORS && m in BOUNDS);
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Indicator[]>([]);
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  const { run, busy } = useAction();
  const [v, setV] = useState("");
  const [v2, setV2] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const metric = metrics[i];
  const finished = i >= metrics.length;

  async function save(e: FormEvent) {
    e.preventDefault();
    const b = BOUNDS[metric]!;
    const a = Number(v.replace(",", "."));
    const d = metric === "bp" ? Number(v2.replace(",", ".")) : undefined;
    if (!Number.isFinite(a) || a < b.min || a > b.max || (metric === "bp" && (!Number.isFinite(d!) || d! < b.min2! || d! > b.max2!))) {
      setErr("That number looks like a typo. Check the device and enter it again.");
      return;
    }
    setErr(null);
    const ind = await run(() => api.postMeasurement(ME, { metric, v: a, v2: d }), `${INDICATORS[metric].label} saved.`);
    if (ind) setDone((x) => [...x, ind]);
    setV("");
    setV2("");
    setI((n) => n + 1);
  }

  if (finished) {
    return (
      <div className="stack" style={{ ["--gap" as string]: "var(--s-5)", maxWidth: 760 }}>
        <PageHead title="Measurements saved" sub="Compared with your own baseline. They go to ground at the next link." />
        <div className="kv-list" style={{ background: "var(--c-surface)" }}>
          {done.map((ind) => (
            <Link key={ind.key} to={`/health/${ind.key}`} className="kv-row" style={{ padding: "14px 16px" }}>
              <span className="strong">{ind.label}</span>
              <span className="row">
                <span className="num strong">
                  {fmtPoint(ind.key, ind.latest)} <span className="muted small">{ind.unit}</span>
                </span>
                <StatusPill status={ind.status} />
              </span>
            </Link>
          ))}
          {!done.length && <div className="kv-row text-2">Nothing entered. That is fine, skipping is never reported as a problem.</div>}
        </div>
        <Link to="/" className="btn btn--primary btn--lg" style={{ alignSelf: "flex-start" }}>
          Back to today
        </Link>
        <p className="small muted">{DISCLAIMER}</p>
      </div>
    );
  }

  const c = INDICATORS[metric];
  const request = rec.data?.requests.find((r) => r.metric === metric && !r.doneAt);

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <PageHead
        crumb={
          <Link to="/" className="crumb">
            <Icon name="chevron-left" size={16} /> Today
          </Link>
        }
        title={c.label}
        sub={`Measurement ${i + 1} of ${metrics.length} · about ${c.minutes ?? 1} min`}
      />
      {request && (
        <div className="banner">
          <Icon name="request" size={18} />
          <span>
            <b>{request.author.name} asked for this reading:</b> {request.reason}
          </span>
        </div>
      )}
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="howto">
          <header className="card__head">
            <h2 id="howto" style={{ fontSize: "var(--fs-h3)" }}>
              How to measure
            </h2>
          </header>
          <div className="card__body stack">
            <ol className="stack" style={{ ["--gap" as string]: "10px", paddingLeft: 20 }}>
              {c.howTo.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <hr className="divider" />
            <div className="stack" style={{ ["--gap" as string]: "4px" }}>
              <span className="micro">Why it matters</span>
              <p className="text-2">{c.why}</p>
            </div>
          </div>
        </section>
        <form className="card card--pad stack" onSubmit={save} noValidate>
          <span className="micro">Enter the reading</span>
          {metric === "bp" ? (
            <div className="grid-2" style={{ gap: "var(--s-3)" }}>
              <label className="field">
                <span className="field__label">Top number (systolic)</span>
                <input className="input input--big" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder="118" autoFocus />
              </label>
              <label className="field">
                <span className="field__label">Bottom number (diastolic)</span>
                <input className="input input--big" inputMode="numeric" value={v2} onChange={(e) => setV2(e.target.value)} placeholder="75" />
              </label>
            </div>
          ) : (
            <label className="field">
              <span className="field__label">
                {c.label} in {c.unit}
              </span>
              <input className="input input--big" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder={metric === "temp" ? "36.6" : "92"} autoFocus />
            </label>
          )}
          {err && (
            <p role="alert" className="small" style={{ color: "var(--c-watch)" }}>
              {err}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || !v}>
            Save {c.label.toLowerCase()}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setI((n) => n + 1)}>
            Skip this one
          </button>
          <p className="small muted">Unit: {c.unit}. The app compares it with your own baseline.</p>
        </form>
      </div>
    </div>
  );
}
