import { useEffect, useState } from "react";
import { fmtLightTime, LINK_PROFILE_ORDER, LINK_PROFILES } from "../content/lightTime";
import { useApp } from "../lib/app";
import { plural } from "../lib/format";

/** Fraction of the current leg that has elapsed, 0 to 1. Drives the light-time clock. */
function useLeg(phase: string | undefined, legMs: number) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (phase !== "up" && phase !== "down") return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const v = Math.min(1, (performance.now() - start) / legMs);
      setF(v);
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, legMs]);
  return f;
}

/**
 * The ground link made visible: while a sync runs, the queued items travel from the station to
 * ground and the replies travel back, with a clock in real signal time for the chosen distance.
 * The animation is time-compressed and says so. Shown under the top bar on every screen.
 */
export function SignalStrip() {
  const { transmission: t, linkProfile: p } = useApp();
  const f = useLeg(t?.phase, t?.legMs ?? 1);
  if (!t) return null;
  const basis = p.basis === "nasa" ? "NASA" : "derived";
  const speedup = Math.max(1, Math.round((p.oneWaySec * 1000) / t.legMs));
  const moved = t.entry ? [...t.entry.toGround.slice(0, 2).map((i) => `↑ ${i.label}`), ...t.entry.fromGround.slice(0, 2).map((i) => `↓ ${i.label}`)] : [];

  return (
    <div className={`signal signal--${t.phase}`}>
      {/* Announced once per phase. The running clock below is visual only. */}
      <span className="sr-only" role="status">
        {t.phase === "up" ? `Ground link open. Sending to ground. Signal time one way ${p.delayText}.` : t.phase === "down" ? "Receiving from ground." : "Ground link closed. Record in sync."}
      </span>
      <div className="signal__end">
        <span className="micro">Station</span>
        <b>{t.phase === "up" ? `Sending ${plural(t.up + 1, "item")}` : "On board"}</b>
      </div>
      <div className="signal__track" aria-hidden="true">
        <span className="signal__line" />
        {t.phase !== "done" && (
          <span key={t.phase} className="signal__packet" style={{ animationDuration: `${t.legMs}ms` }}>
            {t.phase === "up" ? `↑ record${t.up ? ` + ${t.up}` : ""}` : `↓ ${t.down ? plural(t.down, "item") : "nothing new"}`}
          </span>
        )}
      </div>
      <div className="signal__end signal__end--ground">
        <span className="micro">Ground · {p.short}</span>
        <b>{t.phase === "down" ? "Replying" : t.phase === "done" ? "In sync" : "Listening"}</b>
      </div>
      <p className="signal__meta" aria-hidden={t.phase === "done" ? undefined : true}>
        {t.phase === "done" ? (
          <>
            <b>Link closed.</b> {moved.length ? moved.join(" · ") : "Nothing new either way."}
          </>
        ) : (
          <>
            <b>{t.phase === "up" ? "Uplink" : "Downlink"}</b> · signal time one way {p.delayText} ({basis}) · <span className="num">T+ {fmtLightTime(f * p.oneWaySec)}</span>
            {speedup > 1 ? ` · shown ${speedup.toLocaleString("en-US")}× faster` : " · animation not to scale"}
          </>
        )}
      </p>
    </div>
  );
}

/** Mission distance picker with the delay, its source and what it means for a consult. */
export function LinkDistance() {
  const { linkProfile: p, setLinkProfile, syncing } = useApp();
  return (
    <div className="distance">
      <div className="row row--between">
        <span className="micro">Mission distance · sets the signal delay</span>
        <div className="seg" role="group" aria-label="Mission distance">
          {LINK_PROFILE_ORDER.map((k) => (
            <button key={k} type="button" aria-pressed={p.key === k} onClick={() => setLinkProfile(k)} disabled={syncing}>
              {LINK_PROFILES[k].short}
            </button>
          ))}
        </div>
      </div>
      <div className="distance__body">
        <div className="distance__figure">
          <span className="micro">Signal time, one way</span>
          <b>{p.delayText}</b>
          <span className={`tag${p.basis === "nasa" ? " tag--nasa" : ""}`}>{p.basis === "nasa" ? "NASA figure" : p.key === "station" ? "Derived · lower bound" : "Derived from a NASA distance"}</span>
        </div>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <p>{p.note}</p>
          <p className="small muted">
            {p.source}{" "}
            <a href={p.url} target="_blank" rel="noreferrer">
              Source
            </a>
            . The sync animation is not to scale (demo parameter).
          </p>
        </div>
      </div>
    </div>
  );
}
