import type { MetricKey } from "../api/types";
import type { HazardKey } from "./hazards";

/**
 * NASA Human Research Program risk pages, so every explainer can name its source.
 * Page titles and URLs come from https://www.nasa.gov/hrp/risks/ (read 2026-11-14).
 * Which risk goes with which indicator is OUR mapping, not NASA's: it is labeled as such in the UI.
 * No numbers here. Bundled in the app so it works with no network.
 */
export interface RiskPage {
  title: string;
  url: string;
}

export const RISK_PAGES = {
  cardiovascular: { title: "Risk of Cardiovascular Adaptations", url: "https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/" },
  sleep: { title: "Risk from Inadequate Sleep and Irregular Schedules", url: "https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/" },
  behavioral: { title: "Risk of Behavioral Conditions and Psychiatric Disorders", url: "https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/" },
  immune: { title: "Risk of Altered Immune System Responses", url: "https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/" },
  nutrition: { title: "Risk of Inadequate Food and Nutrition", url: "https://www.nasa.gov/reference/risk-of-inadequate-food-and-nutrition/" },
  fitness: { title: "Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness", url: "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/" },
  bone: { title: "Risk of Spaceflight-Induced Bone Changes", url: "https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/" },
  sans: { title: "Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)", url: "https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/" },
  sensorimotor: { title: "Risk of Altered Sensorimotor and Vestibular Function", url: "https://www.nasa.gov/reference/risk-of-altered-sensorimotor-and-vestibular-function/" },
  microbes: { title: "Risk of Host-Microorganism Interactions", url: "https://www.nasa.gov/reference/risk-of-host-microorganism-interactions/" },
  cancer: { title: "Risk of Radiation-Induced Cancers", url: "https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/" },
  teamwork: { title: "Risk of Inadequate Teamwork", url: "https://www.nasa.gov/reference/risk-of-inadequate-teamwork/" },
} as const satisfies Record<string, RiskPage>;

export type RiskKey = keyof typeof RISK_PAGES;

/** Our mapping from the six indicators to the NASA risk pages that discuss them. */
export const RISKS_FOR_METRIC: Record<MetricKey, RiskKey[]> = {
  bp: ["cardiovascular"],
  hr: ["cardiovascular", "fitness"],
  glucose: ["nutrition"],
  temp: ["immune"],
  sleep: ["sleep"],
  mood: ["behavioral", "teamwork"],
};

/** Our mapping from the five hazards to the risk pages and the NASA hazard page. */
export const HAZARD_PAGES: Record<HazardKey, { url: string; risks: RiskKey[] }> = {
  radiation: { url: "https://www.nasa.gov/hrp/hazard-space-radiation/", risks: ["cancer"] },
  isolation: { url: "https://www.nasa.gov/hrp/hazard-isolation-and-confinement/", risks: ["behavioral", "teamwork", "sleep"] },
  distance: { url: "https://www.nasa.gov/hrp/hazard-distance-from-earth/", risks: ["nutrition"] },
  gravity: { url: "https://www.nasa.gov/hrp/hazard-gravity-fields/", risks: ["cardiovascular", "bone", "sans", "sensorimotor", "fitness"] },
  environment: { url: "https://www.nasa.gov/hrp/hazard-hostile-closed-environments/", risks: ["immune", "microbes"] },
};

/** Other agency resources named on the challenge's Resources tab. Opened from a link, never bundled. */
export const PARTNER_RESOURCES = [
  {
    title: "Monitoring Radiation for Astronaut Health",
    by: "Canadian Space Agency",
    url: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
    hazard: "radiation" as HazardKey,
  },
  {
    title: "Why Do We Conduct Science Experiments in Space?",
    by: "Canadian Space Agency",
    url: "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
    hazard: "gravity" as HazardKey,
  },
];

export const RISKS_HUB = "https://www.nasa.gov/hrp/risks/";
