import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { CrewId, MetricKey, NoteTarget } from "../api/types";
import { INDICATORS, METRIC_ORDER } from "../content/indicators";
import { useAction } from "../lib/app";
import { Icon } from "./icons";

type Mode = "note" | "flag" | "request";
const REQUESTABLE: MetricKey[] = ["bp", "hr", "glucose", "temp"];

/**
 * What the flight surgeon can do (docs/USER-FLOW.md): add a note to any item,
 * set a watch flag, request a measurement. Everything is queued for the next
 * link and appears in the astronaut's app word for word. No ground-only field.
 */
export function GroundActions({ crewId, crewName, metric }: { crewId: CrewId; crewName: string; metric?: MetricKey }) {
  const [mode, setMode] = useState<Mode>("note");
  const [target, setTarget] = useState<string>(metric ?? "record");
  const [text, setText] = useState("");
  const { run, busy } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const m = target as MetricKey;
    if (mode === "note") {
      const t: NoteTarget = target === "record" ? { kind: "record" } : target === "cabin" ? { kind: "cabin" } : { kind: "metric", key: m };
      await run(() => api.postNote(crewId, t, text), "Note queued. It reaches the astronaut at the next link.");
    } else if (mode === "flag") {
      await run(() => api.postFlag(crewId, m, text), "Watch flag queued for the next link.");
    } else {
      await run(() => api.postRequest(crewId, m, text), "Measurement request queued for the next link.");
    }
    setText("");
  }

  const metricOptions = mode === "request" ? REQUESTABLE : METRIC_ORDER;
  const validTarget = mode === "note" ? target : metricOptions.includes(target as MetricKey) ? target : metricOptions[0];

  return (
    <form className="card" onSubmit={submit} aria-labelledby="ga-title">
      <header className="card__head">
        <div className="stack" style={{ ["--gap" as string]: "2px" }}>
          <span className="micro">Write to {crewName}</span>
          <h2 id="ga-title" style={{ fontSize: "var(--fs-h3)" }}>
            Note, watch flag or measurement request
          </h2>
        </div>
      </header>
      <div className="card__body stack">
        <div className="role-switch" role="group" aria-label="What to write" style={{ alignSelf: "flex-start" }}>
          {(
            [
              ["note", "Note", "note"],
              ["flag", "Watch flag", "flag"],
              ["request", "Request a measurement", "request"],
            ] as const
          ).map(([m, label, icon]) => (
            <a
              key={m}
              href={`#${m}`}
              className={mode === m ? "is-active" : ""}
              aria-pressed={mode === m}
              onClick={(e) => {
                e.preventDefault();
                setMode(m);
              }}
            >
              <Icon name={icon} size={15} />
              {label}
            </a>
          ))}
        </div>
        <label className="field">
          <span className="field__label">{mode === "note" ? "On" : "Indicator"}</span>
          <select className="select" value={validTarget} onChange={(e) => setTarget(e.target.value)}>
            {mode === "note" && <option value="record">Whole record</option>}
            {metricOptions.map((k) => (
              <option key={k} value={k}>
                {INDICATORS[k].label}
              </option>
            ))}
            {mode === "note" && <option value="cabin">Cabin CO2</option>}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{mode === "note" ? "Note" : "Reason"}</span>
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "note"
                ? "Expected after the schedule shift, I will recheck on day 16."
                : mode === "flag"
                  ? "Short sleep for 4 nights. I am keeping an eye on it with you."
                  : "Temperature on day 14, to tell a fever apart from a CO2 headache."
            }
          />
          <span className="field__hint">Advice to a colleague, not an order. {`${crewName}`} sees this exact wording, your name and the time.</span>
        </label>
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy || !text.trim()}>
          <Icon name="antenna" size={18} /> Queue for next link
        </button>
      </div>
    </form>
  );
}
