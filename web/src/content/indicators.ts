import type { MetricKey } from "../api/types";
import type { HazardKey } from "./hazards";

/**
 * Copy for the six indicators: how to measure, why it matters, how spaceflight
 * affects it. Plain language for non-experts (docs/REQUIREMENTS.md M6).
 * No numeric thresholds here: those live in sources.ts with a citation or the
 * "Demo parameter" label. Health problems named here (immune changes,
 * inadequate nutrition, behavioral health) come from docs/CHALLENGE.md.
 * How-to steps are generic and defer to the device's own guide.
 */
export interface IndicatorContent {
  key: MetricKey;
  label: string;
  short: string;
  unit: string;
  decimals: number;
  cadence: "passive" | "checkin" | "weekly";
  cadenceText: string;
  what: string;
  why: string;
  howTo: string[];
  minutes: number | null;
  hazards: { hazard: HazardKey; text: string }[];
  contactIf: string;
  tip: string;
}

export const METRIC_ORDER: MetricKey[] = ["bp", "hr", "glucose", "temp", "sleep", "mood"];

export const INDICATORS: Record<MetricKey, IndicatorContent> = {
  bp: {
    key: "bp",
    label: "Blood pressure",
    short: "BP",
    unit: "mmHg",
    decimals: 0,
    cadence: "weekly",
    cadenceText: "Weekly slot, or when the app asks",
    what: "The pressure in your arteries when the heart beats (top number) and between beats (bottom number).",
    why: "Weightlessness changes how the heart and vessels work. Your own trend tells more than one reading.",
    howTo: [
      "Rest quietly for a few minutes, feet in the restraint, arm at heart level.",
      "Wrap the cuff on the upper arm, just above the elbow crease, as shown on the cuff.",
      "Press start and stay quiet until the cuff releases.",
      "Enter both numbers. If they look odd, rest a moment and measure again.",
    ],
    minutes: 7,
    hazards: [
      { hazard: "gravity", text: "The heart works less against gravity, so your usual range in flight can differ from Earth." },
      { hazard: "isolation", text: "Stress and short sleep can push readings up for a while." },
    ],
    contactIf: "you feel chest pain, a severe headache, or faint, or a reading is far from your usual.",
    tip: "Measure at the same time of day each week so readings compare well.",
  },
  hr: {
    key: "hr",
    label: "Heart rate",
    short: "HR",
    unit: "bpm",
    decimals: 0,
    cadence: "passive",
    cadenceText: "Resting rate, read by your wearable",
    what: "Beats per minute while you rest, measured by the wrist wearable after waking.",
    why: "A resting rate above your usual for a few days can follow short sleep, stress or an illness starting.",
    howTo: [
      "Nothing to do. The wearable reads it each morning.",
      "To check by hand: rest a moment, count your pulse at the wrist for 30 seconds and double it.",
    ],
    minutes: 0,
    hazards: [
      { hazard: "gravity", text: "The heart adapts to weightlessness. Your usual range in flight can differ from your usual on Earth." },
      { hazard: "isolation", text: "Workload and short sleep can raise resting heart rate." },
    ],
    contactIf: "you have a racing heart at rest with dizziness, chest pain or shortness of breath.",
    tip: "Short sleep can raise resting heart rate. Recheck after a full sleep period.",
  },
  glucose: {
    key: "glucose",
    label: "Blood sugar",
    short: "Glucose",
    unit: "mg/dL",
    decimals: 0,
    cadence: "weekly",
    cadenceText: "Weekly slot, fasting, before breakfast",
    what: "The amount of sugar in your blood, measured from a fingertip drop before breakfast.",
    why: "Less physical load and a fixed food supply can change how the body handles sugar over a long mission.",
    howTo: [
      "Measure before breakfast. Wash and dry your hands.",
      "Insert a test strip and prick the side of a fingertip with the lancet, as the meter's guide shows.",
      "Touch the drop to the strip, wait for the reading.",
      "Bag the lancet and strip in the sharps pouch.",
    ],
    minutes: 3,
    hazards: [
      { hazard: "gravity", text: "Less load on the muscles is linked to changes in how the body uses sugar (studied in bed-rest analogs)." },
      { hazard: "distance", text: "The food supply is fixed for the whole mission. Inadequate nutrition is on HRP's list of health problems." },
    ],
    contactIf: "you feel shaky, confused or very thirsty, or a reading is far from your usual.",
    tip: "Keep the measurement before breakfast so it compares with your usual.",
  },
  temp: {
    key: "temp",
    label: "Body temperature",
    short: "Temp",
    unit: "°C",
    decimals: 1,
    cadence: "weekly",
    cadenceText: "Weekly slot, or when the app asks",
    what: "Core body temperature from the forehead or ear thermometer.",
    why: "It helps tell a fever from other causes of a headache or tiredness. Your own trend matters more than one reading.",
    howTo: [
      "Wait a while after exercise or a hot drink.",
      "Hold the thermometer on the forehead or in the ear as shown on its label.",
      "Read and enter the number.",
    ],
    minutes: 1,
    hazards: [
      { hazard: "environment", text: "Immune system changes are on HRP's list of spaceflight health problems. A fever is the signal to watch." },
    ],
    contactIf: "you have a fever with chills or a stiff neck, or a fever that does not settle.",
    tip: "Measure at rest, not right after exercise.",
  },
  sleep: {
    key: "sleep",
    label: "Sleep",
    short: "Sleep",
    unit: "h",
    decimals: 1,
    cadence: "passive",
    cadenceText: "Read by your wearable each night",
    what: "Hours of sleep in your last sleep period, from the wrist wearable.",
    why: "Short sleep for several nights affects mood, focus and resting heart rate. Light cycles and noise on board make it common.",
    howTo: ["Nothing to do. Wear the wearable to sleep.", "Tell the check-in how rested you feel. That adds what the sensor cannot measure."],
    minutes: 0,
    hazards: [
      { hazard: "isolation", text: "Fixed schedules, shift changes and noise in a small space make sleep harder." },
      { hazard: "environment", text: "Artificial light and no natural day and night make the body clock harder to keep." },
    ],
    contactIf: "you sleep under 4 hours for two nights (demo parameter), or feel unsafe doing a task because of tiredness.",
    tip: "Try moving screen time out of the hour before sleep and dim the lights 60 minutes before your sleep slot.",
  },
  mood: {
    key: "mood",
    label: "Mood",
    short: "Mood",
    unit: "of 5",
    decimals: 0,
    cadence: "checkin",
    cadenceText: "From your morning check-in",
    what: "How you feel today, from 1 (low) to 5 (great), as you tell the check-in.",
    why: "Mood changes are common on long missions. Your trend helps you and the flight surgeon notice early.",
    howTo: ["Answer the mood question in the morning check-in. It takes 2 seconds and can be skipped."],
    minutes: 0,
    hazards: [
      { hazard: "isolation", text: "Isolation and confinement are a known strain on mood and team life." },
      { hazard: "distance", text: "Delayed contact with family and ground adds to the strain." },
    ],
    contactIf: "low mood lasts several days or you have thoughts of harming yourself.",
    tip: "A short call home or a break with the crew can help. Say so in the next check-in if it stays low.",
  },
};

export const MOOD_WORDS = ["Low", "Down", "Okay", "Good", "Great"] as const;
export const RESTED_WORDS = ["Exhausted", "Tired", "Okay", "Rested", "Fully rested"] as const;
