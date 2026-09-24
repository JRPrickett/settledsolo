import type { Recommendation, TrainingSession } from "./types";
import { hasHighRiskSignals, observedSignalLabel } from "./observedSignals";

/** Each step is this fraction of the current duration. */
export const STEP_FRACTION = 0.1;
/** Never change a target by more than this in one step. */
export const MAX_STEP_SECONDS = 120;

/**
 * The size of one easier or harder step, proportional to the current duration.
 *
 * Dogs judge durations by ratio (they bisect intervals at the geometric mean)
 * and needed roughly a 44-94% difference to tell two durations apart (Cliff &
 * Jackson 2019). A 10% step is well under that threshold, so each change should
 * be barely perceptible, which is what systematic desensitisation asks for.
 * That study covered durations up to 16 seconds and perception rather than
 * anxiety, so the 10% fraction, the 1-second floor and the 2-minute cap are
 * SettledSolo product heuristics, not clinically validated values.
 */
export function stepSize(seconds: number, fraction = STEP_FRACTION): number {
  const proportional = Math.round(Math.max(0, seconds) * fraction);
  return Math.min(MAX_STEP_SECONDS, Math.max(1, proportional));
}

/** Sessions examined when deciding how big the next increase should be. */
export const PACE_WINDOW = 10;
/** Consecutive clean relaxed sessions needed before a larger step. */
export const CONFIDENT_RUN = 5;

export type ProgressionPace = "cautious" | "standard" | "confident";

export const PACE_FRACTION: Record<ProgressionPace, number> = {
  cautious: 0.05,
  standard: STEP_FRACTION,
  confident: 0.15
};

/**
 * How big the next *increase* should be, from how recent sessions went. This
 * mirrors percentile schedules in shaping (Galbicka 1994), where each next
 * criterion is set from a window of recent performance: any recent struggle
 * slows the pace, and a sustained clean run allows a slightly larger step. Even
 * the confident 15% step stays about a third of dogs' measured
 * duration-discrimination threshold, and the 2-minute cap still applies.
 * Step-downs always use the standard step. Window, run length and fractions
 * are SettledSolo product heuristics.
 */
export function progressionPace(sessions: TrainingSession[]): ProgressionPace {
  const recent = sessions.slice(-PACE_WINDOW);
  // An early return while relaxed is good handling, not a struggle.
  const struggled = recent.some(
    (session) =>
      session.outcome !== "relaxed" ||
      session.signals.length > 0 ||
      session.firstSignSeconds !== undefined
  );
  if (struggled) return "cautious";
  return relaxedRun(sessions) >= CONFIDENT_RUN ? "confident" : "standard";
}

function comfortableDuration(session: TrainingSession): number {
  const returned = session.stoppedEarly ? session.actualSeconds : session.targetSeconds;
  // A marked first sign caps what counts as comfortable, even in a relaxed session.
  return Math.max(1, Math.min(session.targetSeconds, returned, firstSign(session) ?? returned));
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

/**
 * A "relaxed" rating with stress signs ticked is not a clean result: the app's
 * own definition of relaxed excludes pacing, whining or exit-watching for more
 * than a few seconds. Such a session holds the plan rather than advancing it.
 */
function cleanlyRelaxed(session: TrainingSession): boolean {
  return (
    session.outcome === "relaxed" &&
    !session.stoppedEarly &&
    session.signals.length === 0 &&
    session.firstSignSeconds === undefined
  );
}

function relaxedRun(sessions: TrainingSession[]): number {
  let count = 0;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    if (cleanlyRelaxed(sessions[index])) count += 1;
    else break;
  }
  return count;
}

/**
 * Where difficulty showed up in a session: when the owner came back early, the
 * time they came back; otherwise the full planned duration.
 */
function difficultyPoint(session: TrainingSession): number {
  const returned = session.stoppedEarly ? session.actualSeconds : session.targetSeconds;
  return Math.max(1, Math.min(returned, firstSign(session) ?? returned));
}

/**
 * A marked first sign of concern, when it fell within the departure. It is an
 * earlier and better-observed difficulty point than the moment the owner got
 * back, so it can only make a plan easier.
 */
function firstSign(session: TrainingSession): number | undefined {
  const marked = session.firstSignSeconds;
  if (marked === undefined || !Number.isFinite(marked)) return undefined;
  return Math.max(1, Math.round(marked));
}

