/**
 * Every threshold or parameter shown in the UI, with its source or the label
 * "Demo parameter" (docs/REQUIREMENTS.md, data requirements). Keep numbers here, not inside components.
 */

export interface SourcedValue {
  value: number;
  unit: string;
  label: string;
  /** Citation, or "Demo parameter" with what still needs a source. */
  source: string;
  demoParameter: boolean;
}

export const CO2_LIMIT: SourcedValue = {
  value: 3500,
  unit: "ppm",
  label: "Cabin CO2 limit",
  source:
    "Demo parameter. Placeholder until cited: NASA NTRS 20150021777 and the OCHMO CO2 brief are listed in docs/research.",
  demoParameter: true,
};

export const CALIBRATION_DAYS: SourcedValue = {
  value: 7,
  unit: "days",
  label: "Calibration period before drift alerts",
  source: "Demo parameter (docs/USER-FLOW.md, First week).",
  demoParameter: true,
};

export const BASELINE_METHOD =
  "Your usual range is the average of your first 7 days, plus or minus two standard deviations, with a minimum width. Demo parameter, the real method is in the API (role B).";

export const LINK_WINDOW_HOURS: SourcedValue = {
  value: 5,
  unit: "h",
  label: "Time between ground link windows",
  source: "Demo parameter. Real windows depend on the mission (station, Moon, Mars).",
  demoParameter: true,
};

export const OSD569_LABEL = "Inspiration4 crew sample, not your labs";

export const DISCLAIMER = "Decision support, not a diagnosis.";
