import { useState } from "react";
import { api } from "../api/client";
import { OSD569_LABEL } from "../content/sources";
import { useQuery } from "../lib/app";
import { fmtNum } from "../lib/format";
import { BloodChart } from "./charts";
import { Icon } from "./icons";
import { SourceTag } from "./ui";

/** One value against the Earth reference range, for the API's one-value-per-indicator shape. */
function RangeBar({ min, max, value, unit }: { min: number; max: number; value: number | null; unit: string }) {
  const lo = Math.min(min, value ?? min);
  const hi = Math.max(max, value ?? max);
  const pad = (hi - lo) * 0.15 || 1;
  const pos = (x: number) => `${((x - (lo - pad)) / (hi - lo + 2 * pad)) * 100}%`;
  return (
    <div className="stack" style={{ ["--gap" as string]: "8px", padding: "16px 0" }} role="img" aria-label={`Value ${value ?? "none"} ${unit}, Earth reference range ${min} to ${max} ${unit}`}>
      <div style={{ position: "relative", height: 28 }}>
        <div style={{ position: "absolute", top: 8, height: 12, left: pos(min), width: `calc(${pos(max)} - ${pos(min)})`, border: "1px dashed var(--c-text-2)", borderRadius: 3 }} />
        {value != null && <div style={{ position: "absolute", top: 4, left: pos(value), width: 10, height: 20, marginLeft: -5, borderRadius: 3, background: "var(--c-series)", boxShadow: "0 0 0 2px var(--c-surface)" }} />}
      </div>
      <div className="row row--between small text-2 num">
        <span>
          Earth range {fmtNum(min, 1)}–{fmtNum(max, 1)} {unit}
        </span>
        {value != null && (
          <span>
            Sample value <b className="strong">{fmtNum(value, 1)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Blood count reference from NASA OSDR OSD-569 (Inspiration4 CBC), requirement
 * M2b and M8. The Earth reference range is context only: status
 * and alerts follow the personal baseline, never this range.
 */
export function BloodCard() {
  const { data } = useQuery("osd569", () => api.getOsd569());
  const [key, setKey] = useState("lymph");
  const [table, setTable] = useState(false);
  if (!data) return <section className="card card--pad loading" id="blood-reference" aria-busy="true" style={{ minHeight: 320 }} />;
  if (data.placeholder || !data.indicators.length) {
    return (
      <section className="card" id="blood-reference" aria-labelledby="blood-title">
        <header className="card__head">
          <div className="stack" style={{ ["--gap" as string]: "2px" }}>
            <span className="micro">Blood and immune · NASA reference data</span>
            <h2 id="blood-title" style={{ fontSize: "var(--fs-h3)" }}>
              Blood count, Inspiration4 crew
            </h2>
          </div>
          <span className="tag">{OSD569_LABEL}</span>
        </header>
        <div className="card__body stack">
          <div className="empty">
            Waiting for the NASA OSD-569 values from the data pipeline. No numbers are shown until the real file is loaded.
          </div>
          <p className="small muted">
            Source when loaded: NASA OSDR{" "}
            <a href={data.url} target="_blank" rel="noreferrer">
              {data.datasetId}
            </a>
            . Shown for context only: your alerts use your own baseline.
          </p>
        </div>
      </section>
    );
  }
  const ind = data.indicators.find((i) => i.key === key) ?? data.indicators[0];
  const decimals = ind.unit.includes("10³") ? 1 : 0;
  const single = data.timepoints.length < 2;

  return (
    <section className="card" id="blood-reference" aria-labelledby="blood-title">
      <header className="card__head">
        <div className="stack" style={{ ["--gap" as string]: "2px" }}>
          <span className="micro">Blood and immune · NASA reference data</span>
          <h2 id="blood-title" style={{ fontSize: "var(--fs-h3)" }}>
            Blood count, Inspiration4 crew
          </h2>
        </div>
        <div className="row">
          <SourceTag source="nasa" title={`${data.datasetId}: ${data.title}`} />
          <span className="tag">{OSD569_LABEL}</span>
        </div>
      </header>
      <div className="card__body stack">
        <div className="row row--between">
          <div className="role-switch role-switch--wrap" role="group" aria-label="Blood count measure">
            {data.indicators.map((i) => (
              <a
                key={i.key}
                href={`#${i.key}`}
                className={i.key === ind.key ? "is-active" : ""}
                aria-pressed={i.key === ind.key}
                onClick={(e) => {
                  e.preventDefault();
                  setKey(i.key);
                }}
              >
                {i.label}
              </a>
            ))}
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => setTable((t) => !t)} aria-pressed={table}>
            <Icon name="log" size={16} />
            {table ? "Show chart" : "Show as table"}
          </button>
        </div>

        {table ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Crew</th>
                  {data.timepoints.map((tp) => (
                    <th key={tp} className="num">
                      {tp}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(ind.samples.map((s) => s.crew))].map((crew) => (
                  <tr key={crew}>
                    <td>{crew}</td>
                    {data.timepoints.map((tp) => {
                      const s = ind.samples.find((x) => x.crew === crew && x.timepoint === tp);
                      return (
                        <td key={tp} className="num">
                          {s ? fmtNum(s.value, decimals) : "–"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : single ? (
          <RangeBar min={ind.earthRange.min} max={ind.earthRange.max} value={ind.samples[0]?.value ?? null} unit={ind.unit} />
        ) : (
          <BloodChart indicator={ind} timepoints={data.timepoints} />
        )}

        <div className="legend">
          <span className="legend__item">
            <svg width="12" height="12" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" fill="var(--c-series)" />
            </svg>
            One crew member ({ind.unit})
          </span>
          <span className="legend__item">
            <span className="legend__swatch legend__swatch--ref" />
            Earth reference range {fmtNum(ind.earthRange.min, decimals)}–{fmtNum(ind.earthRange.max, decimals)}
          </span>
          <span className="legend__item muted">L = days before launch, R = days after return</span>
        </div>

        <div className="banner banner--plain small">
          <Icon name="info" size={18} />
          <span className="grow">
            Shown for context. Your alerts compare with <b>your own baseline</b>, not this Earth range, because some blood values
            change in flight. Your own blood count is not measured on board in this prototype.
          </span>
        </div>
        <p className="small muted">
          Source: NASA OSDR{" "}
          <a href={data.url} target="_blank" rel="noreferrer">
            {data.datasetId}
          </a>
          , {data.title}, file {data.file}, accessed {data.accessed}. Values as published.
          {data.bundledCopy && " Copy bundled with the app until the station data pipeline serves this file."}
        </p>
      </div>
    </section>
  );
}
