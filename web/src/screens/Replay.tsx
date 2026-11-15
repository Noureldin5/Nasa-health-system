import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import { api } from "../api/client";
import type { Headache, RegionKey, Status } from "../api/types";
import { useWidth } from "../components/charts";
import { Icon } from "../components/icons";
import { MarkIcon, StatusIcon, STATUS_WORD } from "../components/status";
import { ErrorNote, PageHead, SourceTag } from "../components/ui";
import { REGIONS } from "../content/regions";
import { ME, useApp, useQuery } from "../lib/app";
import { fmtNum } from "../lib/format";
import { regionStatus } from "../lib/regions";
import { buildReplay, MARK_WORD, REPLAY_REGIONS, type Mark, type Replay as ReplayData, type SeriesByDay } from "../lib/replay";

const BodyMap3D = lazy(() => import("../components/BodyMap3D"));

/** Seconds per mission day while playing. Demo parameter. */
const STEP_MS = 850;
const STRIPS: SeriesByDay["key"][] = ["co2", "sleep", "hr", "mood"];

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Mission replay: one scrubber over the whole mission. The body map, cabin CO2, headaches, sleep,
 * heart rate and mood move under one playhead, with the record's real events marked on the track.
 * Same screen for the astronaut and for ground (built from the ground copy of the same record).
 */
