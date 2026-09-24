import type {
  AppData,
  Outcome,
  Recommendation,
  Scenario,
  StartingPath,
  TrainingSession
} from "../domain/types";
import { creditedSeconds, recommendNext } from "../domain/trainingEngine";
import { hasHighRiskSignals, observedSignalLabel } from "../domain/observedSignals";
import { SESSION_TAG_OPTIONS } from "../domain/sessionTags";
import { DEPARTURE_CUES, recommendCueLevel } from "../domain/departureCues";
import { effectiveDailyCap } from "../domain/dailyCap";
import { findingLabel } from "../domain/preProtocolObservation";

/**
 * A readable record for a vet, trainer or behaviourist, built only from the
 * owner's local data. Nothing here leaves the device unless the owner prints or
 * shares it.
 */

/** Sessions listed per track. The CSV export keeps the complete history. */
export const SUMMARY_SESSION_ROWS = 20;
/** The "recent comfort" window, matching Progress. */
export const SUMMARY_RECENT_WINDOW = 10;

export const OUTCOME_LABELS: Record<Outcome, string> = {
  relaxed: "Relaxed",
  concern: "Some concern",
  distressed: "Distressed"
};

const STARTING_ROUTE_LABELS: Record<StartingPath, string> = {
  "departure-cues": "Departure cues first (no real leaving at the start)",
  "micro-departure": "Very brief first departure (no known comfortable absence)",
  "known-duration": "From a comfortable absence the owner had already seen"
};

const DIRECTION_LABELS: Record<Recommendation["direction"], string> = {
  start: "Starting point",
  repeat: "Repeat",
  increase: "Small step up",
  reduce: "Easier"
};

const tagLabel = new Map(SESSION_TAG_OPTIONS.map(({ value, label }) => [value, label]));

export interface CountedLabel {
  label: string;
  count: number;
}

export interface SummarySessionRow {
  id: string;
  at: number;
  targetSeconds: number;
  actualSeconds: number;
  stoppedEarly: boolean;
  outcome: Outcome;
  signals: string[];
  tags: string[];
  /** Warm-up departures before the main one, when any were recorded. */
  warmups: { total: number; relaxed: number } | null;
  stopReason: string;
  note: string;
  highRisk: boolean;
}

export interface SummaryNextPlan {
  targetSeconds: number;
  direction: string;
  reason: string;
  /** A high-risk sign was recorded: the app has paused timed departures. */
  paused: boolean;
  restDaySuggested: boolean;
  supportSuggested: boolean;
  vetSuggested: boolean;
}

export interface SummaryCuePractice {
  currentCue: string;
  sets: number;
  lastOutcome: Outcome | null;
  lastAt: number | null;
}

export interface SummaryTrack {
  id: string;
  label: string;
  startSeconds: number;
  sessionCount: number;
  firstAt: number | null;
  lastAt: number | null;
  outcomes: Record<Outcome, number>;
  recentTotal: number;
  recentRelaxed: number;
  longestRelaxedSeconds: number;
  next: SummaryNextPlan | null;
  signals: CountedLabel[];
  tags: CountedLabel[];
  highRiskDates: number[];
  cuePractice: SummaryCuePractice | null;
  rows: SummarySessionRow[];
  /** Older sessions not listed; they are still in the CSV export. */
  olderSessions: number;
}

export interface TrainingSummary {
  dogName: string;
  generatedAt: number;
  startingRoute: string | null;
  dailyCap: number;
  totalSessions: number;
  firstAt: number | null;
  lastAt: number | null;
  observation: { skipped: boolean; findings: string[]; at: number } | null;
  tracks: SummaryTrack[];
}

