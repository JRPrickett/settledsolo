import type { AppData, Scenario } from "./types";

export const PRE_PROTOCOL_OBSERVATION_VERSION = 1 as const;

/**
 * What the owner noticed during a single observation of the dog alone, before
 * any structured duration training begins.
 *
 * These are rule-outs, not diagnoses. Confinement anxiety, noise sensitivity and
 * incomplete housetraining can all look like separation-related distress, and a
 * single observation is what distinguishes them cheaply.
 */
export type PreProtocolFinding =
  | "settled-when-not-confined"
  | "reacted-to-noises"
  | "toileted-while-alone"
  | "signs-began-after-leaving"
  | "nothing-notable";

export const PRE_PROTOCOL_FINDINGS: PreProtocolFinding[] = [
  "signs-began-after-leaving",
  "settled-when-not-confined",
  "reacted-to-noises",
  "toileted-while-alone",
  "nothing-notable"
];

export type PreProtocolOutcome = "observed" | "skipped";

export interface PreProtocolObservation {
  version: typeof PRE_PROTOCOL_OBSERVATION_VERSION;
  outcome: PreProtocolOutcome;
  findings: PreProtocolFinding[];
  completedAt: number;
}

/**
 * The step belongs before duration training starts, so it is offered only while
 * the active track has no recorded sessions. An established user is never
 * interrupted by it, and it is never shown twice.
 *
 * A cue-first plan deliberately has no departures yet, so asking the owner to
 * leave and watch would contradict the plan they were just given. Those users
 * see it once their plan includes a real departure.
 */
export function shouldOfferPreProtocolObservation(
  data: AppData,
  scenario: Scenario,
  departurePlanned: boolean
): boolean {
  if (data.preProtocolObservation) return false;
  if (!departurePlanned) return false;
  return scenario.sessions.length === 0;
}

const LABELS: Record<PreProtocolFinding, string> = {
  "signs-began-after-leaving":
    "Signs started after I left, with nothing else to explain them",
  "settled-when-not-confined":
    "They were calmer when not shut in a crate, pen or single room",
  "reacted-to-noises": "They reacted to noises outside rather than to my absence",
  "toileted-while-alone": "They toileted indoors while alone",
  "nothing-notable": "Nothing notable — they were settled"
};

/**
 * Guidance is deliberately non-diagnostic and never prescribes treatment. Each
 * note names an alternative explanation worth separating out, or a next step the
 * app already supports.
 */
const NOTES: Record<PreProtocolFinding, string> = {
  "signs-began-after-leaving":
    "That is consistent with separation-related distress, though only an appropriately qualified professional can assess it. Starting gently and observing is the right next step either way.",
  "settled-when-not-confined":
    "Being shut in can contribute to distress on its own. Try some sessions free-roam and compare — SettledSolo has confinement and free-roam session tags for exactly this.",
  "reacted-to-noises":
    "Noise sensitivity can look much like separation distress. Worth mentioning to your vet or an appropriately qualified behaviour professional so it is not missed.",
  "toileted-while-alone":
    "Toileting indoors does not always mean distress — incomplete housetraining can look the same. Worth ruling out separately.",
  "nothing-notable":
    "Useful to know. Begin gently and keep observing rather than assuming the first session will look the same."
};

export function findingLabel(finding: PreProtocolFinding): string {
  return LABELS[finding];
}

export interface ObservationNote {
  finding: PreProtocolFinding;
  note: string;
}

/**
 * "Nothing notable" only stands on its own: when the owner also noticed
 * something, the specific observations are what matter.
 */
export function observationNotes(
  findings: PreProtocolFinding[]
): ObservationNote[] {
  const unique = PRE_PROTOCOL_FINDINGS.filter((finding) =>
    findings.includes(finding)
  );
  const specific = unique.filter((finding) => finding !== "nothing-notable");
  const chosen = specific.length ? specific : unique;
  return chosen.map((finding) => ({ finding, note: NOTES[finding] }));
}

export function recordObservation(
  outcome: PreProtocolOutcome,
  findings: PreProtocolFinding[] = [],
  now = Date.now()
): PreProtocolObservation {
  return {
    version: PRE_PROTOCOL_OBSERVATION_VERSION,
    outcome,
    findings:
      outcome === "observed"
        ? PRE_PROTOCOL_FINDINGS.filter((finding) => findings.includes(finding))
        : [],
    completedAt: now
  };
}
