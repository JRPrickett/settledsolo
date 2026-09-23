import { describe, expect, it } from "vitest";
import { initialLiveSession, liveSessionReducer } from "./sessionMachine";
import {
  newestLiveSession,
  isRestorableLiveSession,
  makePersistedLiveSession
} from "./sessionPersistence";

describe("active-session persistence", () => {
  it("restores a running session using the original timestamp", () => {
    let state = initialLiveSession([{ kind: "main", targetSeconds: 30 }]);
    state = liveSessionReducer(state, { type: "START_STEP", now: 1_000 });

    const saved = makePersistedLiveSession("training", 30, state, 5_000);
    expect(isRestorableLiveSession(saved, 10_000)).toBe(true);
    expect(saved.state.startedAt).toBe(1_000);
  });

  it("rejects stale active sessions", () => {
    const state = initialLiveSession([{ kind: "main", targetSeconds: 30 }]);
    const saved = makePersistedLiveSession("training", 30, state, 1_000);
    expect(isRestorableLiveSession(saved, 13 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("choosing between the primary and fallback checkpoints", () => {
  const steps = [{ kind: "main" as const, targetSeconds: 60 }];
  const running = liveSessionReducer(initialLiveSession(steps), { type: "START_STEP", now: 1_000 });
  const review = liveSessionReducer(running, { type: "RETURN", now: 61_000 });
  const older = makePersistedLiveSession("training", 60, running, 2_000);
  const newer = makePersistedLiveSession("training", 60, review, 62_000);

  it("restores the newer copy when the app closed between the two writes", () => {
    expect(newestLiveSession(older, newer, 70_000)).toBe(newer);
    expect(newestLiveSession(newer, older, 70_000)).toBe(newer);
  });

  it("uses whichever copy is restorable", () => {
    expect(newestLiveSession(older, null, 70_000)).toBe(older);
    expect(newestLiveSession(null, newer, 70_000)).toBe(newer);
    expect(newestLiveSession(null, null, 70_000)).toBeNull();
    const expired = 62_000 + 13 * 60 * 60 * 1000;
    expect(newestLiveSession(newer, null, expired)).toBeNull();
  });
});