function counted(values: string[]): CountedLabel[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function warmupSummary(session: TrainingSession): SummarySessionRow["warmups"] {
  const reviews = session.practiceReviews ?? [];
  if (!reviews.length) return null;
  return {
    total: reviews.length,
    relaxed: reviews.filter((review) => review.outcome === "relaxed").length
  };
}

function sessionRow(session: TrainingSession): SummarySessionRow {
  return {
    id: session.id,
    at: session.at,
    targetSeconds: session.targetSeconds,
    actualSeconds: session.actualSeconds,
    stoppedEarly: session.stoppedEarly,
    outcome: session.outcome,
    signals: session.signals.map(observedSignalLabel),
    tags: session.tags.map((tag) => tagLabel.get(tag) ?? tag),
    warmups: warmupSummary(session),
    stopReason: session.stopReason.trim(),
    note: session.note.trim(),
    highRisk: hasHighRiskSignals(session.signals)
  };
}

function nextPlan(scenario: Scenario, now: number): SummaryNextPlan | null {
  if (!scenario.sessions.length) return null;
  const recommendation = recommendNext(scenario.sessions, scenario.startSeconds, now);
  return {
    targetSeconds: recommendation.targetSeconds,
    direction: DIRECTION_LABELS[recommendation.direction],
    reason: recommendation.reason,
    paused: recommendation.highRiskFlag,
    restDaySuggested: recommendation.restDayRecommended,
    supportSuggested: recommendation.supportFlag,
    vetSuggested: recommendation.referralSuggested
  };
}

function cuePractice(scenario: Scenario): SummaryCuePractice | null {
  const practice = scenario.cuePractice;
  if (!practice || !practice.sessions.length) return null;
  const latest = practice.sessions.at(-1) ?? null;
  return {
    currentCue: DEPARTURE_CUES[recommendCueLevel(practice).cueIndex],
    sets: practice.sessions.length,
    lastOutcome: latest?.outcome ?? null,
    lastAt: latest?.at ?? null
  };
}

function summariseTrack(scenario: Scenario, now: number): SummaryTrack {
  const sessions = [...scenario.sessions].sort((a, b) => a.at - b.at);
  const recent = sessions.slice(-SUMMARY_RECENT_WINDOW);
  const outcomes: Record<Outcome, number> = { relaxed: 0, concern: 0, distressed: 0 };
  for (const session of sessions) outcomes[session.outcome] += 1;

  return {
    id: scenario.id,
    label: scenario.label,
    startSeconds: scenario.startSeconds,
    sessionCount: sessions.length,
    firstAt: sessions[0]?.at ?? null,
    lastAt: sessions.at(-1)?.at ?? null,
    outcomes,
    recentTotal: recent.length,
    recentRelaxed: recent.filter((session) => session.outcome === "relaxed").length,
    longestRelaxedSeconds: sessions
      .filter((session) => session.outcome === "relaxed")
      .reduce((best, session) => Math.max(best, creditedSeconds(session)), 0),
    next: nextPlan({ ...scenario, sessions }, now),
    signals: counted(sessions.flatMap((session) => session.signals.map(observedSignalLabel))),
    tags: counted(sessions.flatMap((session) => session.tags.map((tag) => tagLabel.get(tag) ?? tag))),
    highRiskDates: sessions
      .filter((session) => hasHighRiskSignals(session.signals))
      .map((session) => session.at),
    cuePractice: cuePractice(scenario),
    rows: sessions.slice(-SUMMARY_SESSION_ROWS).reverse().map(sessionRow),
    olderSessions: Math.max(0, sessions.length - SUMMARY_SESSION_ROWS)
  };
}

export function buildTrainingSummary(data: AppData, now = Date.now()): TrainingSummary {
  const tracks = data.scenarios.map((scenario) => summariseTrack(scenario, now));
  const times = data.scenarios.flatMap((scenario) => scenario.sessions.map((session) => session.at));
  const observation = data.preProtocolObservation;

  return {
    dogName: data.dogName,
    generatedAt: now,
    startingRoute: data.onboarding ? STARTING_ROUTE_LABELS[data.onboarding.startingPath] : null,
    dailyCap: effectiveDailyCap(data),
    totalSessions: times.length,
    firstAt: times.length ? Math.min(...times) : null,
    lastAt: times.length ? Math.max(...times) : null,
    observation: observation
      ? {
          skipped: observation.outcome === "skipped",
          findings: observation.findings.map(findingLabel),
          at: observation.completedAt
        }
      : null,
    tracks
  };
}
