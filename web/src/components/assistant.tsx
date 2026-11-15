import { useCallback, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { assist, citeLabel, citeValue, SOURCE_NOTE, type AiResult, type AskOptions, type Feature } from "../ai/assistant";
import type { Cite, RecordCtx } from "../ai/facts";
import { Icon } from "./icons";

/** Run one assistant feature. A newer call wins over an older one that is still on its way. */
export function useAssist() {
  const [result, setResult] = useState<AiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const run = useCallback(async (feature: Feature, ctx: RecordCtx, opts?: AskOptions) => {
    const id = ++seq.current;
    setBusy(true);
    try {
      const out = await assist(feature, ctx, opts);
      if (id === seq.current) setResult(out);
      return out;
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, []);
  const clear = useCallback(() => {
    seq.current += 1;
    setResult(null);
    setBusy(false);
  }, []);
  return { result, busy, run, clear };
}

const SOURCE_TAG: Record<AiResult["source"], string> = {
  model: "Language model",
  cache: "Saved model answer",
  rule: "Safety rule",
  canned: "Fixed rules · no model used",
};

/** Where a cite opens: the indicator chart, or Cabin Link for CO2 and headaches, with the days highlighted. */
export function citeHref(cites: Cite[], c: Cite): string {
  const days = [...new Set(cites.filter((x) => x.metric === c.metric).map((x) => x.day))].sort((a, b) => a - b).join(",");
  return c.metric === "co2" || c.metric === "headache" ? `/cabin?hl=${days}` : `/health/${c.metric}?hl=${days}`;
}

export function CiteChips({ result, link = true }: { result: AiResult; link?: boolean }) {
  if (!result.cites.length) return null;
  return (
    <ul className="cites" aria-label="Values from your record that this text refers to">
      {result.cites.map((c) => {
        const body = (
          <>
            <span className="cite__metric">{citeLabel(c)}</span>
            <span className="cite__day">Day {c.day}</span>
            <span className="cite__value">{citeValue(result.facts, c)}</span>
          </>
        );
        return (
          <li key={`${c.metric}-${c.day}`}>
            {link ? (
              <Link to={citeHref(result.cites, c)} className="cite" title="Open the chart with this day highlighted">
                {body}
              </Link>
            ) : (
              <span className="cite">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Every piece of assistant text looks the same: a dashed "draft" frame, who wrote it (model, saved
 * answer, safety rule or fixed rules), and the cited values read from the record.
 */
export function AssistantNote({ result, busy, title = "Record assistant", children, linkCites = true, textless = false }: {
  result: AiResult | null;
  busy?: boolean;
  title?: string;
  children?: ReactNode;
  linkCites?: boolean;
  /** The text itself is shown elsewhere (an editable field): show only who wrote it and what it cites. */
  textless?: boolean;
}) {
  if (!result && !busy) return null;
  return (
    <div className={`draft${result?.source === "rule" ? " draft--rule" : ""}`} aria-live="polite" aria-busy={busy || undefined}>
      <div className="draft__head">
        <span className="micro draft__who">
          <Icon name={result?.source === "rule" ? "info" : "draft"} size={14} /> {title} · {result?.source === "rule" ? "rule" : "draft"}
        </span>
        {result && (
          <span className="tag" title={`${SOURCE_NOTE[result.source]}${result.model && result.source !== "canned" ? ` (${result.model})` : ""}.`}>
            {result.source === "canned" && result.reason === "no_live_link" ? "Fixed rules · no live link at this distance" : SOURCE_TAG[result.source]}
            {result.model && (result.source === "model" || result.source === "cache") ? ` · ${result.model}` : ""}
          </span>
        )}
      </div>
      {busy && !result ? (
        <div className="draft__wait" role="status">
          <span className="draft__line" />
          <span className="draft__line" style={{ width: "82%" }} />
          <span className="draft__line" style={{ width: "58%" }} />
          <span className="sr-only">Reading your record</span>
        </div>
      ) : (
        result && (
          <>
            {(!textless || result.source === "rule") && (
              <p className="draft__text" style={busy ? { opacity: 0.5 } : undefined}>
                {result.text || "There is nothing in your record to answer this from."}
              </p>
            )}
            <CiteChips result={result} link={linkCites} />
            {children}
            <Sent result={result} />
            {result.source !== "rule" && (
              <p className="small muted">Restates your own record: it does not assess it and is not a diagnosis. Chip values are read from the record, not from the model.</p>
            )}
          </>
        )
      )}
    </div>
  );
}

/** Open record applies to the assistant too: the astronaut can read exactly what left the station. */
function Sent({ result }: { result: AiResult }) {
  if (result.source === "rule" || result.source === "canned") {
    return <p className="small muted draft__sent">Nothing left the station for this answer.</p>;
  }
  const who = result.provider ? `${result.provider} (${result.model})` : "the language model";
  return (
    <details className="draft__sent">
      <summary>{result.source === "cache" ? `Saved answer. Nothing was sent this time. What was sent to ${who} the first time` : `What was sent to ${who}`}</summary>
      <pre tabIndex={0}>{JSON.stringify({ question: result.question, facts: result.facts }, null, 1)}</pre>
    </details>
  );
}
