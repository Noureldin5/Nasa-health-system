import type { KeyboardEvent } from "react";
import type { RegionKey, Status } from "../api/types";
import { REGION_ORDER, REGIONS } from "../content/regions";
import { StatusIcon, STATUS_WORD } from "./status";

/*
 * Clickable 2D body map (docs/REQUIREMENTS.md M1): the same NASA astronaut as the 3D view, as a
 * still picture. The figure is a front render of NASA's EMU spacesuit model made with the 3D view's
 * own lighting (public/models/README.md), so it needs no WebGL and works on any device. Each region
 * carries a status marker (shape + color) and a callout button with a leader line. A soft tint in
 * the status color lies on the suit under each marker, as in 3D. On narrow screens the callouts
 * hide and the button list below the figure takes over.
 */

const FIGURE_URL = `${import.meta.env.BASE_URL}models/nasa-astronaut-emu-front.webp`;
/** Size of the rendered picture in pixels, and where it sits in the 640 x 600 drawing. */
const PIC = { w: 1103, h: 1200 };
const BOX = { y: 30, h: 540 };
const FIG = { x: 320 - (BOX.h * PIC.w) / PIC.h / 2, y: BOX.y, w: (BOX.h * PIC.w) / PIC.h, h: BOX.h };

/**
 * Region anchors as fractions of the picture (0 to 1 from its left and top edge). Measured by the
 * render script from the same anchors the 3D view snaps to the suit, so 2D and 3D agree.
 */
const ANCHOR: Record<RegionKey, [number, number]> = {
  brain: [0.5, 0.1393],
  heart: [0.5543, 0.3463],
  blood: [0.2341, 0.3167],
  metabolism: [0.5, 0.4786],
  bones: [0.4305, 0.7143],
  muscles: [0.574, 0.8259],
};
const at = (r: RegionKey): [number, number] => [FIG.x + ANCHOR[r][0] * FIG.w, FIG.y + ANCHOR[r][1] * FIG.h];

const SHORT: Record<RegionKey, string> = {
  brain: "Brain and eyes",
  heart: "Heart and vessels",
  blood: "Blood and immune",
  metabolism: "Metabolism",
  bones: "Bones",
  muscles: "Muscles",
};

const BOX_W = 180;
const BOX_H = 54;
/** Callout boxes sit above or below the outstretched arms, never on them. */
const CALLOUT: Record<RegionKey, { side: "left" | "right"; boxY: number; drop?: boolean }> = {
  brain: { side: "left", boxY: 22 },
  blood: { side: "left", boxY: 90, drop: true }, // the marker is right under the box: the leader drops straight down
  bones: { side: "left", boxY: 396 },
  heart: { side: "right", boxY: 244 },
  metabolism: { side: "right", boxY: 316 },
  muscles: { side: "right", boxY: 456 },
};

const STATUS_COLOR: Record<Status, string> = {
  ok: "var(--c-ok)",
  watch: "var(--c-watch)",
  act: "var(--c-act)",
  learning: "var(--c-text-2)",
  nodata: "var(--c-muted)",
};
/** How far the status tint spreads on the suit, in drawing units. Quiet for "in range". */
const TINT: Partial<Record<Status, { r: number; opacity: number }>> = {
  ok: { r: 44, opacity: 0.5 },
  watch: { r: 62, opacity: 0.95 },
  act: { r: 68, opacity: 1 },
};

function Marker({ status, x, y, r = 8 }: { status: Status; x: number; y: number; r?: number }) {
  const c = STATUS_COLOR[status];
  const ring = { stroke: "var(--c-head)", strokeWidth: 3 };
  if (status === "watch") return <path d={`M${x} ${y - r * 1.15} L${x + r * 1.15} ${y + r * 0.85} L${x - r * 1.15} ${y + r * 0.85} Z`} fill={c} {...ring} strokeLinejoin="round" />;
  if (status === "act") return <path d={`M${x} ${y - r * 1.2} L${x + r * 1.2} ${y} L${x} ${y + r * 1.2} L${x - r * 1.2} ${y} Z`} fill={c} {...ring} strokeLinejoin="round" />;
  if (status === "ok") return <circle cx={x} cy={y} r={r} fill={c} {...ring} />;
  // Learning and "not tracked": a hollow ring with a dark core, readable on the white suit.
  return (
    <g>
      <circle cx={x} cy={y} r={r + 1} fill="var(--c-surface)" stroke="var(--c-head)" strokeWidth="2" />
      <circle cx={x} cy={y} r={r - 2.5} fill="none" stroke={status === "learning" ? "var(--c-text)" : c} strokeWidth="2" strokeDasharray={status === "learning" ? "3 2" : undefined} />
    </g>
  );
}

