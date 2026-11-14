import { useState } from "react";
import { DemoTag, PageHead } from "../components/ui";
import { HAZARDS, HAZARD_ORDER, type HazardKey } from "../content/hazards";
import { HAZARD_PAGES, PARTNER_RESOURCES, RISKS_HUB, RISK_PAGES } from "../content/risks";
import { DISCLAIMER } from "../content/sources";

/**
 * Environment Switcher (S2): the challenge asks for insights in "a spacecraft, a space station, a rover,
 * or a base on another planet or moon". Picking a place re-orders the five NASA HRP hazards and shows
 * which of our checks matter most there. The wording is OUR summary for the demo, not NASA text, and it
 * contains no health thresholds. Nothing here changes an alert: alerts follow the personal baseline.
 */
type EnvKey = "station" | "spacecraft" | "rover" | "surface";

interface Env {
  key: EnvKey;
  name: string;
  blurb: string;
  /** Hazards in the order they matter most here (our judgement, a Demo parameter). */
  emphasis: HazardKey[];
  focus: string[];
  ground: string;
}

const ENVS: Env[] = [
  {
    key: "station",
    name: "Space station",
    blurb: "Low Earth orbit. Weightless, a closed cabin, regular contact with ground.",
    emphasis: ["gravity", "environment", "isolation", "radiation", "distance"],
    focus: ["Cabin Link: watch cabin CO2 against headaches.", "Keep the weekly blood pressure, glucose and temperature slot.", "Sleep hours: schedules shift around the day-night cycle."],
    ground: "Ground link is frequent, so a consult brief usually gets a reply within a link window.",
  },
  {
    key: "spacecraft",
    name: "Spacecraft in transit",
    blurb: "Between worlds. A small shared cabin and a growing distance from Earth.",
    emphasis: ["distance", "isolation", "radiation", "environment", "gravity"],
    focus: ["Mood and sleep matter more: small crew, long weeks.", "Write the consult brief early, because replies take longer.", "Cabin Link still applies in a small closed cabin."],
    ground: "Messages take longer each way as the distance grows. Plan questions so one brief carries everything.",
  },
  {
    key: "rover",
    name: "Pressurized rover",
    blurb: "A short trip away from base, in a small vehicle.",
    emphasis: ["environment", "isolation", "gravity", "distance", "radiation"],
    focus: ["Cabin air matters in a very small cabin: use Cabin Link.", "Skip nothing in the 30-second check-in on trip days.", "Note any dizziness or balance change after standing on a new surface."],
    ground: "The link may drop out on a trip. Briefs and notes wait in the sync log and go at the next window.",
  },
  {
    key: "surface",
    name: "Surface base",
    blurb: "A base on the Moon or Mars. A new level of gravity, a longer stay.",
    emphasis: ["gravity", "distance", "radiation", "isolation", "environment"],
    focus: ["Heart rate and blood pressure: the body adjusts to a new gravity level.", "Keep exercise and the weekly slot as routine.", "Report new aches or balance changes in the check-in."],
    ground: "Contact is slower and less often, so the app keeps the full record on board and shows what ground sees.",
  },
];

const STORE = "oyb-environment";

function initial(): EnvKey {
  try {
    const v = window.localStorage.getItem(STORE);
    if (v && ENVS.some((e) => e.key === v)) return v as EnvKey;
  } catch {
    /* storage can be blocked: use the default */
  }
  return "station";
}

export function Environment() {
  const [key, setKey] = useState<EnvKey>(initial);
  const env = ENVS.find((e) => e.key === key)!;
  const order = [...HAZARD_ORDER].sort((a, b) => env.emphasis.indexOf(a) - env.emphasis.indexOf(b));

  function pick(k: EnvKey) {
    setKey(k);
    try {
      window.localStorage.setItem(STORE, k);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <PageHead
        title="Where you are"
        sub="Pick your environment. The five NASA hazards re-order and the checks that matter most change."
        actions={<DemoTag title="Our summary for the demo, not NASA text. It never changes an alert." />}
      />

      <div role="radiogroup" aria-label="Environment" className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        {ENVS.map((e) => (
          <button
            key={e.key}
            type="button"
            role="radio"
            aria-checked={e.key === key}
            className={`btn ${e.key === key ? "btn--primary" : "btn--secondary"}`}
            style={{ minHeight: 56 }}
            onClick={() => pick(e.key)}
          >
            {e.name}
          </button>
        ))}
      </div>

      <section className="card card--pad stack" aria-live="polite">
        <span className="micro">{env.name}</span>
        <p>{env.blurb}</p>
        <span className="micro">Checks that matter most here</span>
        <ul className="stack" style={{ ["--gap" as string]: "6px", paddingLeft: 18 }}>
          {env.focus.map((f) => (
            <li key={f} className="small">
              {f}
            </li>
          ))}
        </ul>
        <span className="micro">Talking to ground</span>
        <p className="small text-2">{env.ground}</p>
      </section>

      <section className="card card--pad stack">
        <span className="micro">The five NASA hazards, most relevant first</span>
        <ol className="hazard-list" style={{ paddingLeft: 0 }}>
          {order.map((h, i) => (
            <li key={h}>
              <span>
                {i + 1}. {HAZARDS[h].short}
              </span>
              <span>
                <a href={HAZARD_PAGES[h].url} target="_blank" rel="noreferrer">
                  NASA: {HAZARDS[h].name}
                </a>
                {" · Risks: "}
                {HAZARD_PAGES[h].risks.map((r, j) => (
                  <span key={r}>
                    {j ? ", " : ""}
                    <a href={RISK_PAGES[r].url} target="_blank" rel="noreferrer">
                      {RISK_PAGES[r].title.replace(/^Risk (of|from) /, "")}
                    </a>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
        <p className="small muted">
          The order is our judgement for this demo. All links open NASA pages and need a network; the app itself works offline.{" "}
          <a href={RISKS_HUB} target="_blank" rel="noreferrer">
            All HRP risks
          </a>
          .
        </p>
      </section>

      <section className="card card--pad stack">
        <span className="micro">Other space agency resources</span>
        <ul className="stack" style={{ ["--gap" as string]: "6px", listStyle: "none" }}>
          {PARTNER_RESOURCES.map((r) => (
            <li key={r.url} className="small">
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.by}: {r.title}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="small muted">{DISCLAIMER}</p>
    </div>
  );
}
