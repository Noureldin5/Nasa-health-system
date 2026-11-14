import type { Status } from "../api/types";

/**
 * Status is always shape + word + color (docs/DESIGN.md, docs/REQUIREMENTS.md M3):
 *   circle   "In range"   green
 *   triangle "Watch"      yellow
 *   diamond  "Act now"    red
 *   dashed circle "Learning" (calibration), hollow circle "No data".
 */
export const STATUS_WORD: Record<Status, string> = {
  ok: "In range",
  watch: "Watch",
  act: "Act now",
  learning: "Learning",
  nodata: "No data",
};

const COLOR: Record<Status, string> = {
  ok: "var(--c-ok)",
  watch: "var(--c-watch)",
  act: "var(--c-act)",
  learning: "var(--c-text-2)",
  nodata: "var(--c-muted)",
};

export function StatusIcon({ status, size = 12 }: { status: Status; size?: number }) {
  const c = COLOR[status];
  return (
    <svg className="status-icon" width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {status === "ok" && <circle cx="6" cy="6" r="5" fill={c} />}
      {status === "watch" && <path d="M6 0.8 11.4 10.8H0.6Z" fill={c} />}
      {status === "act" && <path d="M6 0.4 11.6 6 6 11.6 0.4 6Z" fill={c} />}
      {status === "learning" && <circle cx="6" cy="6" r="4.4" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="2.2 1.8" />}
      {status === "nodata" && <circle cx="6" cy="6" r="4.4" fill="none" stroke={c} strokeWidth="1.4" />}
    </svg>
  );
}

export function StatusPill({ status, label, size }: { status: Status; label?: string; size?: "lg" }) {
  return (
    <span className={`pill pill--${status}${size ? ` pill--${size}` : ""}`}>
      <StatusIcon status={status} size={size === "lg" ? 14 : 12} />
      <span>{label ?? STATUS_WORD[status]}</span>
    </span>
  );
}

/** Legend that explains the three shapes once per screen. */
export function StatusLegend() {
  return (
    <div className="legend" aria-label="Status legend">
      {(["ok", "watch", "act", "learning"] as Status[]).map((s) => (
        <span key={s} className="legend__item">
          <StatusIcon status={s} />
          {STATUS_WORD[s]}
        </span>
      ))}
    </div>
  );
}
