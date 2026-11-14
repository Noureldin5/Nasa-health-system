import type { MetricKey, RegionKey } from "../api/types";
import type { HazardKey } from "./hazards";

/**
 * Body map explainers (docs/REQUIREMENTS.md M1): what each region does, which
 * measurement covers it, how the five HRP hazards affect it, when to contact
 * the flight surgeon. Plain language, decision support only.
 *
 * Sources: SANS and headaches from docs/research/astronaut-health-problems.md
 * (NASA OCHMO); CO2 from the same file (NTRS 20150021777, OCHMO CO2 brief);
 * the list of health problems (immune changes, bone density loss, inadequate
 * nutrition) from the official challenge text in docs/CHALLENGE.md. Other lines
 * are general explanations, worded as "studied" or "linked", never as a diagnosis.
 */
export interface RegionContent {
  key: RegionKey;
  label: string;
  does: string;
  metrics: MetricKey[];
  /** Shown when the region has no indicator in this prototype. */
  notTracked?: string;
  showsBloodReference?: boolean;
  hazards: { hazard: HazardKey; text: string }[];
  contactIf: string;
  symptoms: string[];
}

export const REGION_ORDER: RegionKey[] = ["brain", "heart", "blood", "metabolism", "bones", "muscles"];

export const REGIONS: Record<RegionKey, RegionContent> = {
  brain: {
    key: "brain",
    label: "Brain and eyes",
    does: "Thinking, mood, the sleep cycle and vision.",
    metrics: ["sleep", "mood"],
    hazards: [
      {
        hazard: "gravity",
        text: "Headaches and vision changes (SANS, spaceflight-associated neuro-ocular syndrome) are the most common spaceflight symptoms, per NASA OCHMO.",
      },
      {
        hazard: "environment",
        text: "Higher cabin CO2 is studied for its effects on how crew feel and think (NASA NTRS 20150021777, OCHMO CO2 brief). Cabin Link watches for a pattern with your headaches.",
      },
      { hazard: "isolation", text: "Isolation, a fixed schedule and little privacy can lower mood and disturb sleep." },
      { hazard: "radiation", text: "Long-term radiation exposure is studied as a risk to the central nervous system." },
    ],
    contactIf: "a headache is strong, or comes with vision changes.",
    symptoms: ["Headache", "Blurred vision", "Poor focus"],
  },
  heart: {
    key: "heart",
    label: "Heart and vessels",
    does: "Pumps blood and keeps blood pressure steady when you move.",
    metrics: ["hr", "bp"],
    hazards: [
      { hazard: "gravity", text: "The heart works less against gravity. Some crew feel lightheaded when they return to gravity." },
      { hazard: "isolation", text: "Stress and short sleep can raise resting heart rate and blood pressure." },
      { hazard: "radiation", text: "Radiation is studied as a long-term risk to the heart and vessels." },
    ],
    contactIf: "you have chest pain, faint, or feel a racing heart at rest.",
    symptoms: ["Racing heart", "Lightheaded", "Chest discomfort"],
  },
  blood: {
    key: "blood",
    label: "Blood and immune system",
    does: "Carries oxygen and fights infection. White blood cells and lymphocytes are part of the immune system.",
    metrics: ["temp"],
    showsBloodReference: true,
    hazards: [
      { hazard: "radiation", text: "Radiation is studied for its effect on the cells that make blood." },
      { hazard: "environment", text: "Immune system changes are on HRP's list of spaceflight health problems." },
      { hazard: "distance", text: "Most blood tests cannot run on board. Samples are often analyzed after return." },
    ],
    contactIf: "you have a fever, chills, or an infection that is not getting better.",
    symptoms: ["Fever or chills", "Sore throat", "Slow-healing cut"],
  },
  metabolism: {
    key: "metabolism",
    label: "Metabolism and nutrition",
    does: "Turns food into energy and keeps blood sugar steady.",
    metrics: ["glucose"],
    hazards: [
      { hazard: "gravity", text: "Less physical load is linked to changes in how the body handles sugar (studied in bed-rest analogs)." },
      { hazard: "distance", text: "The food supply is fixed. Inadequate nutrition is on HRP's list of health problems." },
    ],
    contactIf: "you feel shaky, confused or very thirsty, or lose appetite for several days.",
    symptoms: ["Nausea", "Low appetite", "Stomach pain"],
  },
  bones: {
    key: "bones",
    label: "Bones",
    does: "Carry load and protect organs. Bone keeps rebuilding itself under load.",
    metrics: [],
    notTracked: "Not tracked in this prototype. Bone density is measured before and after flight. Daily resistance exercise is the main countermeasure.",
    hazards: [{ hazard: "gravity", text: "Without load, bones lose density. Bone density loss is on HRP's list of spaceflight health problems." }],
    contactIf: "you have new bone pain after exercise or after hitting something.",
    symptoms: ["Bone pain", "Back pain"],
  },
  muscles: {
    key: "muscles",
    label: "Muscles",
    does: "Move and hold the body. Calf and back muscles normally work against gravity all day.",
    metrics: [],
    notTracked: "Not tracked in this prototype. Exercise sessions would show here.",
    hazards: [
      { hazard: "gravity", text: "Muscles that hold you up against gravity weaken without load." },
      { hazard: "isolation", text: "A long day leaves less time for exercise, so it is easy to skip." },
    ],
    contactIf: "you have new pain or weakness that limits a task.",
    symptoms: ["Muscle pain", "Cramp", "Weakness"],
  },
};
