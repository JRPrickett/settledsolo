import type { LiveSessionState } from "./sessionMachine";

export interface PersistedLiveSession {
  scenarioId: string;
  targetSeconds: number;
  state: LiveSessionState;
  savedAt: number;
}

export function makePersistedLiveSession(
  scenarioId: string,
  targetSeconds: number,
  state: LiveSessionState,
  now = Date.now()
): PersistedLiveSession {
  return {
    scenarioId: String(scenarioId || ""),
    targetSeconds: Math.max(1, Math.round(targetSeconds)),
    state,
    savedAt: now
  };
}

export function isRestorableLiveSession(
  value: PersistedLiveSession | null,
  now = Date.now()
): value is PersistedLiveSession {
  if (!value) return false;
  if (!value.scenarioId) return false;
  if (!Number.isFinite(value.targetSeconds) || value.targetSeconds < 1) return false;
  if (!value.state || !Array.isArray(value.state.steps) || !value.state.steps.length) {
    return false;
  }
  if (
    !["idle", "running", "between", "review"].includes(value.state.phase) ||
    value.state.stepIndex < 0 ||
    value.state.stepIndex >= value.state.steps.length
  ) {
    return false;
  }

  if (value.state.phase === "running" && !Number.isFinite(value.state.startedAt)) {
    return false;
  }

  return now - value.savedAt <= 12 * 60 * 60 * 1000;
}

/**
 * Every checkpoint is written to the localStorage fallback first and IndexedDB
 * second. If the app is closed between the two writes, the fallback is newer, so
 * restore whichever restorable copy was saved last rather than always the primary.
 */
export function newestLiveSession(
  primary: PersistedLiveSession | null,
  fallback: PersistedLiveSession | null,
  now = Date.now()
): PersistedLiveSession | null {
  const primaryOk = isRestorableLiveSession(primary, now);
  const fallbackOk = isRestorableLiveSession(fallback, now);
  if (primaryOk && fallbackOk) return fallback.savedAt > primary.savedAt ? fallback : primary;
  if (primaryOk) return primary;
  return fallbackOk ? fallback : null;
}
