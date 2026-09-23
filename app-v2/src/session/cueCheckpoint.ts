import { CUE_REPETITIONS, DEPARTURE_CUES } from "../domain/departureCues";

/** Device-local only: an unfinished cue set is never synced or backed up. */
export const CUE_CHECKPOINT_KEY = "settledsolo.cue-practice.v1";

/** A set is a few minutes long; anything older is stale, not something to resume. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface CueCheckpoint {
  scenarioId: string;
  cueIndex: number;
  rep: number;
  relaxedReps: number;
  concernReps: number;
  savedAt: number;
}

function whole(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
    ? value
    : null;
}

export function parseCueCheckpoint(value: unknown, now = Date.now()): CueCheckpoint | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  const cueIndex = whole(input.cueIndex, DEPARTURE_CUES.length - 1);
  const rep = whole(input.rep, CUE_REPETITIONS);
  const relaxedReps = whole(input.relaxedReps, CUE_REPETITIONS);
  const concernReps = whole(input.concernReps, 1);
  const savedAt = typeof input.savedAt === "number" ? input.savedAt : NaN;
  if (
    typeof input.scenarioId !== "string" ||
    !input.scenarioId ||
    cueIndex === null ||
    rep === null ||
    relaxedReps === null ||
    concernReps === null ||
    relaxedReps + concernReps === 0 ||
    // A concern ends the set, so every recorded rep before it was relaxed.
    relaxedReps + concernReps > CUE_REPETITIONS ||
    (concernReps === 0 && rep !== relaxedReps) ||
    (concernReps === 1 && rep !== CUE_REPETITIONS) ||
    !(savedAt <= now && now - savedAt <= MAX_AGE_MS)
  ) {
    return null;
  }
  return { scenarioId: input.scenarioId, cueIndex, rep, relaxedReps, concernReps, savedAt };
}

export function loadCueCheckpoint(now = Date.now()): CueCheckpoint | null {
  try {
    const raw = globalThis.localStorage?.getItem(CUE_CHECKPOINT_KEY);
    const parsed = raw ? parseCueCheckpoint(JSON.parse(raw), now) : null;
    if (raw && !parsed) clearCueCheckpoint();
    return parsed;
  } catch {
    return null;
  }
}

export function saveCueCheckpoint(checkpoint: CueCheckpoint): void {
  try {
    globalThis.localStorage?.setItem(CUE_CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch {
    // Progressive enhancement: practice still works without a resumable checkpoint.
  }
}

export function clearCueCheckpoint(): void {
  try {
    globalThis.localStorage?.removeItem(CUE_CHECKPOINT_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
