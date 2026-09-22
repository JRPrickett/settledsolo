import type { AppData } from "./types";

/**
 * Two main departures is the default ceiling, not a target. Separation-anxiety work
 * needs comfortable gaps between sessions; more attempts are not automatically
 * better, particularly if the dog is not settled between them.
 * Counted across every training track, because it's the same dog doing
 * all of them. A timed session that ends during a warm-up still uses one
 * allowance: it involved a real departure and should not be repeated just to
 * reach the main step. Departure-cue practice doesn't count — it never leaves
 * the dog alone.
 *
 * The product allows a deliberately narrow 1–3 range. Published guidance does
 * not establish a universal daily number, so this is a conservative planning
 * boundary rather than a clinical dosage.
 */
export const MIN_DAILY_CAP = 1;
export const MAX_DAILY_CAP = 3;
export const DEFAULT_DAILY_CAP = 2;

export function clampDailyCap(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_DAILY_CAP;
  return Math.max(MIN_DAILY_CAP, Math.min(MAX_DAILY_CAP, Math.round(numeric)));
}

function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function effectiveDailyCap(data: AppData): number {
  return data.dailyCap == null
    ? DEFAULT_DAILY_CAP
    : clampDailyCap(data.dailyCap);
}

export function sessionsToday(data: AppData, now: number = Date.now()): number {
  const from = startOfDay(now);
  return data.scenarios.reduce(
    (count, scenario) =>
      count + scenario.sessions.filter((session) => session.at >= from).length,
    0
  );
}

export function isDailyCapReached(
  data: AppData,
  cap: number = DEFAULT_DAILY_CAP,
  now: number = Date.now()
): boolean {
  return sessionsToday(data, now) >= clampDailyCap(cap);
}