/**
 * The lowest target an easier plan may use. The configured starting duration
 * is the owner's observation from before training, so it stays the floor only
 * while no session has shown concern or distress at or below it. Once one has,
 * the logged sessions are the better evidence and the plan follows them down,
 * never below one second. Without this, a dog that regressed below its starting
 * duration would be offered that longer starting duration again after distress.
 */
function reductionFloor(sessions: TrainingSession[], start: number): number {
  const contradicted = sessions.some(
    (session) => session.outcome !== "relaxed" && difficultyPoint(session) <= start
  );
  return contradicted ? 1 : start;
}

/**
 * Days without a timed session after which the next plan steps back. Learned
 * calm can partly fade with time away ("spontaneous recovery" in the extinction
 * and exposure literature), so a long break restarts one step easier. The exact
 * number of days is a SettledSolo product heuristic, not a clinical threshold.
 */
export const LONG_BREAK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  configuredStartSeconds: number,
  now = Date.now()
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
      referralSuggested: false,
      highRiskFlag: false
    };
  }

  const last = sessions[sessions.length - 1];
  const floor = reductionFloor(sessions, start);
  const supportFlag = needsSupport(sessions);
  const highRiskFlag = sessions.some((session) =>
    hasHighRiskSignals(session.signals)
  );
  const referral = highRiskFlag || referralSuggested(sessions);
  /**
   * A single distressed session already softens the next target. SettledSolo
   * also suggests a rest day as a cautious product choice; it is not a clinical
   * rule and the owner can choose to make the next session easier instead.
   */
  const restDayRecommended = last.outcome === "distressed";

  if (last.outcome === "distressed") {
    const previousRelaxed = latestRelaxedBefore(sessions, sessions.length - 1);
    const previousComfort = previousRelaxed
      ? comfortableDuration(previousRelaxed)
      : null;
    const observed = difficultyPoint(last);
    const belowObserved = Math.max(floor, observed - stepSize(observed));
    // A full-length distressed session returns to the starting duration, unless
    // the distress happened at or below it; then the plan steps below the distress.
    const observedUpperBound = last.stoppedEarly
      ? belowObserved
      : Math.min(start, belowObserved);
    const target = previousComfort === null
      ? observedUpperBound
      : Math.max(floor, Math.min(previousComfort, observedUpperBound));

    return {
      targetSeconds: target,
      direction: "reduce",
      reason: last.stoppedEarly
        ? "Clear distress appeared before the target, so the next plan stays below the point where difficulty was observed."
        : observed <= start
          ? "The last session showed clear distress even at the starting duration, so the next plan steps below it."
          : "The last session showed clear distress, so the next plan returns to a known comfortable starting point.",
      supportFlag,
      restDayRecommended,
      referralSuggested: referral,
      highRiskFlag
    };
  }

  if (last.outcome === "concern") {
    const previousRelaxed = latestRelaxedBefore(sessions, sessions.length - 1);
    const previousComfort = previousRelaxed
      ? comfortableDuration(previousRelaxed)
      : null;
    const reference = difficultyPoint(last);
    const steppedDown = Math.max(floor, reference - stepSize(reference));
    const target = previousComfort === null
      ? steppedDown
      : Math.max(floor, Math.min(previousComfort, steppedDown));

    return {
      targetSeconds: target,
      direction: "reduce",
      reason: last.stoppedEarly
        ? "Concern appeared before the target, so the next plan stays below the point where it was observed."
        : "There was some concern last time, so the next plan is easier rather than asking for another increase.",
      supportFlag,
      restDayRecommended,
      referralSuggested: referral,
      highRiskFlag
    };
  }

  const daysSinceLast = Math.floor((now - last.at) / DAY_MS);
  if (daysSinceLast >= LONG_BREAK_DAYS) {
    const comfort = comfortableDuration(last);
    return {
      targetSeconds: Math.max(floor, comfort - stepSize(comfort)),
      direction: "reduce",
      reason: `It has been ${daysSinceLast} days since the last timed session. Calm can partly fade after a break, so the plan restarts one step easier and builds back up from there.`,
      supportFlag,
      restDayRecommended,
      referralSuggested: referral,
      highRiskFlag
    };
  }

  if (last.stoppedEarly) {
    const comfort = comfortableDuration(last);
    const target = Math.max(floor, comfort);
    return {
      targetSeconds: target,
      direction: "repeat",
      reason: target > comfort
        ? "You returned early while things were still relaxed. That is not a failure, and your starting duration is still a known-comfortable point, so the plan stays there."
        : "You returned early while things were still relaxed. That actual comfortable duration becomes the next anchor instead of being treated as a failure.",
      supportFlag,
      restDayRecommended,
      referralSuggested: referral,
      highRiskFlag
    };
  }

  if (last.signals.length === 0 && firstSign(last) !== undefined) {
    return {
      targetSeconds: comfortableDuration(last),
      direction: "repeat",
      reason: `It went well overall, but you marked a first sign of concern at ${formatDuration(firstSign(last) ?? 0)}. The next plan stays at that point until a session passes without one.`,
      supportFlag,
      restDayRecommended,
      referralSuggested: referral,
      highRiskFlag
    };
  }

  if (last.signals.length > 0) {
    const noted = last.signals.map((signal) => observedSignalLabel(signal).toLowerCase()).join(", ");
    return {
      targetSeconds: last.targetSeconds,
      direction: "repeat",
      reason: `It went well overall, but you noted ${noted}. Repeat this duration and wait for a session without those signs before making it harder.`,
      supportFlag,
      restDayRecommended,
      referralSuggested: referral,
      highRiskFlag
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
      referralSuggested: referral,
      highRiskFlag
    };
  }

  const pace = progressionPace(sessions);
  const increment = stepSize(last.targetSeconds, PACE_FRACTION[pace]);
  const paceReason: Record<ProgressionPace, string> = {
    cautious: `There was some difficulty in recent sessions, so this step is smaller than usual: ${formatDuration(increment)} (about 5% of the current time).`,
    standard: `Recent sessions were relaxed, so the next plan adds a small step of ${formatDuration(increment)} (about a tenth of the current time).`,
    confident: `Your last ${CONFIDENT_RUN} or more sessions were all calm, so this step is a little bigger: ${formatDuration(increment)} (about 15% of the current time).`
  };
  return {
    targetSeconds: last.targetSeconds + increment,
    direction: "increase",
    reason: paceReason[pace],
    supportFlag,
    restDayRecommended,
    referralSuggested: referral,
    highRiskFlag
  };
}

