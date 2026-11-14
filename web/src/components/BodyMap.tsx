import type { KeyboardEvent } from "react";
import type { RegionKey, Status } from "../api/types";
import { REGION_ORDER, REGIONS } from "../content/regions";
import { StatusIcon, STATUS_WORD } from "./status";

/*
 * Clickable body map (docs/REQUIREMENTS.md M1). One SVG drawn as a technical
 * diagram: a neutral silhouette, a status marker on each region (shape + color),
 * and callout buttons with leader lines. On narrow screens the callouts hide and
 * a button list below the figure takes over.
 */

const SHORT: Record<RegionKey, string> = {
  brain: "Brain and eyes",
  heart: "Heart and vessels",
  blood: "Blood and immune",
  metabolism: "Metabolism",
  bones: "Bones",
  muscles: "Muscles",
};

const GEO: Record<RegionKey, { marker: [number, number]; side: "left" | "right"; boxY: number }> = {
  brain: { marker: [320, 64], side: "left", boxY: 40 },
  blood: { marker: [228, 252], side: "left", boxY: 222 },
  bones: { marker: [292, 404], side: "left", boxY: 382 },
  heart: { marker: [338, 172], side: "right", boxY: 140 },
  metabolism: { marker: [320, 252], side: "right", boxY: 262 },
  muscles: { marker: [352, 500], side: "right", boxY: 470 },
};

const BOX_W = 180;
const BOX_H = 54;
const STATUS_COLOR: Record<Status, string> = {
  ok: "var(--c-ok)",
  watch: "var(--c-watch)",
  act: "var(--c-act)",
  learning: "var(--c-text-2)",
  nodata: "var(--c-muted)",
};

function Marker({ status, x, y, r = 7 }: { status: Status; x: number; y: number; r?: number }) {
  const c = STATUS_COLOR[status];
  const ring = { stroke: "var(--c-surface)", strokeWidth: 2.5 };
  if (status === "watch") return <path d={`M${x} ${y - r * 1.15} L${x + r * 1.15} ${y + r * 0.85} L${x - r * 1.15} ${y + r * 0.85} Z`} fill={c} {...ring} />;
  if (status === "act") return <path d={`M${x} ${y - r * 1.2} L${x + r * 1.2} ${y} L${x} ${y + r * 1.2} L${x - r * 1.2} ${y} Z`} fill={c} {...ring} />;
  if (status === "ok") return <circle cx={x} cy={y} r={r} fill={c} {...ring} />;
  return <circle cx={x} cy={y} r={r - 1} fill="var(--c-surface)" stroke={c} strokeWidth="1.6" strokeDasharray={status === "learning" ? "3 2" : undefined} />;
}

/* Silhouette parts: capsules (line + round caps) and two polygons. */
const CAPSULES: [number, number, number, number, number][] = [
  [320, 100, 320, 126, 26], // neck
  [256, 150, 228, 250, 30], // upper arms
  [384, 150, 412, 250, 30],
  [228, 250, 212, 340, 25], // forearms
  [412, 250, 428, 340, 25],
  [211, 342, 207, 372, 22], // hands
  [429, 342, 433, 372, 22],
  [297, 344, 291, 452, 44], // thighs
  [343, 344, 349, 452, 44],
  [291, 452, 289, 548, 32], // shins
  [349, 452, 351, 548, 32],
  [287, 556, 274, 562, 18], // feet
  [353, 556, 366, 562, 18],
];
const TORSO = "M262 132 Q320 119 378 132 Q396 138 398 160 L385 282 Q381 300 366 305 L274 305 Q259 300 255 282 L242 160 Q244 138 262 132 Z";
const PELVIS = "M270 296 L370 296 L378 350 Q320 374 262 350 Z";

