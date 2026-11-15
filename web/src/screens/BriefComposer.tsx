import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { BriefDraft } from "../api/types";
import { AssistantNote, useAssist } from "../components/assistant";
import { Icon } from "../components/icons";
import { PageHead } from "../components/ui";
import { ME, useAction, useQuery } from "../lib/app";

/**
 * Drafted consult brief (D5, U5): the alert's items are pinned, the question
 * is suggested and editable, sending queues it for the next ground link.
 */
export function BriefComposer() {
  const [params] = useSearchParams();
  const alertId = params.get("alert");
  const followup = params.get("followup");
  const nav = useNavigate();
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  const draftQ = useQuery(`draft-${alertId ?? ""}-${followup ?? ""}`, () => api.draftBrief(ME, alertId));
  const [draft, setDraft] = useState<BriefDraft | null>(null);
  const [include, setInclude] = useState<boolean[]>([]);
  const { run, busy } = useAction();
  const cabin = useQuery(`cabin-${ME}-a`, () => api.getCabin(ME, "astronaut"));
  const drafter = useAssist();

  /** The record assistant drafts the question from the pinned items. The astronaut edits and sends. */
  async function draftWithAssistant() {
    if (!draft || !rec.data) return;
    const pinned = draft.pinned.filter((_, i) => include[i] ?? true);
    const out = await drafter.run("draft_brief", { rec: rec.data, cabin: cabin.data ?? null }, { pinned });
    if (out.source !== "rule" && out.text) setDraft((d) => (d ? { ...d, question: out.text } : d));
  }

  useEffect(() => {
    if (!draftQ.data || draft) return;
    if (followup && rec.data) {
      const orig = rec.data.briefs.find((b) => b.id === followup);
      const d = { question: "", pinned: orig?.pinned ?? [], alertId: orig?.alertId ?? null };
      setDraft(d);
      setInclude(d.pinned.map(() => true));
      return;
    }
    if (followup) return;
    setDraft(draftQ.data);
    setInclude(draftQ.data.pinned.map(() => true));
  }, [draftQ.data, rec.data, followup, draft]);

  async function send() {
    if (!draft || !draft.question.trim()) return;
    const out = await run(
      () => api.createBrief(ME, { ...draft, pinned: draft.pinned.filter((_, i) => include[i]) }),
      "Queued. It goes to ground at the next link. Press Sync now to open a link window in the demo.",
    );
    if (out) nav("/consult");
  }

  const original = followup ? rec.data?.briefs.find((b) => b.id === followup) : null;

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)", maxWidth: 880 }}>
      <PageHead
        crumb={
          <Link to="/consult" className="crumb">
            <Icon name="chevron-left" size={16} /> Consult
          </Link>
        }
        title={followup ? "Ask a follow-up" : "Ask the flight surgeon"}
        sub="Check the question and send. The reply comes back as advice from a colleague, not an order."
      />
      {!draft ? (
        <div className="loading" style={{ minHeight: 300 }} aria-busy="true" />
      ) : (
        <>
          {original && (
            <div className="banner banner--plain">
              <Icon name="consult" size={18} /> Following up on: “{original.question}”
            </div>
          )}
          <section className="card" aria-labelledby="q-title">
            <header className="card__head">
              <h2 id="q-title" style={{ fontSize: "var(--fs-h3)" }}>
                Your question
              </h2>
              <div className="row">
                <span className="small muted">Edit freely</span>
                <button type="button" className="btn btn--secondary" onClick={draftWithAssistant} disabled={drafter.busy || !rec.data}>
                  <Icon name="draft" size={16} /> {drafter.busy ? "Drafting" : "Draft from pinned items"}
                </button>
              </div>
            </header>
            <div className="card__body">
              <label className="field">
                <span className="sr-only">Question for the flight surgeon</span>
                <textarea
                  className="textarea"
                  style={{ fontSize: "var(--fs-lead)", minHeight: 168 }}
                  value={draft.question}
                  onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                  placeholder="What would you like to ask?"
                  autoFocus
                />
              </label>
              {(drafter.result || drafter.busy) && (
                <div style={{ marginTop: 12 }}>
                  <AssistantNote result={drafter.result} busy={drafter.busy} title="Question drafted by the record assistant" textless linkCites={false} />
                </div>
              )}
            </div>
          </section>

          <section className="card" aria-labelledby="pin-title">
            <header className="card__head">
              <div className="stack" style={{ ["--gap" as string]: "2px" }}>
                <span className="micro">Pinned for the flight surgeon</span>
                <h2 id="pin-title" style={{ fontSize: "var(--fs-h3)" }}>
                  Look here first
                </h2>
              </div>
              <Link to="/consult/ground-view" className="btn btn--ghost">
                <Icon name="eye" size={16} /> What ground sees
              </Link>
            </header>
            <div className="card__body stack">
              {draft.pinned.length ? (
                <div className="pins">
                  {draft.pinned.map((p, i) => (
                    <label key={i} className="pin" style={{ cursor: api.supports.pinEditing ? "pointer" : "default", alignItems: "center" }}>
                      {api.supports.pinEditing ? (
                        <input
                          type="checkbox"
                          checked={include[i] ?? true}
                          onChange={(e) => setInclude((x) => x.map((v, j) => (j === i ? e.target.checked : v)))}
                          style={{ width: 20, height: 20, accentColor: "var(--c-action)" }}
                        />
                      ) : (
                        <Icon name="pin" size={18} style={{ color: "var(--c-text-2)" }} />
                      )}
                      <span>
                        <span className="pin__label">{p.label}</span>
                        <br />
                        <span className="pin__summary">{p.summary}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-2">Nothing pinned. The flight surgeon sees your full record either way.</p>
              )}
              <p className="small muted">Pins only point the flight surgeon to where to look first. Your whole record is on ground either way. Nothing is hidden.</p>
            </div>
          </section>

          <div className="row">
            <button type="button" className="btn btn--primary btn--lg" onClick={send} disabled={busy || !draft.question.trim()}>
              <Icon name="antenna" size={18} /> Send at next ground link
            </button>
            <Link to="/consult" className="btn btn--ghost">
              Cancel
            </Link>
          </div>
          <p className="small muted">Listed in your sync log when it is sent.</p>
        </>
      )}
    </div>
  );
}