export function BodyMap({ statuses, selected, onSelect }: {
  statuses: Record<RegionKey, { status: Status; reason: string }>;
  selected: RegionKey | null;
  onSelect: (r: RegionKey) => void;
}) {
  function onKey(e: KeyboardEvent<SVGGElement>, r: RegionKey) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(r);
    }
  }
  const feetY = FIG.y + FIG.h - 6;

  return (
    <>
      <svg className="bodymap__svg" viewBox="0 0 640 600" role="group" aria-label="Body map on a NASA astronaut in the EMU spacesuit. Select a region to see its status and explainer.">
        <defs>
          {(["ok", "watch", "act"] as Status[]).map((s) => (
            <radialGradient key={s} id={`bm-tint-${s}`}>
              <stop offset="0" style={{ stopColor: STATUS_COLOR[s], stopOpacity: 1 }} />
              <stop offset="0.55" style={{ stopColor: STATUS_COLOR[s], stopOpacity: 0.45 }} />
              <stop offset="1" style={{ stopColor: STATUS_COLOR[s], stopOpacity: 0 }} />
            </radialGradient>
          ))}
          <radialGradient id="bm-shadow">
            <stop offset="0" stopColor="#000" stopOpacity="0.6" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Scanner platform and contact shadow under the boots, as in the 3D view. */}
        <g aria-hidden="true">
          <ellipse cx="320" cy={feetY} rx="150" ry="17" fill="none" stroke="var(--c-line-strong)" />
          <ellipse cx="320" cy={feetY} rx="112" ry="12.5" fill="none" stroke="var(--c-line-strong)" />
          <ellipse cx="320" cy={feetY} rx="132" ry="15" fill="url(#bm-shadow)" />
          <image href={FIGURE_URL} x={FIG.x} y={FIG.y} width={FIG.w} height={FIG.h} preserveAspectRatio="xMidYMid meet" />
          {/* Status tint on the suit: multiplied, so it colors the white suit and vanishes on the dark background. */}
          {REGION_ORDER.map((r) => {
            const t = TINT[statuses[r].status];
            const [x, y] = at(r);
            return t ? <circle key={r} className="bm-tint" cx={x} cy={y} r={t.r} fill={`url(#bm-tint-${statuses[r].status})`} opacity={t.opacity} /> : null;
          })}
        </g>

        <g className="bm-callouts">
          {REGION_ORDER.map((r) => {
            const g = CALLOUT[r];
            const st = statuses[r];
            const [mx, my] = at(r);
            const boxX = g.side === "left" ? 16 : 640 - 16 - BOX_W;
            const edgeX = g.side === "left" ? boxX + BOX_W : boxX;
            const cy = g.boxY + BOX_H / 2;
            const elbowX = g.side === "left" ? edgeX + 16 : edgeX - 16;
            const on = selected === r;
            const leader = g.drop ? `${mx},${g.boxY + BOX_H} ${mx},${my}` : `${edgeX},${cy} ${elbowX},${cy} ${mx},${my}`;
            return (
              <g key={r}>
                <polyline className={`bm-leader${on ? " bm-leader--on" : ""}`} points={leader} />
                <g
                  className="bm-callout"
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`${REGIONS[r].label}: ${STATUS_WORD[st.status]}. ${st.reason}.`}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => onKey(e, r)}
                >
                  <rect className="bm-box" x={boxX} y={g.boxY} width={BOX_W} height={BOX_H} rx="6" />
                  <rect className="bm-focus" x={boxX - 3} y={g.boxY - 3} width={BOX_W + 6} height={BOX_H + 6} rx="8" fill="none" stroke="none" />
                  <text className="bm-name" x={boxX + 14} y={g.boxY + 22}>
                    {SHORT[r]}
                  </text>
                  <g transform={`translate(${boxX + 14},${g.boxY + 32})`}>
                    <StatusGlyph status={st.status} />
                  </g>
                  <text className="bm-status" x={boxX + 32} y={g.boxY + 42}>
                    {truncate(calloutText(st.status, st.reason), 22)}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {REGION_ORDER.map((r) => {
          const [x, y] = at(r);
          return (
            <g key={r} style={{ cursor: "pointer" }} onClick={() => onSelect(r)} aria-hidden="true">
              <circle cx={x} cy={y} r="22" fill="transparent" />
              {selected === r && <circle className="bm-ring" cx={x} cy={y} r="19" />}
              <Marker status={statuses[r].status} x={x} y={y} />
            </g>
          );
        })}

        <text className="bm-credit" x="624" y="594" textAnchor="end">
          MODEL: NASA 3D RESOURCES · EMU SPACESUIT
        </text>
      </svg>
      <div className="bodymap__list">
        {REGION_ORDER.map((r) => (
          <button key={r} type="button" className="region-btn" aria-pressed={selected === r} onClick={() => onSelect(r)}>
            <StatusIcon status={statuses[r].status} size={14} />
            <span className="region-btn__name">{SHORT[r]}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function StatusGlyph({ status }: { status: Status }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" x="0" y="0" aria-hidden="true">
      {status === "ok" && <circle cx="6" cy="6" r="5" fill={STATUS_COLOR.ok} />}
      {status === "watch" && <path d="M6 0.8 11.4 10.8H0.6Z" fill={STATUS_COLOR.watch} />}
      {status === "act" && <path d="M6 0.4 11.6 6 6 11.6 0.4 6Z" fill={STATUS_COLOR.act} />}
      {(status === "learning" || status === "nodata") && (
        <circle cx="6" cy="6" r="4.4" fill="none" stroke={STATUS_COLOR[status]} strokeWidth="1.4" strokeDasharray={status === "learning" ? "2.2 1.8" : undefined} />
      )}
    </svg>
  );
}

/** Status word first (never color alone), then the reason if it adds something. */
function calloutText(status: Status, reason: string) {
  if (status === "ok") return STATUS_WORD.ok;
  if (status === "nodata") return "Not tracked";
  if (status === "learning") return STATUS_WORD.learning;
  return `${STATUS_WORD[status]} · ${reason.toLowerCase()}`;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
