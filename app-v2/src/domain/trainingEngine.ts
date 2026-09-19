import type { Recommendation, TrainingSession } from "./types";

export function stepSize(seconds: number): number {
  if (seconds < 10) return 1;
  if (seconds < 30) return 2;
  if (seconds < 60) return 3;
  if (seconds < 120) return 5;
  if (seconds < 300) return 10;
  if (seconds < 600) return 15;
  if (seconds < 1800) return 30;
  return 60;
}

function comfortableDuration(session: TrainingSession): number {
  return Math.max(
    1,
    Math.min(
      session.targetSeconds,
      session.stoppedEarly ? session.actualSeconds : session.targetSeconds
    )
  );
}

function latestRelaxedBefore(
  sessions: TrainingSession[],
  endExclusive = sessions.length
): TrainingSession | undefined {
  for (let index = endExclusive - 1; index >= 0; index -= 1) {
    const session = sessions[index];
    if (session.outcome === "relaxed") return session;
  }
  return undefined;
}

function relaxedRun(sessions: TrainingSession[]): number {
  let count = 0;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index];
    if (session.outcome === "relaxed" && !session.stoppedEarly) count += 1;
    else break;
  }
  return count;
}

function needsSupport(sessions: TrainingSession[]): boolean {
  const recent = sessions.slice(-5);
  const difficult = recent.filter((session) => session.outcome !== "relaxed").length;
  const distressed = recent.filter((session) => session.outcome === "distressed").length;
  return distressed >= 2 || difficult >= 3;
}

/** Sessions examined for a persistent, non-progressing pattern. */
const REFERRAL_WINDOW = 10;

/**
 * A deliberately higher bar than {@link needsSupport}: a longer window, more
 * distress within it, and no net progress across it. A bad week should soften
 * the plan and suggest a specialist, which already happens; only a sustained
 * pattern that training alone is not shifting should raise a wider referral.
 *
 * The exact window and counts are a conservative SettledSolo product heuristic,
 * not a clinical threshold. Nothing here diagnoses, and the app never
 * recommends medication — it only suggests who is qualified to discuss it.
 */
function referralSuggested(sessions: TrainingSession[]): boolean {
  if (sessions.length < REFERRAL_WINDOW) return false;

  const window = sessions.slice(-REFERRAL_WINDOW);
  const difficult = window.filter((session) => session.outcome !== "relaxed").length;
  const distressed = window.filter((session) => session.outcome === "distressed").length;
  if (distressed < 3 || difficult < 6) return false;

  // Stalled: the plan is no further on than it was at the start of the window.
  return window[window.length - 1].targetSeconds <= window[0].targetSeconds;
}

