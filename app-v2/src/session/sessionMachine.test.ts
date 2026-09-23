import { describe, expect, it } from "vitest";
import {
  elapsedSeconds,
  hasRealDeparture,
  initialLiveSession,
  liveSessionReducer
} from "./sessionMachine";

describe("live session state machine", () => {
  it("derives elapsed time from timestamps rather than interval ticks", () => {
    let state = initialLiveSession([{ kind: "main", targetSeconds: 30 }]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });
    expect(elapsedSeconds(state, 16_750)).toBe(15);
  });

  it("moves practice departure into a settle break", () => {
    let state = initialLiveSession([
      { kind: "practice", targetSeconds: 5 },
      { kind: "main", targetSeconds: 20 }
    ]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });
    state = liveSessionReducer(state, { type: "RETURN", now: 6_000 });
    expect(state.phase).toBe("between");
    state = liveSessionReducer(state, {
      type: "RECORD_PRACTICE_OUTCOME",
      outcome: "relaxed"
    });
    expect(state.practiceReviews).toEqual([
      { targetSeconds: 5, actualSeconds: 5, outcome: "relaxed" }
    ]);
    state = liveSessionReducer(state, { type: "NEXT_STEP" });
    expect(state.stepIndex).toBe(1);
    expect(state.phase).toBe("idle");
  });

  it("moves the main departure to review and records actual duration", () => {
    let state = initialLiveSession([{ kind: "main", targetSeconds: 20 }]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });
    state = liveSessionReducer(state, { type: "RETURN", now: 18_500 });
    expect(state.phase).toBe("review");
    expect(state.mainActualSeconds).toBe(17);
  });
});


describe("session alert state", () => {
  it("records warning and target delivery across persistence snapshots", () => {
    let state = initialLiveSession([{ kind: "main", targetSeconds: 30 }]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });
    state = liveSessionReducer(state, { type: "MARK_WARNING_ISSUED" });
    state = liveSessionReducer(state, { type: "MARK_TARGET_ISSUED" });

    expect(state.warningIssued).toBe(true);
    expect(state.targetIssued).toBe(true);
  });

  it("resets alert flags when the next departure begins", () => {
    let state = initialLiveSession([
      { kind: "practice", targetSeconds: 5 },
      { kind: "main", targetSeconds: 20 }
    ]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });
    state = liveSessionReducer(state, { type: "MARK_TARGET_ISSUED" });
    state = liveSessionReducer(state, { type: "RETURN", now: 6_000 });
    state = liveSessionReducer(state, {
      type: "RECORD_PRACTICE_OUTCOME",
      outcome: "relaxed"
    });
    state = liveSessionReducer(state, { type: "NEXT_STEP" });

    expect(state.warningIssued).toBe(false);
    expect(state.targetIssued).toBe(false);
  });

  it("stops before the main departure when a warm-up shows concern", () => {
    let state = initialLiveSession([
      { kind: "practice", targetSeconds: 5 },
      { kind: "main", targetSeconds: 20 }
    ]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });
    state = liveSessionReducer(state, { type: "RETURN", now: 4_000 });
    state = liveSessionReducer(state, {
      type: "RECORD_PRACTICE_OUTCOME",
      outcome: "concern"
    });

    expect(state.phase).toBe("review");
    expect(state.reviewKind).toBe("practice");
    expect(state.mainActualSeconds).toBe(3);
    expect(state.practiceReviews).toEqual([
      { targetSeconds: 5, actualSeconds: 3, outcome: "concern" }
    ]);
  });
});

describe("discard protection", () => {
  it("lets an untouched session close freely but protects any real departure", () => {
    let state = initialLiveSession([
      { kind: "practice", targetSeconds: 5 },
      { kind: "main", targetSeconds: 20 }
    ]);
    expect(hasRealDeparture(state)).toBe(false);

    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });
    expect(hasRealDeparture(state)).toBe(true);

    state = liveSessionReducer(state, { type: "RETURN", now: 6_000 });
    state = liveSessionReducer(state, { type: "RECORD_PRACTICE_OUTCOME", outcome: "relaxed" });
    state = liveSessionReducer(state, { type: "NEXT_STEP" });
    // Back to idle before the main departure, but a warm-up already happened.
    expect(state.phase).toBe("idle");
    expect(hasRealDeparture(state)).toBe(true);
  });
});

describe("correcting a late 'I'm back' tap", () => {
  it("can lower the recorded return to the target and undo it, but never raise it", () => {
    let state = initialLiveSession([{ kind: "main", targetSeconds: 60 }]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 0 });
    state = liveSessionReducer(state, { type: "RETURN", now: 300_000 });
    expect(state.mainActualSeconds).toBe(300);

    state = liveSessionReducer(state, { type: "CORRECT_MAIN_RETURN", seconds: 60 });
    expect(state.mainActualSeconds).toBe(60);
    state = liveSessionReducer(state, { type: "CORRECT_MAIN_RETURN", seconds: 300 });
    expect(state.mainActualSeconds).toBe(300);
    expect(liveSessionReducer(state, { type: "CORRECT_MAIN_RETURN", seconds: 301 })).toBe(state);
    expect(liveSessionReducer(state, { type: "CORRECT_MAIN_RETURN", seconds: 0 })).toBe(state);
  });

  it("does nothing outside a main review", () => {
    let state = initialLiveSession([{ kind: "main", targetSeconds: 60 }]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 0 });
    expect(liveSessionReducer(state, { type: "CORRECT_MAIN_RETURN", seconds: 10 })).toBe(state);
  });
});
