import type { SessionTag } from "./types";

/**
 * Typed as a complete record, so adding a tag to the union without giving it a
 * label is a compile error. Entries are in display order.
 */
const SESSION_TAG_LABELS: Record<SessionTag, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  "not-walked-yet": "Not walked yet",
  "after-a-walk": "After a walk",
  "before-food": "Before food",
  "after-food": "After food",
  // Makes "Refused food or treats" interpretable: refusal only means something
  // when food was actually offered.
  "food-left": "Food or chew left",
  // Some owners use a remote treat feeder during absences; logging it lets them
  // compare sessions with and without it. SettledSolo does not prescribe it.
  "remote-feeder": "Remote treat feeder used",
  "radio-or-tv-on": "Radio or TV on",
  "noise-disturbance": "Noise or disturbance",
  "crated-confined": "Crated / confined",
  "free-roam": "Free-roam",
  // Separation from one person can differ from being left completely alone.
  "someone-home": "Someone else was home"
};

export const SESSION_TAG_VALUES = Object.keys(SESSION_TAG_LABELS) as SessionTag[];

export const SESSION_TAG_OPTIONS: Array<{ value: SessionTag; label: string }> =
  SESSION_TAG_VALUES.map((value) => ({ value, label: SESSION_TAG_LABELS[value] }));