export function recommendNext(
  sessions: TrainingSession[],
  configuredStartSeconds: number
): Recommendation {
  const start = Math.max(1, Math.round(configuredStartSeconds || 1));

  if (!sessions.length) {
    return {
      targetSeconds: start,
      direction: "start",
      reason:
        "Start with a duration you have already seen your dog manage comfortably. This is a starting point, not a test of their limit.",
      supportFlag: false,
      restDayRecommended: false,
      referralSuggested: false
    };
  }

  const last = sessions[sessions.length - 1];
  const supportFlag = needsSupport(sessions);
  const referral = referralSuggested(sessions);
  /**
   * A single distressed session already softens the next target. When that
   * distress lands on top of a broader recent pattern of difficulty, the
   * better call is to skip training entirely today rather than just make it
   * easier — the pattern most separation-anxiety protocols call a setback.
   */
  const restDayRecommended = supportFlag && last.outcome === "distressed";

  if (last.outcome === "distressed") {
    const previousRelaxed = latestRelaxedBefore(sessions, sessions.length - 1);
    const previousComfort = previousRelaxed
      ? comfortableDuration(previousRelaxed)
      : null;
    const observedUpperBound = last.stoppedEarly
      ? Math.max(
          start,
          last.actualSeconds - stepSize(Math.max(1, last.actualSeconds))
        )
      : start;
    const target = previousComfort === null
      ? observedUpperBound
      : Math.max(start, Math.min(previousComfort, observedUpperBound));

    return {
      targetSeconds: target,
      direction: "reduce",
      reason: last.stoppedEarly
        ? "Clear distress appeared before the target, so the next plan stays below the point where difficulty was observed."
        : "The last session showed clear distress, so the next plan returns to a known comfortable starting point.",
      supportFlag,
      restDayRecommended,
      referralSuggested: referral
    };
  }

  if (last.outcome === "concern") {
    const previousRelaxed = latestRelaxedBefore(sessions, sessions.length - 1);
    const previousComfort = previousRelaxed
      ? comfortableDuration(previousRelaxed)
      : null;
    const reference = last.stoppedEarly
      ? Math.max(1, last.actualSeconds)
      : last.targetSeconds;
    const steppedDown = Math.max(start, reference - stepSize(reference));
    const target = previousComfort === null
      ? steppedDown
      : Math.max(start, Math.min(previousComfort, steppedDown));

    return {
      targetSeconds: target,
      direction: "reduce",
      reason: last.stoppedEarly
        ? "Concern appeared before the target, so the next plan stays below the point where it was observed."
        : "There was some concern last time, so the next plan is easier rather than asking for another increase.",
      supportFlag,
      restDayRecommended,
      referralSuggested: referral
    };
  }

  if (last.stoppedEarly) {
    return {
      targetSeconds: Math.max(start, comfortableDuration(last)),
      direction: "repeat",
      reason:
        "You returned early while things were still relaxed. That actual comfortable duration becomes the next anchor instead of being treated as a failure.",
      supportFlag,
      restDayRecommended,
      referralSuggested: referral
    };
  }

  const run = relaxedRun(sessions);
  if (run < 2) {
    return {
      targetSeconds: last.targetSeconds,
      direction: "repeat",
      reason:
        "One relaxed session is useful evidence. Repeat this duration once before making it harder.",
      supportFlag,
      restDayRecommended,
      referralSuggested: referral
    };
  }

  const increment = stepSize(last.targetSeconds);
  return {
    targetSeconds: last.targetSeconds + increment,
    direction: "increase",
    reason: `Recent sessions were relaxed, so the next plan adds a small ${increment}-second step.`,
    supportFlag,
    restDayRecommended,
    referralSuggested: referral
  };
}

export const DEFAULT_WARMUP_COUNT = 4;
const LONG_SESSION_WARMUP_COUNT = 2;

export function defaultWarmupCount(targetSeconds: number): number {
  return Math.round(targetSeconds) < 10 * 60
    ? DEFAULT_WARMUP_COUNT
    : LONG_SESSION_WARMUP_COUNT;
}

/**
 * `variabilitySeed` (typically how many main departures have already been
 * logged) varies the practice order so a dog can't learn the shape of the
 * warm-up and anticipate what's coming next. Short targets default to four
 * warm-ups; longer targets keep two. Every warm-up is capped at one minute,
 * and targets below two minutes also cap warm-ups at half the main target.
 */
export function buildPracticeDepartures(
  targetSeconds: number,
  variabilitySeed = 0,
  warmupCount?: number,
  shuffleWarmups = true
): number[] {
  const target = Math.max(1, Math.round(targetSeconds));
  const configuredCount = warmupCount ?? defaultWarmupCount(target);
  const count = Math.max(0, Math.min(4, Math.round(configuredCount)));
  if (target < 8 || count === 0) return [];

  const maximum = Math.min(
    60,
    target < 2 * 60 ? Math.floor(target / 2) : target - 1
  );
  const minimum = Math.min(
    maximum,
    Math.max(2, Math.min(30, Math.round(target * 0.15)))
  );
  const available = Math.max(0, maximum - minimum + 1);
  const actualCount = Math.min(count, available);
  if (actualCount === 0) return [];

  const values: number[] = [];
  for (let index = 0; index < actualCount; index += 1) {
    const fraction = actualCount === 1 ? 0.5 : index / (actualCount - 1);
    let seconds = Math.round(
      minimum + (maximum - minimum) * fraction
    );
    if (index > 0 && seconds <= values[index - 1]) {
      seconds = values[index - 1] + 1;
    }
    values.push(Math.min(maximum, seconds));
  }

  if (!shuffleWarmups || values.length <= 1) return values;

  const rotation = Math.abs(Math.round(variabilitySeed)) % values.length;
  return [...values.slice(rotation), ...values.slice(0, rotation)];
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, "0")}`
    : `${remainder}s`;
}
