import type {
  CoverOption,
  JournalEntry,
  LifeEventCategory,
  Outcome
} from "./types";

/**
 * The journal holds owner-entered context that is not a training session: life
 * events (including a vet-prescribed medication starting or changing), real
 * absences that could not be avoided, and planned absences with their cover.
 * None of it is advice; it records what happened so the owner, a professional
 * and the plan can take it into account.
 */

export const LIFE_EVENT_LABELS: Record<LifeEventCategory, string> = {
  "moved-home": "Moved home",
  health: "Illness, injury or surgery",
  "household-change": "New person or pet, or someone left",
  "routine-change": "Work or routine change",
  "frightening-event": "A frightening event",
  "medication-change": "Vet medication started or changed",
  other: "Something else"
};

export const COVER_LABELS: Record<CoverOption, string> = {
  "sitter-or-daycare": "Sitter or daycare",
  walker: "Dog walker",
  "partner-or-friend": "Partner, friend or neighbour",
  "bring-along": "Coming with me",
  "not-covered": "Not covered yet"
};

export const REAL_ABSENCE_OUTCOME_LABELS: Record<Outcome | "unknown", string> = {
  unknown: "Not sure",
  relaxed: "Relaxed",
  concern: "Some concern",
  distressed: "Distressed"
};

const LIFE_EVENT_CATEGORIES = Object.keys(LIFE_EVENT_LABELS) as LifeEventCategory[];
const COVER_OPTIONS = Object.keys(COVER_LABELS) as CoverOption[];
const ABSENCE_OUTCOMES = Object.keys(REAL_ABSENCE_OUTCOME_LABELS) as Array<Outcome | "unknown">;

/** A real absence in hours and minutes, e.g. "3 h 30 min" or "45 min". */
export function formatAbsenceDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

/** The longest real absence that can be logged or planned: one day. */
export const MAX_JOURNAL_DURATION_SECONDS = 24 * 60 * 60;
const MAX_ENTRIES = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function duration(value: unknown): number {
  return Math.max(60, Math.min(MAX_JOURNAL_DURATION_SECONDS, Math.round(finite(value, 60))));
}

/** Validates stored, restored or synced entries, dropping anything unusable. */
export function cleanJournal(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: JournalEntry[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = String(item.id || "").slice(0, 100);
    if (!id || seen.has(id)) continue;
    const at = Math.max(0, finite(item.at, NaN));
    if (!Number.isFinite(at)) continue;
    const note = String(item.note || "").slice(0, 280);

    if (item.type === "life-event" && LIFE_EVENT_CATEGORIES.includes(item.category as LifeEventCategory)) {
      entries.push({ type: "life-event", id, at, category: item.category as LifeEventCategory, note });
    } else if (item.type === "real-absence") {
      const outcome = ABSENCE_OUTCOMES.includes(item.outcome as Outcome) ? (item.outcome as Outcome | "unknown") : "unknown";
      entries.push({ type: "real-absence", id, at, durationSeconds: duration(item.durationSeconds), outcome, note });
    } else if (item.type === "planned-absence") {
      const cover = COVER_OPTIONS.includes(item.cover as CoverOption) ? (item.cover as CoverOption) : "not-covered";
      entries.push({ type: "planned-absence", id, at, durationSeconds: duration(item.durationSeconds), cover, note });
    } else {
      continue;
    }
    seen.add(id);
  }
  return entries.sort((a, b) => a.at - b.at).slice(-MAX_ENTRIES);
}

/** Unavoidable absences after `since` that the owner saw go badly. */
export function difficultAbsencesSince(journal: JournalEntry[] | undefined, since: number) {
  return (journal ?? []).filter(
    (entry): entry is Extract<JournalEntry, { type: "real-absence" }> =>
      entry.type === "real-absence" &&
      entry.at > since &&
      (entry.outcome === "concern" || entry.outcome === "distressed")
  );
}

/** Planned absences from the start of today up to `days` ahead, soonest first. */
export function upcomingPlannedAbsences(journal: JournalEntry[] | undefined, now = Date.now(), days = 7) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = start.getTime() + days * 24 * 60 * 60 * 1000;
  return (journal ?? [])
    .filter(
      (entry): entry is Extract<JournalEntry, { type: "planned-absence" }> =>
        entry.type === "planned-absence" && entry.at >= start.getTime() && entry.at < end
    )
    .sort((a, b) => a.at - b.at);
}

export function lifeEvents(journal: JournalEntry[] | undefined) {
  return (journal ?? []).filter(
    (entry): entry is Extract<JournalEntry, { type: "life-event" }> => entry.type === "life-event"
  );
}

export function realAbsences(journal: JournalEntry[] | undefined) {
  return (journal ?? []).filter(
    (entry): entry is Extract<JournalEntry, { type: "real-absence" }> => entry.type === "real-absence"
  );
}