export function Replay() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { role } = useApp();
  const crewId = id ?? ME;
  const rec = useQuery(`${role}-${crewId}`, () => (role === "ground" ? api.getGroundView(crewId) : api.getAstronautView(crewId)));
  const cabin = useQuery(`cabin-${crewId}-${role}`, () => api.getCabin(crewId, role));
  const log = useQuery("link-log", () => api.getLinkLog());
  const r = rec.data;

  const replay = useMemo(() => (r ? buildReplay(r, cabin.data ?? null, log.data ?? []) : null), [r, cabin.data, log.data]);
  const [day, setDay] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  // ?play=1 starts the replay on its own, unless the system asks for reduced motion.
  const autoplay = useRef(params.get("play") === "1" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Start where the story starts: the last day of calibration. Days before it are all "learning".
  useEffect(() => {
    if (replay && day == null) {
      setDay(Math.min(replay.calibrationDays, replay.days));
      if (autoplay.current) setPlaying(true);
    }
  }, [replay, day]);

  useEffect(() => {
    if (!playing || !replay) return;
    const t = window.setInterval(() => {
      setDay((d) => {
        if (d == null || d >= replay.days) {
          setPlaying(false);
          return d;
        }
        return d + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(t);
  }, [playing, replay]);

  if (!r || !replay || day == null) {
    return (
      <>
        <ErrorNote error={rec.error} />
        <div className="loading" style={{ minHeight: 600 }} aria-busy="true" />
      </>
    );
  }

  const today = day === replay.days;
  const whose = role === "ground" ? "their" : "your";
  const dayEvents = replay.events.filter((e) => e.day === day);
  const go = (d: number) => {
    setPlaying(false);
    setDay(Math.max(1, Math.min(replay.days, d)));
  };
  const toggle = () => {
    if (!playing && today) setDay(Math.min(replay.calibrationDays, replay.days));
    setPlaying(!playing);
  };

  // Body map: past days carry replay marks, today carries the record's real statuses.
  const real = Object.fromEntries(REPLAY_REGIONS.map((k) => [k, regionStatus(r, k)])) as Record<RegionKey, { status: Status; reason: string }>;
  const marks = Object.fromEntries(REPLAY_REGIONS.map((k) => [k, replay.regionOf(k, day)])) as Record<RegionKey, { mark: Mark; why: string }>;
  const focus = today ? (REPLAY_REGIONS.find((k) => real[k].status === "act" || real[k].status === "watch") ?? null) : (REPLAY_REGIONS.find((k) => marks[k].mark === "out") ?? null);

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <PageHead
        crumb={
          role === "ground" ? (
            <Link to={`/ground/crew/${crewId}`} className="crumb">
              <Icon name="chevron-left" size={16} /> {r.crew.name}
            </Link>
          ) : undefined
        }
        title="Mission replay"
        sub={`Scrub through the mission. The body map, the cabin and ${whose} readings move together, re-drawn from the readings stored in the record.`}
        actions={<SourceTag source="sim" />}
      />

      <section className="replay card" aria-label="Mission replay">
        <div className="replay__stage">
          <div className="replay__body">
            <Guard>
              <Suspense fallback={<div className="body3d__stage replay__figure body3d__loading micro">Loading NASA astronaut model…</div>}>
                <div className="replay__figure-wrap">
                  <BodyMap3D statuses={real} marks={today ? undefined : marks} selected={focus} onSelect={() => undefined} onFail={() => undefined} compact />
                </div>
              </Suspense>
            </Guard>
            <ul className="replay__regions" aria-label={`Body regions on day ${day}`}>
              {REPLAY_REGIONS.filter((k) => REGIONS[k].metrics.length > 0).map((k) => (
                <li key={k}>
                  {today ? <StatusIcon status={real[k].status} /> : <MarkIcon mark={marks[k].mark} />}
                  <span className="strong">{REGIONS[k].label}</span>
                  <span className="text-2">{today ? `${STATUS_WORD[real[k].status]}. ${real[k].reason}` : `${MARK_WORD[marks[k].mark]}${marks[k].mark === "out" ? `: ${marks[k].why}` : ""}`}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="replay__signals">
            <div className="replay__now" aria-live={playing ? "off" : "polite"}>
              <div className="replay__day">
                <span className="micro">Mission day</span>
                <b>{day}</b>
                <span className="micro">of {replay.days}</span>
              </div>
              <div className="stack" style={{ ["--gap" as string]: "6px" }}>
                <span className={`tag${today ? " tag--done" : ""}`} style={{ alignSelf: "flex-start" }}>{today ? (role === "ground" ? "Copy as of the last sync: the record's real statuses" : "Today: the record's real statuses") : day <= replay.calibrationDays ? "Calibration" : "Replay: inside or outside today's usual band"}</span>
                <p className="replay__caption">{today ? [r.readout.headline, r.readout.change].filter(Boolean).join(". ") : replay.captionOf(day)}</p>
              </div>
            </div>

            <div className="replay__strips">
              <Strip s={replay.series.find((x) => x.key === "co2")!} replay={replay} day={day} />
              <HeadStrip values={replay.headache} days={replay.days} day={day} />
              {STRIPS.slice(1).map((k) => (
                <Strip key={k} s={replay.series.find((x) => x.key === k)!} replay={replay} day={day} />
              ))}
            </div>
            <Transport replay={replay} day={day} playing={playing} onToggle={toggle} onDay={go} />
          </div>
        </div>
      </section>

      <div className="grid-main-side">
        <section className="card" aria-labelledby="rp-day">
          <header className="card__head">
            <h2 id="rp-day" style={{ fontSize: "var(--fs-h3)" }}>
              On day {day}
            </h2>
            <span className="small muted">From the record: check-ins, alerts, the consult and every sync</span>
          </header>
          <div className="card__body">
            {dayEvents.length ? (
              <ul className="replay__events">
                {dayEvents.map((e, i) => (
                  <li key={i}>
                    <span className="micro">{e.kind === "band" ? "band" : e.kind}</span>
                    <span>{e.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-2">No event in the record on this day beyond the passive readings.</p>
            )}
          </div>
        </section>
        <aside className="card card--pad stack">
          <span className="micro">How to read this</span>
          <div className="legend" style={{ flexDirection: "column", gap: 8 }}>
            <span className="legend__item">
              <MarkIcon mark="out" /> Outside {whose} usual band on that day
            </span>
            <span className="legend__item">
              <MarkIcon mark="in" /> Inside the band
            </span>
            <span className="legend__item">
              <MarkIcon mark="learning" /> Baseline still being learned
            </span>
            <span className="legend__item">
              <span className="legend__swatch legend__swatch--band" /> Usual band as it stands today (calibration: {replay.calibrationDays} days)
            </span>
            <span className="legend__item">
              <svg width="12" height="10" aria-hidden="true">
                <path d="M6 1 l5 8 h-10 Z" fill="var(--c-text-strong)" />
              </svg>
              On the track: a day with a record event
            </span>
          </div>
          <p className="small muted">
            Past days are compared with today's usual band, so they show where a reading stood, not the status the app gave that day. Only today's frame shows the record's real statuses. Demo parameter.
          </p>
        </aside>
      </div>
    </div>
  );
}

/* ---------- One signal, drawn up to the playhead ---------- */

const PAD_R = 22;

/** One x scale for every strip and for the scrubber, so the thumb sits exactly under the playhead. */
function useX(days: number) {
  const { ref, width } = useWidth<HTMLDivElement>(700);
  const gutter = width < 560 ? 136 : 176;
  const x = scaleLinear()
    .domain([1, Math.max(2, days)])
    .range([gutter, Math.max(gutter + 10, width - PAD_R)]);
  return { ref, width, x, gutter };
}

function Strip({ s, replay, day }: { s: SeriesByDay; replay: ReplayData; day: number }) {
  const { ref, width, x, gutter: GUTTER } = useX(replay.days);
  const h = 76;
  const pts = s.values.map((v, i) => ({ d: i + 1, v })).filter((p): p is { d: number; v: number } => p.v != null);
  const all = [...pts.map((p) => p.v), ...(s.band ? [s.band.low, s.band.high] : [])];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo || 1) * 0.18;
  const y = scaleLinear()
    .domain([lo - pad, hi + pad])
    .range([h - 8, 8]);
  const path = line<{ d: number; v: number }>()
    .x((p) => x(p.d))
    .y((p) => y(p.v))
    .curve(curveMonotoneX)(pts);
  const mark = replay.markOf(s.key, day);
  let i = day - 1;
  while (i >= 0 && s.values[i] == null) i--;
  const now = i >= 0 ? s.values[i]! : null;
  const clipId = `rp-clip-${s.key}`;

  return (
    <div ref={ref} className="strip">
      <svg width={width} height={h} role="img" aria-label={`${s.label}: ${now == null ? "no reading" : `${fmtNum(now, s.decimals)} ${s.unit}`} on day ${day}, ${MARK_WORD[mark].toLowerCase()}.`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} height={h} style={{ width: x(day) + 5, transition: "width 520ms cubic-bezier(0.3, 0, 0.2, 1)" }} />
          </clipPath>
        </defs>
        {s.band && <rect x={GUTTER} width={width - PAD_R - GUTTER} y={y(s.band.high)} height={Math.max(1, y(s.band.low) - y(s.band.high))} fill="var(--c-band)" />}
        <path d={path ?? ""} fill="none" stroke="var(--c-line-strong)" strokeWidth="1.5" />
        <g clipPath={`url(#${clipId})`}>
          <path d={path ?? ""} fill="none" stroke="var(--c-series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p) => {
            const out = replay.markOf(s.key, p.d) === "out";
            return out ? (
              <rect key={p.d} x={x(p.d) - 4.5} y={y(p.v) - 4.5} width="9" height="9" fill="var(--c-text-strong)" stroke="var(--c-surface)" strokeWidth="2" />
            ) : (
              <circle key={p.d} cx={x(p.d)} cy={y(p.v)} r="4" fill="var(--c-series)" stroke="var(--c-surface)" strokeWidth="2" />
            );
          })}
        </g>
        <line className="strip__head" x1={0} x2={0} y1={0} y2={h} style={{ transform: `translateX(${x(day)}px)` }} />
      </svg>
      <div className="strip__label">
        <span className="micro">{s.label}</span>
        <span className="strip__value">
          {now == null ? "–" : fmtNum(now, s.decimals)}
          <small>{s.unit}</small>
        </span>
        <span className="strip__mark">
          <MarkIcon mark={mark} /> {MARK_WORD[mark]}
        </span>
      </div>
    </div>
  );
}

const HEAD_SIZE: Record<Headache, number> = { none: 0, mild: 6, moderate: 9, strong: 12 };

function HeadStrip({ values, days, day }: { values: (Headache | null)[]; days: number; day: number }) {
  const { ref, width, x, gutter: GUTTER } = useX(days);
  const h = 44;
  const mid = 22;
  const now = values[day - 1];
  return (
    <div ref={ref} className="strip strip--head">
      <svg width={width} height={h} role="img" aria-label={`Headache from the check-in on day ${day}: ${now ?? "no check-in"}.`}>
        <line x1={GUTTER} x2={width - PAD_R} y1={mid} y2={mid} stroke="var(--c-grid)" />
        {values.map((v, i) => {
          const d = i + 1;
          const cx = x(d);
          const shown = d <= day;
          if (!v || v === "none") return <circle key={d} cx={cx} cy={mid} r="2.5" fill="var(--c-bg)" stroke={shown ? "var(--c-muted)" : "var(--c-line-strong)"} />;
          const s = HEAD_SIZE[v];
          return <path key={d} d={`M${cx} ${mid - s} L${cx + s} ${mid + s * 0.75} L${cx - s} ${mid + s * 0.75} Z`} fill={shown ? "var(--c-text-strong)" : "var(--c-line-strong)"} stroke="var(--c-surface)" strokeWidth="1.5" style={{ transition: "fill 300ms ease" }} />;
        })}
        <line className="strip__head" x1={0} x2={0} y1={0} y2={h} style={{ transform: `translateX(${x(day)}px)` }} />
      </svg>
      <div className="strip__label">
        <span className="micro">Headache</span>
        <span className="strip__mark" style={{ color: "var(--c-text)" }}>
          {now == null ? "No check-in" : now === "none" ? "None" : now.charAt(0).toUpperCase() + now.slice(1)}
        </span>
      </div>
    </div>
  );
}

/* ---------- Transport: play, step, scrub ---------- */

function Transport({ replay, day, playing, onToggle, onDay }: { replay: ReplayData; day: number; playing: boolean; onToggle: () => void; onDay: (d: number) => void }) {
  const { ref, width, x } = useX(replay.days);
  const marked = [...new Set(replay.events.filter((e) => e.kind !== "sync" && e.kind !== "baseline").map((e) => e.day))];
  return (
    <div ref={ref} className="transport">
      <div className="transport__buttons">
        <button type="button" className="icon-btn" onClick={() => onDay(day - 1)} disabled={day <= 1} aria-label="Previous day">
          <Icon name="step-back" size={18} />
        </button>
        <button type="button" className="btn btn--primary transport__play" onClick={onToggle} aria-label={playing ? "Pause replay" : day === replay.days ? "Play the replay again" : "Play replay"}>
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => onDay(day + 1)} disabled={day >= replay.days} aria-label="Next day">
          <Icon name="step-forward" size={18} />
        </button>
      </div>
      <svg width={width} height={62} aria-hidden="true">
        <rect x={x(1)} y={24} width={Math.max(0, x(replay.days) - x(1))} height={4} rx={2} fill="var(--c-line-strong)" />
        <rect x={x(1)} y={24} height={4} rx={2} fill="var(--c-link)" style={{ width: Math.max(0, x(day) - x(1)), transition: "width 520ms cubic-bezier(0.3, 0, 0.2, 1)" }} />
        {marked.map((d) => (
          <path key={d} d={`M${x(d)} 9 l4.5 7 h-9 Z`} fill="var(--c-text-strong)" />
        ))}
        {Array.from({ length: replay.days }, (_, i) => i + 1).map((d) => (
          <text key={d} x={x(d)} y={56} textAnchor="middle" className={`transport__tick${d === day ? " is-on" : ""}`}>
            {replay.days > 10 && width < 640 && d % 2 === 0 ? "" : `D${d}`}
          </text>
        ))}
      </svg>
      <input
        className="transport__range"
        type="range"
        min={1}
        max={replay.days}
        step={1}
        value={day}
        onChange={(e) => onDay(Number(e.target.value))}
        aria-label="Mission day"
        aria-valuetext={`Day ${day} of ${replay.days}. ${replay.captionOf(day)}`}
        style={{ left: x(1) - 14, width: x(replay.days) - x(1) + 28 }}
      />
    </div>
  );
}
