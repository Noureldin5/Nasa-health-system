import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { RecordView, RegionKey, Status, Strength } from "../api/types";
import { HAZARDS } from "../content/hazards";
import { INDICATORS } from "../content/indicators";
import { REGIONS } from "../content/regions";
import { useAction } from "../lib/app";
import { fmtPoint } from "../lib/format";
import { Icon } from "./icons";
import { StatusIcon, StatusPill } from "./status";

/** Explainer for one body region: what it does, which measurement, the five HRP hazards, when to call. */
export function RegionPanel({ region, status, reason, rec, metricHref, canLog }: {
  region: RegionKey;
  status: Status;
  reason: string;
  rec: RecordView;
  metricHref: (m: string) => string;
  canLog: boolean;
}) {
  const r = REGIONS[region];
  const { run, busy } = useAction();
  const [symptom, setSymptom] = useState<string | null>(null);
  const [strength, setStrength] = useState<Strength | null>(null);

  async function log() {
    if (!symptom || !strength) return;
    await run(() => api.postSymptom(rec.crew.id, { region, symptom, strength }), `Logged: ${symptom.toLowerCase()}, ${strength}. It goes to ground at the next link.`);
    setSymptom(null);
    setStrength(null);
  }

  return (
    <div className="region-panel" aria-live="polite">
      <div className="region-panel__head">
        <span className="micro">Body region</span>
        <div className="row row--between">
          <h2>{r.label}</h2>
          <StatusPill status={status} />
        </div>
        <p className="text-2 small">{reason}</p>
      </div>
      <div className="region-panel__body">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <span className="micro">What it does</span>
          <p>{r.does}</p>
        </div>

        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <span className="micro">What we measure</span>
          {r.metrics.length ? (
            <div className="kv-list">
              {r.metrics.map((m) => {
                const ind = rec.indicators.find((i) => i.key === m)!;
                return (
                  <Link key={m} to={metricHref(m)} className="kv-row">
                    <span className="row" style={{ ["--gap" as string]: "8px" }}>
                      <StatusIcon status={ind.status} />
                      {INDICATORS[m].label}
                    </span>
                    <span className="row" style={{ ["--gap" as string]: "6px" }}>
                      <span className="num strong">{fmtPoint(m, ind.latest)}</span>
                      <span className="muted small">{INDICATORS[m].unit}</span>
                      <Icon name="chevron-right" size={16} />
                    </span>
                  </Link>
                );
              })}
              {r.showsBloodReference && (
                <a href="#blood-reference" className="kv-row">
                  <span className="row" style={{ ["--gap" as string]: "8px" }}>
                    <span className="tag tag--nasa">NASA</span>
                    Blood count reference (OSD-569)
                  </span>
                  <Icon name="chevron-right" size={16} />
                </a>
              )}
            </div>
          ) : (
            <p className="text-2 small">{r.notTracked}</p>
          )}
        </div>

        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <span className="micro">How spaceflight affects it</span>
          <ul className="hazard-list">
            {r.hazards.map((h) => (
              <li key={h.hazard}>
                <span>{HAZARDS[h.hazard].name}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="contact-box">
          <span className="micro" style={{ display: "block", marginBottom: 4 }}>
            Contact the flight surgeon if
          </span>
          {r.contactIf.charAt(0).toUpperCase() + r.contactIf.slice(1)}
        </div>

        {canLog && (
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            <span className="micro">Log a symptom here · about 5 s</span>
            <div className="row" role="group" aria-label="Symptom">
              {r.symptoms.map((s) => (
                <button key={s} type="button" className="btn btn--secondary" aria-pressed={symptom === s} onClick={() => setSymptom(s)} style={symptom === s ? { borderColor: "var(--c-link)", background: "rgb(90 162 255 / 0.1)" } : undefined}>
                  {s}
                </button>
              ))}
            </div>
            {symptom && (
              <div className="choices" style={{ ["--cols" as string]: 3 }} role="group" aria-label="How strong">
                {(["mild", "moderate", "strong"] as Strength[]).map((s) => (
                  <button key={s} type="button" className="choice" style={{ minHeight: 56 }} aria-pressed={strength === s} onClick={() => setStrength(s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            )}
            {symptom && strength && (
              <button type="button" className="btn btn--primary btn--lg" onClick={log} disabled={busy}>
                Log {symptom.toLowerCase()}, {strength}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
