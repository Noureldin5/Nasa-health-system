import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import type { Headache, Osd569Indicator, Source, Status } from "../api/types";
import { fmtNum, sourceLabel } from "../lib/format";

/*
 * Charts follow the dataviz rules: 2px lines, >= 8px markers with a 2px surface
 * ring, hairline solid grid, one y-axis, values in text tokens, a crosshair
 * tooltip that never gates a value (every chart has a table twin), keyboard
 * access with the arrow keys.
 */

const STATUS_FILL: Record<Status, string> = {
  ok: "var(--c-ok)",
  watch: "var(--c-watch)",
  act: "var(--c-act)",
  learning: "var(--c-text-2)",
  nodata: "var(--c-muted)",
};

export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export interface TrendPoint {
  t: number;
  v: number;
  v2?: number;
  source?: Source;
}

export interface DayTick {
  t: number;
  label: string;
}

interface Band {
  low: number;
  high: number;
}

/* ---------- Sparkline (indicator cards) ---------- */

export function Sparkline({ points, xDomain, band, band2, status, range = false, height = 44 }: {
  points: TrendPoint[];
  xDomain: [number, number];
  band?: Band | null;
  band2?: Band | null;
  status: Status;
  range?: boolean;
  height?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>(240);
  const pad = 5;
  const vals = points.flatMap((p) => (p.v2 != null ? [p.v, p.v2] : [p.v]));
  const extra = [band?.low, band?.high, band2?.low, band2?.high].filter((x): x is number => x != null && Number.isFinite(x));
  const all = [...vals, ...extra];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const x = scaleLinear().domain(xDomain).range([pad, width - pad]);
  const y = scaleLinear()
    .domain([lo - span * 0.12, hi + span * 0.12])
    .range([height - pad, pad]);
  const path = line<TrendPoint>()
    .x((p) => x(p.t))
    .y((p) => y(p.v))
    .curve(curveMonotoneX)(points);
  const last = points[points.length - 1];

  return (
    <div ref={ref} className="chart" aria-hidden="true">
      {all.length > 0 && (
        <svg width={width} height={height}>
          {[band, band2].map(
            (b, i) =>
              b &&
              Number.isFinite(b.low) && (
                <rect key={i} x={pad} width={width - pad * 2} y={y(b.high)} height={Math.max(1, y(b.low) - y(b.high))} fill="var(--c-band)" rx="2" />
              ),
          )}
          {range ? (
            points.map((p) => (
              <line key={p.t} x1={x(p.t)} x2={x(p.t)} y1={y(p.v)} y2={y(p.v2 ?? p.v)} stroke="var(--c-series)" strokeWidth="2" strokeLinecap="round" />
            ))
          ) : (
            <path d={path ?? ""} fill="none" stroke="var(--c-series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {last && (
            <circle cx={x(last.t)} cy={y(last.v)} r="4.5" fill={STATUS_FILL[status]} stroke="var(--c-surface)" strokeWidth="2" />
          )}
        </svg>
      )}
    </div>
  );
}

/* ---------- Trend chart (detail pages, cabin) ---------- */

export interface TrendChartProps {
  label: string;
  points: TrendPoint[];
  xDomain: [number, number];
  ticks: DayTick[];
  kind?: "line" | "range";
  unit: string;
  decimals: number;
  band?: (Band & { label?: string }) | null;
  band2?: (Band & { label?: string }) | null;
  threshold?: { value: number; label: string } | null;
  shadeAbove?: boolean;
  lastStatus?: Status;
  height?: number;
  formatTime: (t: number) => string;
  yFloor?: number;
  yCeil?: number;
  showDots?: boolean;
  children?: (ctx: { x: (t: number) => number; width: number; margin: typeof MARGIN }) => ReactNode;
}

const MARGIN = { top: 14, right: 16, bottom: 30, left: 52 };

export function TrendChart(props: TrendChartProps) {
  const { label, points, xDomain, ticks, kind = "line", unit, decimals, band, band2, threshold, shadeAbove, lastStatus, height = 260, formatTime, yFloor, yCeil } = props;
  const { ref, width } = useWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);
  const innerW = Math.max(10, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const { x, y, yTicks } = useMemo(() => {
    const vals = points.flatMap((p) => (p.v2 != null ? [p.v, p.v2] : [p.v]));
    const extra = [band?.low, band?.high, band2?.low, band2?.high, threshold?.value].filter((v): v is number => v != null && Number.isFinite(v));
    const all = [...vals, ...extra];
    let lo = all.length ? Math.min(...all) : 0;
    let hi = all.length ? Math.max(...all) : 1;
    const span = hi - lo || Math.abs(hi) * 0.1 || 1;
    lo -= span * 0.12;
    hi += span * 0.12;
    if (yFloor != null) lo = Math.max(lo, yFloor);
    if (yCeil != null) hi = Math.min(hi, yCeil);
    const y = scaleLinear().domain([lo, hi]).range([innerH, 0]).nice(4);
    const x = scaleLinear().domain(xDomain).range([0, innerW]);
    return { x, y, yTicks: y.ticks(4) };
  }, [points, band, band2, threshold, xDomain, innerW, innerH, yFloor, yCeil]);

  const path = useMemo(
    () =>
      line<TrendPoint>()
        .x((p) => x(p.t))
        .y((p) => y(p.v))
        .curve(curveMonotoneX)(points) ?? "",
    [points, x, y],
  );

  const showDots = props.showDots ?? points.length <= 20;
  const stepEvery = innerW < 420 ? 2 : 1;
  const act = active != null ? points[active] : null;

  function nearest(px: number) {
    if (!points.length) return null;
    const t = x.invert(px);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    return best;
  }
  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    setActive(nearest(e.clientX - box.left));
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!points.length) return;
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const fmt = (p: TrendPoint) => (p.v2 != null ? `${fmtNum(p.v, decimals)}/${fmtNum(p.v2, decimals)}` : fmtNum(p.v, decimals));
  const tipLeft = act ? Math.min(Math.max(MARGIN.left + x(act.t) + 12, 0), width - 170) : 0;
  const latest = points[points.length - 1];

  return (
    <div
      ref={ref}
      className="chart"
      tabIndex={0}
      role="img"
      aria-label={`${label}. ${points.length} readings.${latest ? ` Latest ${fmt(latest)} ${unit}.` : ""}${band && Number.isFinite(band.low) ? ` Your usual range ${fmtNum(band.low, decimals)} to ${fmtNum(band.high, decimals)} ${unit}.` : ""} Use left and right arrow keys to read values.`}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={height}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <g className="chart__grid">
            {yTicks.map((t) => (
              <line key={t} x1={0} x2={innerW} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          {shadeAbove && threshold && y(threshold.value) > 0 && (
            <rect x={0} y={0} width={innerW} height={Math.max(0, y(threshold.value))} fill="var(--c-act-wash)" opacity="0.6" />
          )}
          {[band, band2].map(
            (b, i) =>
              b &&
              Number.isFinite(b.low) && (
                <g key={i}>
                  <rect x={0} width={innerW} y={y(b.high)} height={Math.max(1, y(b.low) - y(b.high))} fill="var(--c-band)" />
                  <line x1={0} x2={innerW} y1={y(b.high)} y2={y(b.high)} stroke="var(--c-band-edge)" />
                  <line x1={0} x2={innerW} y1={y(b.low)} y2={y(b.low)} stroke="var(--c-band-edge)" />
                  {/* Band names live in the legend under the chart, so they never collide with the line. */}
                  {b.label && <title>{b.label}</title>}
                </g>
              ),
          )}
          {threshold && (
            <g>
              <line x1={0} x2={innerW} y1={y(threshold.value)} y2={y(threshold.value)} stroke="var(--c-act)" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={4} y={y(threshold.value) - 6} textAnchor="start" fill="var(--c-text)" fontSize="11" fontFamily="var(--font-mono)">
                {threshold.label}
              </text>
            </g>
          )}
          <g className="chart__axis">
            {yTicks.map((t) => (
              <text key={t} x={-10} y={y(t)} dy="0.32em" textAnchor="end">
                {fmtNum(t, Math.abs(t) < 10 && decimals > 0 ? 1 : 0)}
              </text>
            ))}
            {ticks.map((tk, i) =>
              i % stepEvery === 0 || i === ticks.length - 1 ? (
                <text key={tk.t} x={x(tk.t)} y={innerH + 20} textAnchor="middle">
                  {tk.label}
                </text>
              ) : null,
            )}
          </g>
          {kind === "range"
            ? points.map((p, i) => (
                <g key={p.t}>
                  <line x1={x(p.t)} x2={x(p.t)} y1={y(p.v)} y2={y(p.v2 ?? p.v)} stroke="var(--c-series)" strokeWidth="2" />
                  {[p.v, p.v2 ?? p.v].map((v, j) => (
                    <circle
                      key={j}
                      cx={x(p.t)}
                      cy={y(v)}
                      r={i === active ? 6 : 4.5}
                      fill={i === points.length - 1 && lastStatus ? STATUS_FILL[lastStatus] : "var(--c-series)"}
                      stroke="var(--c-surface)"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              ))
            : (
              <>
                <path d={path} fill="none" stroke="var(--c-series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {showDots &&
                  points.map((p, i) => (
                    <circle
                      key={p.t}
                      cx={x(p.t)}
                      cy={y(p.v)}
                      r={i === points.length - 1 ? 5.5 : 4}
                      fill={i === points.length - 1 && lastStatus ? STATUS_FILL[lastStatus] : "var(--c-series)"}
                      stroke="var(--c-surface)"
                      strokeWidth="2"
                    />
                  ))}
              </>
            )}
          {props.children?.({ x, width: innerW, margin: MARGIN })}
          {act && (
            <g pointerEvents="none">
              <line x1={x(act.t)} x2={x(act.t)} y1={0} y2={innerH} stroke="var(--c-text-2)" strokeWidth="1" />
              <circle cx={x(act.t)} cy={y(act.v)} r="6" fill="none" stroke="var(--c-text-strong)" strokeWidth="2" />
            </g>
          )}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            style={{ touchAction: "pan-y" }}
          />
        </g>
      </svg>
      {act && (
        <div className="chart__tooltip" style={{ left: tipLeft, top: 8 }}>
          <b>
            {fmt(act)} <span style={{ fontSize: 12, color: "var(--c-text-2)" }}>{unit}</span>
          </b>
          <div className="tt-row">
            <span className="tt-key" />
            {formatTime(act.t)}
          </div>
          {act.source && <div>{sourceLabel(act.source)}</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- Headache strip, shares the x scale of the CO2 chart ---------- */

const STRENGTH_SIZE: Record<Headache, number> = { none: 0, mild: 7, moderate: 10, strong: 13 };

export function HeadacheStrip({ items, xDomain, ticks, formatTime }: {
  items: { day: number; t: number; strength: Headache }[];
  xDomain: [number, number];
  ticks: DayTick[];
  formatTime: (t: number) => string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>(640);
  const innerW = Math.max(10, width - MARGIN.left - MARGIN.right);
  const x = scaleLinear().domain(xDomain).range([0, innerW]);
  const h = 54;
  const mid = 22;
  return (
    <div ref={ref} className="chart">
      <svg width={width} height={h} role="img" aria-label={`Headaches reported in check-ins: ${items.filter((i) => i.strength !== "none").map((i) => `day ${i.day} ${i.strength}`).join(", ") || "none"}.`}>
        <g transform={`translate(${MARGIN.left},0)`}>
          <text x={-10} y={mid} dy="0.32em" textAnchor="end" fill="var(--c-muted)" fontSize="11" fontFamily="var(--font-mono)">
            HEAD
          </text>
          <line x1={0} x2={innerW} y1={mid} y2={mid} stroke="var(--c-grid)" />
          {ticks.map((tk) => (
            <line key={tk.t} x1={x(tk.t)} x2={x(tk.t)} y1={mid - 3} y2={mid + 3} stroke="var(--c-line-strong)" />
          ))}
          {items.map((it) => {
            const cx = x(it.t);
            const s = STRENGTH_SIZE[it.strength];
            return (
              <g key={it.t}>
                <title>{`${formatTime(it.t)}: ${it.strength === "none" ? "no headache" : `${it.strength} headache`}`}</title>
                {it.strength === "none" ? (
                  <circle cx={cx} cy={mid} r="3" fill="var(--c-bg)" stroke="var(--c-muted)" strokeWidth="1.2" />
                ) : (
                  <>
                    <path d={`M${cx} ${mid - s} L${cx + s} ${mid + s * 0.75} L${cx - s} ${mid + s * 0.75} Z`} fill="var(--c-text-strong)" stroke="var(--c-surface)" strokeWidth="2" />
                    <text x={cx} y={mid + s + 16} textAnchor="middle" fill="var(--c-text-2)" fontSize="10.5" fontFamily="var(--font-mono)">
                      {it.strength}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/* ---------- OSD-569 blood reference chart (categorical time points) ---------- */

export function BloodChart({ indicator, timepoints, height = 230 }: { indicator: Osd569Indicator; timepoints: string[]; height?: number }) {
  const { ref, width } = useWidth<HTMLDivElement>(560);
  const [active, setActive] = useState<number | null>(null);
  const m = { top: 14, right: 12, bottom: 34, left: 56 };
  const innerW = Math.max(10, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const vals = indicator.samples.map((s) => s.value);
  const lo = Math.min(indicator.earthRange.min, ...vals);
  const hi = Math.max(indicator.earthRange.max, ...vals);
  const y = scaleLinear()
    .domain([lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.08])
    .range([innerH, 0])
    .nice(4);
  const step = innerW / timepoints.length;
  const cx = (i: number) => step * i + step / 2;
  const jitter = [-9, -3, 3, 9];
  const crews = [...new Set(indicator.samples.map((s) => s.crew))];
  const flightAt = timepoints.findIndex((t) => t.startsWith("R"));
  const decimals = indicator.unit.includes("10³") ? 1 : 0;

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? timepoints.length) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(timepoints.length - 1, (a ?? -1) + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const activeSamples = active != null ? indicator.samples.filter((s) => s.timepoint === timepoints[active]) : [];

  return (
    <div
      ref={ref}
      className="chart"
      tabIndex={0}
      role="img"
      aria-label={`${indicator.label}, Inspiration4 crew of ${crews.length}, ${timepoints.length} time points before and after flight. Earth reference range ${fmtNum(indicator.earthRange.min, decimals)} to ${fmtNum(indicator.earthRange.max, decimals)} ${indicator.unit}. Use arrow keys to read values.`}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={height}>
        <g transform={`translate(${m.left},${m.top})`}>
          <g className="chart__grid">
            {y.ticks(4).map((t) => (
              <line key={t} x1={0} x2={innerW} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <rect
            x={0}
            width={innerW}
            y={y(indicator.earthRange.max)}
            height={y(indicator.earthRange.min) - y(indicator.earthRange.max)}
            fill="none"
            stroke="var(--c-text-2)"
            strokeDasharray="5 4"
          />
          <text x={6} y={y(indicator.earthRange.max) + 14} fill="var(--c-text-2)" fontSize="11" fontFamily="var(--font-mono)">
            Earth reference range
          </text>
          {flightAt > 0 && (
            <g>
              <line x1={step * flightAt} x2={step * flightAt} y1={-4} y2={innerH} stroke="var(--c-line-strong)" />
              <text x={step * flightAt + 6} y={innerH - 6} fill="var(--c-muted)" fontSize="10.5" fontFamily="var(--font-mono)">
                ← pre-flight · post-flight →
              </text>
            </g>
          )}
          <g className="chart__axis">
            {y.ticks(4).map((t) => (
              <text key={t} x={-10} y={y(t)} dy="0.32em" textAnchor="end">
                {fmtNum(t, decimals)}
              </text>
            ))}
            {timepoints.map((tp, i) => (
              <text key={tp} x={cx(i)} y={innerH + 20} textAnchor="middle">
                {tp}
              </text>
            ))}
          </g>
          {active != null && <rect x={step * active} y={0} width={step} height={innerH} fill="rgb(255 255 255 / 0.04)" />}
          {timepoints.map((tp, i) =>
            indicator.samples
              .filter((s) => s.timepoint === tp)
              .map((s) => (
                <circle
                  key={`${tp}-${s.crew}`}
                  cx={cx(i) + jitter[crews.indexOf(s.crew) % 4]}
                  cy={y(s.value)}
                  r="4.5"
                  fill="var(--c-series)"
                  stroke="var(--c-surface)"
                  strokeWidth="2"
                />
              )),
          )}
          {timepoints.map((tp, i) => (
            <rect
              key={tp}
              x={step * i}
              y={0}
              width={step}
              height={innerH}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </g>
      </svg>
      {active != null && (
        <div className="chart__tooltip" style={{ left: Math.min(m.left + cx(active) + 14, width - 180), top: 8 }}>
          <div className="micro" style={{ marginBottom: 4 }}>
            {timepoints[active]} · {indicator.unit}
          </div>
          {activeSamples.map((s) => (
            <div key={s.crew} className="tt-row">
              <span className="tt-key" />
              <span className="num" style={{ color: "var(--c-text-strong)", minWidth: 52 }}>
                {fmtNum(s.value, decimals)}
              </span>
              <span>{s.crew}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Table twin ---------- */

export function PointTable({ rows, unit, valueHeader }: { rows: { when: string; value: string; source?: string }[]; unit: string; valueHeader?: string }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th className="num">{valueHeader ?? `Value (${unit})`}</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.when}</td>
              <td className="num">{r.value}</td>
              <td>{r.source ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