export const DEFAULT_WARMUP_COUNT = 4;
const LONG_SESSION_WARMUP_COUNT = 2;

export function defaultWarmupCount(targetSeconds: number): number {
  return Math.round(targetSeconds) < 10 * 60
    ? DEFAULT_WARMUP_COUNT
    : LONG_SESSION_WARMUP_COUNT;
}

function seededRandom(seed: number): () => number {
  let state = (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: T[], seed: number): T[] {
  const result = [...values];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/**
 * `variabilitySeed` is a per-session seed. It changes the order of a fixed,
 * conservative set of brief durations; it does not invent a new duration on
 * every tap. That keeps Shuffle useful without creating an unbounded random
 * progression. Short targets default to four warm-ups; longer targets keep
 * two. Every warm-up is capped at one minute, and targets below two minutes
 * also cap warm-ups at half the main target.
 *
 * The count, shape and ceiling remain SettledSolo product heuristics rather
 * than any fixed published baseline plan. The safety rule is that every practice
 * departure stays below the main ceiling and remains brief.
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

  const shapes: Record<number, number[]> = {
    1: [0.5],
    2: [0.32, 0.78],
    3: [0.16, 0.52, 0.84],
    4: [0.16, 0.46, 0.68, 0.9]
  };
  const values: number[] = [];
  for (const fraction of shapes[actualCount]) {
    let seconds = Math.round(minimum + (maximum - minimum) * fraction);
    while (values.includes(seconds) && seconds < maximum) seconds += 1;
    if (values.includes(seconds)) {
      seconds = minimum;
      while (values.includes(seconds) && seconds < maximum) seconds += 1;
    }
    values.push(seconds);
  }

  const ordered = [...values].sort((a, b) => a - b);
  return shuffleWarmups ? shuffled(ordered, variabilitySeed) : ordered;
}

/**
 * The time a session counts for in progress, milestones and achievements: what
 * actually happened, but never more than the planned target. An owner who
 * forgets to tap "I'm back" must not appear to have jumped ahead, so credit can
 * only grow through the gradual target progression. A session that was not
 * stopped early (including a return inside the walk-back reminder window)
 * completed its plan and counts as the full target. History still records the
 * real duration. This is a SettledSolo product rule, not a clinical threshold.
 */
export function creditedSeconds(
  session: Pick<TrainingSession, "actualSeconds" | "targetSeconds" | "stoppedEarly">
): number {
  const target = Math.max(0, session.targetSeconds);
  return session.stoppedEarly ? Math.max(0, Math.min(session.actualSeconds, target)) : target;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, "0")}`
    : `${remainder}s`;
}
