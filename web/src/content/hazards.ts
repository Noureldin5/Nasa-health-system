/**
 * The five hazards of human spaceflight as named by NASA's Human Research
 * Program. Names copied from the official challenge text in docs/CHALLENGE.md.
 */
export type HazardKey = "radiation" | "isolation" | "distance" | "gravity" | "environment";

export const HAZARDS: Record<HazardKey, { name: string; short: string }> = {
  radiation: { name: "Space radiation", short: "Radiation" },
  isolation: { name: "Isolation and confinement", short: "Isolation" },
  distance: { name: "Distance from Earth", short: "Distance" },
  gravity: { name: "Gravity fields", short: "Gravity" },
  environment: { name: "Hostile closed environments", short: "Closed environment" },
};

export const HAZARD_ORDER: HazardKey[] = ["radiation", "isolation", "distance", "gravity", "environment"];
