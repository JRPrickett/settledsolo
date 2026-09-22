import type { Outcome, PracticeDepartureReview } from "../domain/types";

export type SessionPhase = "idle" | "running" | "between" | "review";

export interface SessionStep {
  kind: "practice" | "main";
  targetSeconds: number;
}

export interface LiveSessionState {
  phase: SessionPhase;
  steps: SessionStep[];
  stepIndex: number;
  startedAt: number | null;
  returnedAt: number | null;
  mainActualSeconds: number | null;
  /** Actual duration of the most recently returned practice departure. */
  currentActualSeconds?: number | null;
  /** Outcome recorded for the current practice departure. */
  practiceOutcome?: Outcome | null;
  /** Structured warm-up observations retained in the active snapshot and saved session. */
  practiceReviews?: PracticeDepartureReview[];
  /** Which departure produced the review screen, for interruption-safe copy and saving. */
  reviewKind?: "main" | "practice";
  reviewOutcome?: Outcome | null;
  warningIssued: boolean;
  targetIssued: boolean;
}

export type LiveSessionAction =
  | { type: "START_STEP"; now: number }
  | { type: "RETURN"; now: number }
  | { type: "RECORD_PRACTICE_OUTCOME"; outcome: Outcome }
  | { type: "NEXT_STEP" }
  | { type: "MARK_WARNING_ISSUED" }
  | { type: "MARK_TARGET_ISSUED" }
  | { type: "RESET" };

export function initialLiveSession(steps: SessionStep[]): LiveSessionState {
  return {
    phase: "idle",
    steps,
    stepIndex: 0,
    startedAt: null,
    returnedAt: null,
    mainActualSeconds: null,
    currentActualSeconds: null,
    practiceOutcome: null,
    practiceReviews: [],
    reviewKind: "main",
    reviewOutcome: null,
    warningIssued: false,
    targetIssued: false
  };
}

export function elapsedSeconds(state: LiveSessionState, now: number): number {
  if (state.startedAt === null) return 0;
  const end = state.returnedAt ?? now;
  return Math.max(0, Math.floor((end - state.startedAt) / 1000));
}

export function liveSessionReducer(
  state: LiveSessionState,
  action: LiveSessionAction
): LiveSessionState {
  switch (action.type) {
    case "START_STEP":
      if (state.phase !== "idle") return state;
      return {
        ...state,
        phase: "running",
        startedAt: action.now,
        returnedAt: null,
        warningIssued: false,
        targetIssued: false
      };

    case "RETURN": {
      if (state.phase !== "running" || state.startedAt === null) return state;
      const actual = Math.max(1, Math.floor((action.now - state.startedAt) / 1000));
      const current = state.steps[state.stepIndex];
      const isMain = current?.kind === "main";
      return {
        ...state,
        phase: isMain ? "review" : "between",
        returnedAt: action.now,
        mainActualSeconds: isMain ? actual : state.mainActualSeconds,
        currentActualSeconds: isMain ? state.currentActualSeconds : actual,
        practiceOutcome: isMain ? state.practiceOutcome : null,
        reviewKind: isMain ? "main" : state.reviewKind,
        reviewOutcome: isMain ? null : state.reviewOutcome
      };
    }

    case "RECORD_PRACTICE_OUTCOME": {
      const current = state.steps[state.stepIndex];
      const actual =
        state.currentActualSeconds ??
        (state.startedAt !== null && state.returnedAt !== null
          ? elapsedSeconds(state, state.returnedAt)
          : null);
      if (
        state.phase !== "between" ||
        current?.kind !== "practice" ||
        state.practiceOutcome ||
        actual == null
      ) {
        return state;
      }

      const review: PracticeDepartureReview = {
        targetSeconds: current.targetSeconds,
        actualSeconds: actual,
        outcome: action.outcome
      };
      const practiceReviews = [
        ...(state.practiceReviews ?? []),
        review
      ];

      if (action.outcome !== "relaxed") {
        return {
          ...state,
          phase: "review",
          mainActualSeconds: actual,
          currentActualSeconds: actual,
          practiceOutcome: action.outcome,
          practiceReviews,
          reviewKind: "practice",
          reviewOutcome: action.outcome
        };
      }

      return {
        ...state,
        currentActualSeconds: actual,
        practiceOutcome: action.outcome,
        practiceReviews
      };
    }

    case "NEXT_STEP":
      if (
        state.phase !== "between" ||
        state.steps[state.stepIndex]?.kind !== "practice" ||
        state.practiceOutcome == null
      ) return state;
      return {
        ...state,
        phase: "idle",
        stepIndex: Math.min(state.stepIndex + 1, state.steps.length - 1),
        startedAt: null,
        returnedAt: null,
        currentActualSeconds: null,
        practiceOutcome: null,
        reviewKind: "main",
        reviewOutcome: null,
        warningIssued: false,
        targetIssued: false
      };

    case "MARK_WARNING_ISSUED":
      return state.warningIssued
        ? state
        : { ...state, warningIssued: true };

    case "MARK_TARGET_ISSUED":
      return state.targetIssued
        ? state
        : { ...state, targetIssued: true };

    case "RESET":
      return initialLiveSession(state.steps);

    default:
      return state;
  }
}
