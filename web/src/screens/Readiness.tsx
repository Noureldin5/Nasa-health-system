import { api } from "../api/client";
import type { Readiness as R } from "../api/types";
import { Icon } from "../components/icons";
import { StatusIcon } from "../components/status";
import { Empty, ErrorNote, PageHead } from "../components/ui";
import { DISCLAIMER } from "../content/sources";
import { useQuery } from "../lib/app";

/**
 * Crew Readiness (S3): what the commander sees to plan the day. A level and a
 * reason per person, never raw medical data. Each astronaut sees the same
 * object about themselves on their Consult screen.
 */
export const READINESS_META: Record<R["level"], { word: string; status: "ok" | "watch" | "learning"; hint: string }> = {
  ready: { word: "Ready", status: "ok", hint: "Normal workload is fine." },
  check: { word: "Check in", status: "watch", hint: "Ask how they are before assigning heavy or fine-motor tasks." },
  learning: { word: "Learning", status: "learning", hint: "Baseline still being learned. Treat as ready unless they say otherwise." },
};

export function Readiness() {
  const ready = useQuery("readiness", () => api.getReadiness());
  const crew = useQuery("crew", () => api.getCrew());
  const list = ready.data ?? [];
  const counts = { ready: list.filter((r) => r.level === "ready").length, check: list.filter((r) => r.level === "check").length };

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={ready.error} />
      <PageHead
        title="Crew readiness"
        sub="For planning the day: a readiness level and a reason per person. No raw medical data. Each astronaut sees exactly what is shown here about them."
      />
      <div className="banner banner--plain">
        <Icon name="eye" size={18} />
        <span>
          Open record: this is the same object each crew member sees on their own Consult screen, under <b>What the commander sees</b>.
        </span>
      </div>
      {list.length === 0 && ready.data && <Empty>No crew readiness yet.</Empty>}
      {list.length > 0 && (
        <>
          <p className="text-2">
            {counts.ready} ready · {counts.check} to check in with
          </p>
          <div className="readiness-grid">
            {list.map((r) => {
              const m = READINESS_META[r.level];
              const c = crew.data?.find((x) => x.id === r.crewId);
              return (
                <article key={r.crewId} className={`readiness readiness--${r.level}`} aria-label={`${c?.name ?? r.crewId}: ${m.word}. ${r.reason}`}>
                  <header className="row" style={{ flexWrap: "nowrap" }}>
                    <span className="avatar avatar--lg">{c?.initials ?? r.crewId.toUpperCase()}</span>
                    <span className="grow">
                      <span className="strong">{c?.name ?? r.crewId}</span>
                      <br />
                      <span className="small muted">{c?.role ?? "Crew member"}</span>
                    </span>
                  </header>
                  <div className="readiness__level">
                    <StatusIcon status={m.status} size={20} />
                    {m.word}
                  </div>
                  <p className="text-2">{r.reason}</p>
                  <p className="small muted readiness__hint">{m.hint}</p>
                </article>
              );
            })}
          </div>
        </>
      )}
      <p className="small muted">{DISCLAIMER} Readiness supports planning. It is not a fitness-for-duty decision.</p>
    </div>
  );
}

/** "What the commander sees about you" on the astronaut's own screens. */
export function MyReadiness({ readiness }: { readiness: R | null }) {
  if (!readiness) return null;
  const m = READINESS_META[readiness.level];
  return (
    <section className="card" aria-labelledby="my-readiness">
      <div className="card__body row row--between">
        <div className="stack" style={{ ["--gap" as string]: "4px" }}>
          <span className="micro" id="my-readiness">
            What the commander sees about you
          </span>
          <span className="row" style={{ ["--gap" as string]: "10px" }}>
            <StatusIcon status={m.status} size={16} />
            <span className="strong" style={{ fontSize: 18 }}>
              {m.word}
            </span>
            <span className="text-2">· {readiness.reason}</span>
          </span>
        </div>
        <span className="small muted">A level and a reason only. No raw medical data.</span>
      </div>
    </section>
  );
}
