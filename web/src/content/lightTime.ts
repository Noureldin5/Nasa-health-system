/**
 * One-way signal (light) time between the crew and ground, per mission distance.
 *
 * Only the Mars figure is a NASA statement. NASA publishes distances, not delays, for the Moon and
 * the station, so those two are DERIVED here as distance divided by the speed of light and labeled
 * so in the UI. The demo animation is not to scale: the real figure is always the one shown.
 */
export type LinkProfileKey = "station" | "moon" | "mars";

export interface LinkProfile {
  key: LinkProfileKey;
  name: string;
  short: string;
  /** One-way light time in seconds (for Mars: NASA's upper figure). */
  oneWaySec: number;
  /** How the figure reads in the UI. */
  delayText: string;
  basis: "nasa" | "derived";
  source: string;
  url: string;
  /** How long the whole sync animation runs in the demo, in ms. Demo parameter. */
  demoMs: number;
  /** What the distance means for a consult. Our wording. */
  note: string;
}

const C_KM_S = 299_792.458; // speed of light, exact by definition (SI)

export const LINK_PROFILES: Record<LinkProfileKey, LinkProfile> = {
  station: {
    key: "station",
    name: "Station, low Earth orbit",
    short: "LEO",
    oneWaySec: 386 / C_KM_S,
    delayText: "at least 1 ms",
    basis: "derived",
    source: "Derived lower bound for a direct line: NASA gives the station's altitude as 240 miles (386 km); divided by the speed of light. Real links go through relay satellites and take longer.",
    url: "https://www.nasa.gov/humans-in-space/the-human-body-in-space/",
    demoMs: 1300,
    note: "A reply can come back within one link window. Talking to ground still waits for the window.",
  },
  moon: {
    key: "moon",
    name: "Moon",
    short: "Moon",
    oneWaySec: 384_400 / C_KM_S,
    delayText: "1.28 s",
    basis: "derived",
    source: "Derived: NASA gives the Moon's average distance as 384,400 km; divided by the speed of light.",
    url: "https://science.nasa.gov/moon/facts/",
    demoMs: 2100,
    note: "A conversation is still possible, with a pause of more than two and a half seconds on every exchange.",
  },
  mars: {
    key: "mars",
    name: "Mars",
    short: "Mars",
    oneWaySec: 20 * 60,
    delayText: "up to 20 min",
    basis: "nasa",
    source: "NASA Human Research Program, Hazard: Distance From Earth: “a communication delay of up to 20 minutes one way”.",
    url: "https://www.nasa.gov/hrp/hazard-distance-from-earth/",
    demoMs: 3000,
    note: "A question and its answer take up to 40 minutes of signal time, plus the wait for a link window. No live call: the record, the baseline and the first answer have to be on board.",
  },
};

export const LINK_PROFILE_ORDER: LinkProfileKey[] = ["station", "moon", "mars"];

/** "T+ 12:30" for minutes, "0.64 s" for seconds, "1 ms" below that. */
export function fmtLightTime(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} min`;
  }
  if (sec >= 0.1) return `${sec.toFixed(2)} s`;
  return `${Math.max(0, sec * 1000).toFixed(1)} ms`;
}