function Silhouette() {
  const outline = "var(--c-line-strong)";
  const fill = "#232329";
  return (
    <g aria-hidden="true">
      {/* pass 1: outline, slightly larger */}
      <circle cx="320" cy="68" r="35.5" fill={outline} />
      <path d={TORSO} fill={outline} stroke={outline} strokeWidth="3" strokeLinejoin="round" />
      <path d={PELVIS} fill={outline} stroke={outline} strokeWidth="3" strokeLinejoin="round" />
      {CAPSULES.map(([x1, y1, x2, y2, w], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={outline} strokeWidth={w + 3} strokeLinecap="round" />
      ))}
      {/* pass 2: fill on top, so overlaps merge into one shape */}
      <circle cx="320" cy="68" r="34" fill={fill} />
      <path d={TORSO} fill={fill} />
      <path d={PELVIS} fill={fill} />
      {CAPSULES.map(([x1, y1, x2, y2, w], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={fill} strokeWidth={w} strokeLinecap="round" />
      ))}
      {/* faint anatomical guides */}
      <g stroke="var(--c-line-strong)" strokeWidth="1" fill="none" opacity="0.7">
        <path d="M300 62 h10 M330 62 h10" />
        <path d="M270 150 Q320 166 370 150" />
        <path d="M320 140 V296" strokeDasharray="2 5" />
        <path d="M282 330 Q320 344 358 330" />
      </g>
    </g>
  );
}

function Highlight({ region }: { region: RegionKey }) {
  const s = { stroke: "var(--c-link)", strokeWidth: 2, fill: "rgb(90 162 255 / 0.14)" };
  switch (region) {
    case "brain":
      return <circle cx="320" cy="68" r="34" {...s} />;
    case "heart":
      return <path d="M338 186 C 314 170, 318 146, 338 158 C 358 146, 362 170, 338 186 Z" {...s} />;
    case "blood":
      return (
        <g>
          <polyline points="256,150 228,250 212,340" fill="none" stroke="rgb(90 162 255 / 0.22)" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="252,156 226,250 211,336" fill="none" stroke="var(--c-link)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "metabolism":
      return <ellipse cx="320" cy="248" rx="44" ry="32" {...s} />;
    case "bones":
      return (
        <g stroke="var(--c-link)" strokeWidth="6" strokeLinecap="round">
          <line x1="296" y1="350" x2="291" y2="446" />
          <line x1="344" y1="350" x2="349" y2="446" />
          <line x1="290" y1="460" x2="289" y2="540" strokeWidth="4" />
          <line x1="350" y1="460" x2="351" y2="540" strokeWidth="4" />
        </g>
      );
    case "muscles":
      return (
        <g {...s}>
          <ellipse cx="290" cy="492" rx="15" ry="40" />
          <ellipse cx="350" cy="492" rx="15" ry="40" />
        </g>
      );
  }
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

  return (
    <>
      <svg className="bodymap__svg" viewBox="0 0 640 590" role="group" aria-label="Body map. Select a region to see its status and explainer.">
        <Silhouette />
        {selected && <Highlight region={selected} />}
        <g className="bm-callouts">
          {REGION_ORDER.map((r) => {
            const g = GEO[r];
            const st = statuses[r];
            const boxX = g.side === "left" ? 16 : 640 - 16 - BOX_W;
            const edgeX = g.side === "left" ? boxX + BOX_W : boxX;
            const cy = g.boxY + BOX_H / 2;
            const elbowX = g.side === "left" ? edgeX + 16 : edgeX - 16;
            const on = selected === r;
            return (
              <g key={r}>
                <polyline className={`bm-leader${on ? " bm-leader--on" : ""}`} points={`${edgeX},${cy} ${elbowX},${cy} ${g.marker[0]},${g.marker[1]}`} />
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
        {REGION_ORDER.map((r) => (
          <g key={r} style={{ cursor: "pointer" }} onClick={() => onSelect(r)} aria-hidden="true">
            <circle cx={GEO[r].marker[0]} cy={GEO[r].marker[1]} r="16" fill="transparent" />
            {selected === r && <circle cx={GEO[r].marker[0]} cy={GEO[r].marker[1]} r="13" fill="none" stroke="var(--c-link)" strokeWidth="1.5" />}
            <Marker status={statuses[r].status} x={GEO[r].marker[0]} y={GEO[r].marker[1]} />
          </g>
        ))}
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
