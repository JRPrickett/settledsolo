import type { JournalEntry, Recommendation, TrainingSession } from "./types";
import { creditedSeconds, formatDuration, recommendNext, stepSize } from "./trainingEngine";
import { difficultAbsencesSince } from "./journal";

const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * The plan, taking unavoidable real absences into account.
 *
 * Practitioner guidance treats every absence as exposure, not only training
 * sessions. So when an unavoidable absence since the last session went badly,
 * the plan never steps up: concern holds the last duration, distress steps one
 * step easier. An absence cannot make a plan harder. The exact response is a
 * SettledSolo rule of thumb, not a clinical threshold.
 */
export function recommendWithJournal(
  sessions: TrainingSession[],
  startSeconds: number,
  journal: JournalEntry[] | undefined,
  now = Date.now()
): Recommendation {
  const base = recommendNext(sessions, startSeconds, now);
  const last = sessions.at(-1);
  if (!last || base.highRiskFlag) return base;

  const difficult = difficultAbsencesSince(journal, last.at);
  if (!difficult.length) return base;

  const distressed = difficult.some((entry) => entry.outcome === "distressed");
  const latest = difficult.at(-1)!;
  const hold = Math.min(base.targetSeconds, last.targetSeconds);
  const target = distressed ? Math.max(1, hold - stepSize(hold)) : hold;
  if (target >= base.targetSeconds && base.direction !== "increase") return base;

  return {
    ...base,
    targetSeconds: Math.min(target, base.targetSeconds),
    direction: distressed || target < last.targetSeconds ? "reduce" : "repeat",
    reason: distressed
      ? `An unavoidable absence on ${shortDate(latest.at)} was distressing, so today steps back rather than up.`
      : `An unavoidable absence on ${shortDate(latest.at)} showed some concern, so today holds at ${formatDuration(target)} instead of stepping up.`,
    restDayRecommended: base.restDayRecommended || distressed
  };
}

/** Sessions examined for a plateau. */
export const PLATEAU_WINDOW = 10;
/** A plateau needs this many days of training in the window. */
export const PLATEAU_MIN_DAYS = 14;

/**
 * Training has continued for a while without the plan moving on. A plateau is
 * common and is not failure; it is a prompt to look at what else might be going
 * on. The window and duration are SettledSolo rules of thumb.
 */
export function plateauSuggested(sessions: TrainingSession[]): boolean {
  if (sessions.length < PLATEAU_WINDOW) return false;
  const window = sessions.slice(-PLATEAU_WINDOW);
  const span = window.at(-1)!.at - window[0].at;
  if (span < PLATEAU_MIN_DAYS * DAY_MS) return false;
  return window.at(-1)!.targetSeconds <= window[0].targetSeconds;
}

export interface PeriodSummary {
  sessions: number;
  relaxed: number;
  longestRelaxedSeconds: number;
}

export interface MonthlyTrend {
  current: PeriodSummary;
  previous: PeriodSummary;
}

function summarise(sessions: TrainingSession[]): PeriodSummary {
  const relaxed = sessions.filter((session) => session.outcome === "relaxed");
  return {
    sessions: sessions.length,
    relaxed: relaxed.length,
    longestRelaxedSeconds: relaxed.reduce((best, session) => Math.max(best, creditedSeconds(session)), 0)
  };
}

/**
 * The last 30 days against the 30 before, for this dog's own record only.
 * Never a forecast or a comparison with other dogs.
 */
export function monthlyTrend(sessions: TrainingSession[], now = Date.now()): MonthlyTrend | null {
  const currentStart = now - 30 * DAY_MS;
  const previousStart = now - 60 * DAY_MS;
  const current = sessions.filter((session) => session.at > currentStart && session.at <= now);
  const previous = sessions.filter((session) => session.at > previousStart && session.at <= currentStart);
  if (!current.length || !previous.length) return null;
  return { current: summarise(current), previous: summarise(previous) };
}
