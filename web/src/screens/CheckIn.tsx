import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CheckInInput, CheckInResult, Headache } from "../api/types";
import { AlertCard } from "../components/record";
import { Icon } from "../components/icons";
import { StatusIcon, StatusPill } from "../components/status";
import { SourceTag } from "../components/ui";
import { MOOD_WORDS, RESTED_WORDS } from "../content/indicators";
import { DISCLAIMER } from "../content/sources";
import { ME, useApp, useQuery } from "../lib/app";
import { fmtPoint } from "../lib/format";

/*
 * The hero flow (D2, U2): 4 steps or fewer, one question per screen, big
 * targets, auto-advance, "Same as yesterday" finishes it in one tap, every step
 * can be skipped. Sleep and heart rate come from the wearable and are shown,
 * never asked.
 */

type Answers = Omit<CheckInInput, "sameAsYesterday">;
const STEPS = ["rested", "headache", "mood", "vision"] as const;
const SECONDS_PER_STEP = 5;

function Face({ level }: { level: number }) {
  // Mouth curve from sad (1) to happy (5); eyes fixed. Drawn, not emoji.
  const curve = [-5, -2.5, 0, 3, 5.5][level - 1];
  return (
    <svg className="face" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" />
      <circle cx="22" cy="14" r="1.6" fill="currentColor" />
      <path d={`M10.5 ${22 - curve / 2} Q17 ${22 + curve} 23.5 ${22 - curve / 2}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIn() {
  const nav = useNavigate();
  const { bump } = useApp();
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ rested: null, headache: null, mood: null, vision: null });
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(Date.now());
  const [took, setTook] = useState(0);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headRef.current?.focus();
  }, [step, result]);

  async function submit(input: CheckInInput) {
    setSaving(true);
    try {
      const res = await api.postCheckIn(ME, input);
      setTook(Math.round((Date.now() - started.current) / 1000));
      setResult(res);
      bump();
    } finally {
      setSaving(false);
    }
  }

  function choose<K extends keyof Answers>(key: K, value: Answers[K]) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setTimeout(() => advance(next), 160);
  }

  function advance(a: Answers = answers) {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else submit({ sameAsYesterday: false, ...a });
  }

  const sleep = rec.data?.indicators.find((i) => i.key === "sleep");
  const hr = rec.data?.indicators.find((i) => i.key === "hr");
  const left = (STEPS.length - step) * SECONDS_PER_STEP;

  return (
    <div className="checkin">
      <header className="checkin__bar">
        <Link to="/" className="icon-btn" aria-label="Close check-in">
          <Icon name="close" />
        </Link>
        {!result ? (
          <>
            <div className="checkin__progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of 4`}>
              {STEPS.map((s, i) => (
                <span key={s} className={i <= step ? "done" : ""} />
              ))}
            </div>
            <span className="micro">
              Step {step + 1} of 4 · about {left} s left
            </span>
          </>
        ) : (
          <span className="micro">Check-in saved · took {took} s</span>
        )}
      </header>

      <div className="checkin__body">
        {result ? (
          <Result result={result} headRef={headRef} onDone={() => nav("/")} />
        ) : (
          <>
            {step === 0 && (
              <>
                <div className="passive-strip" aria-label="Already measured by your wearable">
                  <div className="passive-strip__item">
                    <span className="micro">Slept</span>
                    <b>{sleep ? fmtPoint("sleep", sleep.latest) : "–"} h</b>
                  </div>
                  <div className="passive-strip__item">
                    <span className="micro">Resting HR</span>
                    <b>{hr ? fmtPoint("hr", hr.latest) : "–"} bpm</b>
                  </div>
                  <div className="passive-strip__item" style={{ justifyContent: "center" }}>
                    <span className="small text-2">Already read from your wearable. Nothing to type.</span>
                    <SourceTag source="sim" />
                  </div>
                </div>
                <h1 className="checkin__q" ref={headRef} tabIndex={-1}>
                  How rested do you feel?
                </h1>
                <div className="choices" style={{ ["--cols" as string]: 5 }} role="group" aria-label="How rested">
                  {RESTED_WORDS.map((w, i) => (
                    <button key={w} type="button" className="choice" aria-pressed={answers.rested === i + 1} onClick={() => choose("rested", (i + 1) as Answers["rested"])}>
                      <span className="num" style={{ fontSize: 22, color: "var(--c-text-strong)" }}>
                        {i + 1}
                      </span>
                      {w}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--lg btn--block"
                  onClick={() => submit({ sameAsYesterday: true, rested: null, headache: null, mood: null, vision: null })}
                  disabled={saving}
                >
                  <Icon name="check" size={18} />
                  Same as yesterday · finish in one tap
                </button>
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="checkin__q" ref={headRef} tabIndex={-1}>
                  Any headache?
                </h1>
                <p className="text-2">Headaches are among the most common symptoms in spaceflight. Telling the app never lowers any score.</p>
                <div className="choices" style={{ ["--cols" as string]: 4 }} role="group" aria-label="Headache">
                  {(
                    [
                      ["none", "None", ""],
                      ["mild", "Mild", "Noticeable"],
                      ["moderate", "Moderate", "Distracting"],
                      ["strong", "Strong", "Hard to work"],
                    ] as [Headache, string, string][]
                  ).map(([v, w, sub]) => (
                    <button key={v} type="button" className="choice" aria-pressed={answers.headache === v} onClick={() => choose("headache", v)}>
                      {w}
                      {sub && <span className="choice__sub">{sub}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="checkin__q" ref={headRef} tabIndex={-1}>
                  How is your mood?
                </h1>
                <div className="choices" style={{ ["--cols" as string]: 5 }} role="group" aria-label="Mood">
                  {MOOD_WORDS.map((w, i) => (
                    <button key={w} type="button" className="choice" aria-pressed={answers.mood === i + 1} onClick={() => choose("mood", (i + 1) as Answers["mood"])}>
                      <Face level={i + 1} />
                      {w}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="checkin__q" ref={headRef} tabIndex={-1}>
                  Any change in your vision?
                </h1>
                <p className="text-2">Blurry, spots, or harder to focus up close.</p>
                <div className="choices" style={{ ["--cols" as string]: 2 }} role="group" aria-label="Vision change">
                  <button type="button" className="choice" aria-pressed={answers.vision === "no"} onClick={() => choose("vision", "no")} disabled={saving}>
                    No change
                  </button>
                  <button type="button" className="choice" aria-pressed={answers.vision === "yes"} onClick={() => choose("vision", "yes")} disabled={saving}>
                    Yes, something changed
                  </button>
                </div>
              </>
            )}

            <div className="row row--between" style={{ marginTop: "auto" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <Icon name="chevron-left" size={16} /> Back
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => advance()} disabled={saving}>
                {step === STEPS.length - 1 ? "Skip and finish" : "Skip"} <Icon name="chevron-right" size={16} />
              </button>
            </div>
            <p className="small muted">{DISCLAIMER} Your answers go to your flight surgeon with the rest of your record at the next ground link.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Result({ result, headRef, onDone }: { result: CheckInResult; headRef: RefObject<HTMLHeadingElement>; onDone: () => void }) {
  const { readout, alert } = result;
  const mission = useApp().mission;
  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <div className="stack" style={{ ["--gap" as string]: "10px" }}>
        <div className="row">
          <span className="micro">Today's readout</span>
          <StatusPill status={readout.status} />
        </div>
        <h1 className="checkin__q" ref={headRef} tabIndex={-1} style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <StatusIcon status={readout.status} size={26} />
          {readout.headline}
        </h1>
        {readout.change && <p className="lead">{readout.change}</p>}
        {readout.tip && !alert && (
          <p className="readout__tip" style={{ marginTop: 0 }}>
            <Icon name="arrow-right" size={20} style={{ flex: "none", marginTop: 2, color: "var(--c-link)" }} />
            <span>
              <b>Try this: </b>
              {readout.tip}
            </span>
          </p>
        )}
      </div>
      {alert && alert.state !== "closed" && mission && (
        <AlertCard
          alert={alert}
          mission={mission}
          actions={
            <>
              <Link to={`/consult/new?alert=${alert.id}`} className="btn btn--primary btn--lg">
                <Icon name="consult" size={18} /> Ask the flight surgeon
              </Link>
              <Link to="/cabin" className="btn btn--secondary btn--lg">
                See cabin CO2
              </Link>
            </>
          }
        />
      )}
      <button type="button" className="btn btn--secondary btn--lg" onClick={onDone}>
        Done
      </button>
      <p className="small muted">{DISCLAIMER} Compared with your own baseline.</p>
    </div>
  );
}
