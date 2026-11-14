import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { RecordView, RegionKey, Status } from "../api/types";
import { REGION_ORDER } from "../content/regions";
import { regionStatus } from "../lib/regions";
import { BloodCard } from "./BloodCard";
import { BodyMap } from "./BodyMap";
import { Icon } from "./icons";
import { IndicatorCard } from "./IndicatorCard";
import { RegionPanel } from "./RegionPanel";
import { StatusIcon, StatusLegend } from "./status";

const RANK: Record<Status, number> = { act: 4, watch: 3, ok: 2, learning: 1, nodata: 0 };

// three.js and the model load only when the 3D view is shown, in their own chunk.
const BodyMap3D = lazy(() => import("./BodyMap3D"));
const VIEW_KEY = "oyb-body-view";

/** If the 3D chunk or model fails in any way, fall back to the 2D map instead of breaking the screen. */
class Guard3D extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function initialView(): "3d" | "2d" {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "3d" || saved === "2d") return saved;
  } catch {
    /* storage blocked */
  }
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    return gl && window.innerWidth >= 720 ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

const SHORT_NAME: Record<RegionKey, string> = {
  brain: "Brain and eyes",
  heart: "Heart",
  blood: "Blood and immune",
  metabolism: "Metabolism",
  bones: "Bones",
  muscles: "Muscles",
};

/**
 * The one dashboard (D3): body map, six indicators, worth-checking, NASA blood
 * reference. The astronaut's Health screen, the flight surgeon's record and the
 * astronaut's "What ground sees" all render this same component from the same
 * record shape. Only actions differ (who can log a symptom).
 */
export function Dashboard({ rec, metricHref, canLog }: { rec: RecordView; metricHref: (m: string) => string; canLog: boolean }) {
  const statuses = useMemo(
    () => Object.fromEntries(REGION_ORDER.map((r) => [r, regionStatus(rec, r)])) as Record<RegionKey, { status: Status; reason: string }>,
    [rec],
  );
  const worst = useMemo(() => REGION_ORDER.reduce((a, b) => (RANK[statuses[b].status] > RANK[statuses[a].status] ? b : a)), [statuses]);
  const [selected, setSelected] = useState<RegionKey | null>(null);
  const [view, setViewState] = useState<"3d" | "2d">(initialView);
  const [failed3d, setFailed3d] = useState(false);
  const region = selected ?? worst;
  const flagged = new Map(rec.flags.filter((f) => f.active).map((f) => [f.metric, f]));
  const show3d = view === "3d" && !failed3d;

  function setView(v: "3d" | "2d") {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
  }

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-6)" }}>
      <section className="card" aria-label="Body map">
        <div className="bodymap">
          <div className="bodymap__figure">
            <div className="row row--between">
              <div className="row" style={{ ["--gap" as string]: "12px" }}>
                <span className="micro">Body map · select a region</span>
                <div className="seg" role="group" aria-label="Body map view">
                  <button type="button" aria-pressed={show3d} onClick={() => setView("3d")} disabled={failed3d} title={failed3d ? "3D is not available on this device" : undefined}>
                    3D
                  </button>
                  <button type="button" aria-pressed={!show3d} onClick={() => setView("2d")}>
                    2D
                  </button>
                </div>
              </div>
              <StatusLegend />
            </div>
            {show3d ? (
              <>
                <Guard3D onError={() => setFailed3d(true)}>
                  <Suspense fallback={<div className="body3d__stage body3d__loading micro">Loading NASA astronaut model…</div>}>
                    <BodyMap3D statuses={statuses} selected={region} onSelect={setSelected} onFail={() => setFailed3d(true)} />
                  </Suspense>
                </Guard3D>
                <div className="region-chips" role="group" aria-label="Body regions">
                  {REGION_ORDER.map((r) => (
                    <button key={r} type="button" className="region-chip" aria-pressed={region === r} onClick={() => setSelected(r)}>
                      <StatusIcon status={statuses[r].status} />
                      {SHORT_NAME[r]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <BodyMap statuses={statuses} selected={region} onSelect={setSelected} />
            )}
          </div>
          <RegionPanel
            region={region}
            status={statuses[region].status}
            reason={statuses[region].reason}
            rec={rec}
            metricHref={metricHref}
            canLog={canLog && api.supports.symptoms}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="ind-title">
        <div className="section__head">
          <h2 id="ind-title">Indicators</h2>
          <span className="small text-2">Last 14 days · band = {rec.perspective === "astronaut" ? "your" : "their"} usual range</span>
        </div>
        <div className="indicators">
          {rec.indicators.map((ind) => (
            <IndicatorCard key={ind.key} ind={ind} mission={rec.mission} to={metricHref(ind.key)} flag={flagged.get(ind.key)} />
          ))}
        </div>
      </section>

      {rec.worthChecking.length > 0 && (
        <section className="section" aria-labelledby="worth-title">
          <h2 id="worth-title">Worth checking</h2>
          <div className="kv-list" style={{ background: "var(--c-surface)" }}>
            {rec.worthChecking.map((w) => (
              <Link key={w.id} to={w.ref?.kind === "metric" ? metricHref(w.ref.key) : "#"} className="kv-row" style={{ padding: "12px 16px" }}>
                <span className="row" style={{ ["--gap" as string]: "12px", flexWrap: "nowrap" }}>
                  <StatusIcon status="watch" size={14} />
                  <span>
                    <span className="strong">{w.title}</span>
                    <br />
                    <span className="text-2 small">{w.detail}</span>
                  </span>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <BloodCard />
    </div>
  );
}
