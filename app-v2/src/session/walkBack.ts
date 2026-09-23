/**
 * How long the owner needs to walk back to their dog. Reminders fire this long
 * before the target so the owner arrives around the target instead of after it.
 * Device-local: it describes this home's layout and is never synced or backed up.
 */
export const WALK_BACK_KEY = "settledsolo.walk-back.v1";
export const DEFAULT_WALK_BACK_SECONDS = 30;
export const WALK_BACK_OPTIONS: Array<{ seconds: number; label: string }> = [
  { seconds: 0, label: "At the target" },
  { seconds: 15, label: "15 seconds before" },
  { seconds: 30, label: "30 seconds before" },
  { seconds: 60, label: "1 minute before" },
  { seconds: 120, label: "2 minutes before" },
  { seconds: 300, label: "5 minutes before" }
];

export function loadWalkBackSeconds(): number {
  try {
    const raw = globalThis.localStorage?.getItem(WALK_BACK_KEY);
    const stored = raw == null ? NaN : Number(raw);
    return WALK_BACK_OPTIONS.some((option) => option.seconds === stored)
      ? stored
      : DEFAULT_WALK_BACK_SECONDS;
  } catch {
    return DEFAULT_WALK_BACK_SECONDS;
  }
}

export function saveWalkBackSeconds(seconds: number): void {
  try {
    globalThis.localStorage?.setItem(WALK_BACK_KEY, String(seconds));
  } catch {
    // The default still applies when storage is unavailable.
  }
}

/**
 * The lead actually used for one departure. Capped at a quarter of the target so
 * short departures are not cut in half; departures under 20 seconds get none,
 * because the owner is only just outside the door.
 */
export function effectiveWalkBackSeconds(targetSeconds: number, walkBackSeconds: number): number {
  if (targetSeconds < 20) return 0;
  return Math.max(0, Math.min(walkBackSeconds, Math.floor(targetSeconds / 4)));
}

/** When the "head back" reminder should fire for a departure started at `startedAt`. */
export function headBackAt(startedAt: number, targetSeconds: number, leadSeconds: number): number {
  return startedAt + Math.max(0, targetSeconds - leadSeconds) * 1000;
}

/**
 * A return inside the walk-back window is on target, not an early stop: the owner
 * did what the reminder asked. Only a return before the window counts as early.
 */
export function returnedEarly(actualSeconds: number, targetSeconds: number, leadSeconds: number): boolean {
  return actualSeconds < targetSeconds - leadSeconds;
}
