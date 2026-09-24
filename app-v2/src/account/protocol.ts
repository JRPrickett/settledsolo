import { z } from "zod";

// SettledSolo's CSP forbids eval. Without jitless mode Zod probes
// `new Function` on first use, which the browser reports as a CSP violation.
z.config({ jitless: true });
import type {
  AppData,
  ObservedSignal,
  Scenario,
  SessionTag,
  TrainingSession,
  JournalEntry,
  LifeEventCategory,
  CoverOption,
  DepartureCueSession,
} from "../domain/types";
import { OBSERVED_SIGNAL_VALUES } from "../domain/observedSignals";
import { SESSION_TAG_VALUES } from "../domain/sessionTags";
import { MAX_DAILY_CAP } from "../domain/dailyCap";
import { COVER_LABELS, LIFE_EVENT_LABELS, MAX_JOURNAL_DURATION_SECONDS } from "../domain/journal";
const id = z.string().min(1).max(100);
const seconds = z.number().int().min(0).max(86400);
const outcome = z.enum(["relaxed", "concern", "distressed"]);
const practiceReview = z.object({
  targetSeconds: seconds.min(1),
  actualSeconds: seconds.min(1),
  outcome,
});
// Derived from the domain lists so a new observed signal or context tag cannot be
// rejected here.
const signalValues = OBSERVED_SIGNAL_VALUES as [ObservedSignal, ...ObservedSignal[]];
const tagValues = SESSION_TAG_VALUES as [SessionTag, ...SessionTag[]];
const profile = z
  .object({
    kind: z.literal("profile"),
    dogId: id,
    dogName: z.string().max(40),
    dailyCap: z.number().int().min(1).max(MAX_DAILY_CAP).optional(),
    onboarding: z
      .object({
        version: z.literal(2),
        startingPath: z.enum([
          "departure-cues",
          "micro-departure",
          "known-duration",
        ]),
        completedAt: z.number().nonnegative(),
      })
      .optional(),
  })
  .strict();
const scenario = z
  .object({
    kind: z.literal("scenario"),
    dogId: id,
    id,
    label: z.string().min(1).max(48),
    startSeconds: seconds.min(1),
    warmupCount: z.number().int().min(0).max(4).optional(),
    restSeconds: seconds.max(3600).optional(),
    shuffleWarmups: z.boolean().optional(),
    cueLevel: z.number().int().min(0).max(7).optional(),
  })
  .strict();
const session = z
  .object({
    kind: z.literal("session"),
    scenarioId: id,
    id,
    at: z.number().nonnegative(),
    targetSeconds: seconds.min(1),
    actualSeconds: seconds,
    outcome,
    stoppedEarly: z.boolean(),
    signals: z
      .array(z.enum(signalValues))
      .max(signalValues.length),
    tags: z
      .array(z.enum(tagValues))
      .max(tagValues.length),
    stopReason: z.string().max(2000),
    note: z.string().max(10000),
    practiceReviews: z.array(practiceReview).max(4).optional(),
    firstSignSeconds: seconds.min(1).optional(),
  })
  .strict();
const cue = z
  .object({
    kind: z.literal("cue"),
    scenarioId: id,
    id,
    at: z.number().nonnegative(),
    cueIndex: z.number().int().min(0).max(7),
    relaxedReps: z.number().int().min(0).max(1000),
    concernReps: z.number().int().min(0).max(1000),
    outcome,
  })
  .strict();
const journalNote = z.string().max(280);
const journalSeconds = z.number().int().min(60).max(MAX_JOURNAL_DURATION_SECONDS);
// Dog-level journal entries: life events, unavoidable absences and planned cover.
const journal = z
  .object({
    kind: z.literal("journal"),
    dogId: id,
    id,
    at: z.number().nonnegative(),
    entry: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("life-event"),
          category: z.enum(Object.keys(LIFE_EVENT_LABELS) as [LifeEventCategory, ...LifeEventCategory[]]),
          note: journalNote,
        })
        .strict(),
      z
        .object({
          type: z.literal("real-absence"),
          durationSeconds: journalSeconds,
          outcome: z.enum(["unknown", "relaxed", "concern", "distressed"]),
          note: journalNote,
        })
        .strict(),
      z
        .object({
          type: z.literal("planned-absence"),
          durationSeconds: journalSeconds,
          cover: z.enum(Object.keys(COVER_LABELS) as [CoverOption, ...CoverOption[]]),
          note: journalNote,
        })
        .strict(),
    ]),
  })
  .strict();
export const valueSchema = z.discriminatedUnion("kind", [
  profile,
  scenario,
  session,
  cue,
  journal,
]);
export type SyncValue = z.infer<typeof valueSchema>;
export const operationSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string().min(1).max(650),
    base: z.number().int().nonnegative(),
    value: valueSchema.nullable(),
  })
  .strict();
export type SyncOperation = z.infer<typeof operationSchema>;
export interface RemoteRecord {
  key: string;
  revision: number;
  value: SyncValue | null;
}
export interface SyncReply {
  accepted: { id: string; revision: number }[];
  conflicts: { id: string; record: RemoteRecord }[];
  changes: RemoteRecord[];
  cursor: number;
  hasMore: boolean;
}
export const syncRequestSchema = z
  .object({
    cursor: z.number().int().nonnegative(),
    operations: z.array(operationSchema).max(50),
  })
  .strict();
export const keyFor = (value: SyncValue): string =>
  value.kind === "profile"
    ? `profile:${encodeURIComponent(value.dogId)}`
    : value.kind === "journal"
      ? `journal:${encodeURIComponent(value.dogId)}:${encodeURIComponent(value.id)}`
    : value.kind === "scenario"
      ? `scenario:${encodeURIComponent(value.id)}`
      : `${value.kind}:${encodeURIComponent(value.scenarioId)}:${encodeURIComponent(value.id)}`;
export function flatten(data: AppData): Record<string, SyncValue> {
  if (!data.dogName) return {};
  const values: SyncValue[] = [
    {
      kind: "profile",
      dogId: "primary",
      dogName: data.dogName,
      dailyCap: data.dailyCap,
      onboarding: data.onboarding,
    },
  ];
  for (const track of data.scenarios) {
    values.push({
      kind: "scenario",
      dogId: "primary",
      id: track.id,
      label: track.label,
      startSeconds: track.startSeconds,
      warmupCount: track.warmupCount,
      restSeconds: track.restSeconds,
      shuffleWarmups: track.shuffleWarmups,
      cueLevel: track.cuePractice?.level,
    });
    values.push(
      ...track.sessions.map((item) => ({
        ...item,
        kind: "session" as const,
        scenarioId: track.id,
      })),
    );
    values.push(
      ...(track.cuePractice?.sessions ?? []).map((item) => ({
        ...item,
        kind: "cue" as const,
        scenarioId: track.id,
      })),
    );
  }
  for (const item of data.journal ?? []) {
    const { id: entryId, at, ...entry } = item;
    values.push({ kind: "journal", dogId: "primary", id: entryId, at, entry });
  }
  return Object.fromEntries(
    values.map((value) => [
      keyFor(value),
      JSON.parse(JSON.stringify(value)) as SyncValue,
    ]),
  );
}
export function inflate(
  values: Record<string, SyncValue>,
  previous: AppData,
): AppData {
  const all = Object.values(values);
  const dog = all.find(
    (value) => value.kind === "profile" && value.dogId === "primary",
  );
  if (!dog || dog.kind !== "profile") return previous;
  const scenarios: Scenario[] = all
    .filter((value) => value.kind === "scenario")
    .map((track) => {
      if (track.kind !== "scenario") throw new Error("Invalid track");
      const sessions = all
        .filter((v) => v.kind === "session" && v.scenarioId === track.id)
        .map((v) => {
          const {
            kind: _kind,
            scenarioId: _track,
            ...record
          } = v as Extract<SyncValue, { kind: "session" }>;
          return record as TrainingSession;
        })
        .sort((a, b) => a.at - b.at);
      const cues = all
        .filter((v) => v.kind === "cue" && v.scenarioId === track.id)
        .map((v) => {
          const {
            kind: _kind,
            scenarioId: _track,
            ...record
          } = v as Extract<SyncValue, { kind: "cue" }>;
          return record as DepartureCueSession;
        })
        .sort((a, b) => a.at - b.at);
      return {
        id: track.id,
        label: track.label,
        startSeconds: track.startSeconds,
        sessions,
        warmupCount: track.warmupCount,
        restSeconds: track.restSeconds,
        shuffleWarmups: track.shuffleWarmups,
        cuePractice:
          track.cueLevel !== undefined || cues.length
            ? { level: track.cueLevel ?? 0, sessions: cues }
            : undefined,
      };
    });
  if (!scenarios.length) return previous; // Wait for a complete profile/track page before replacing the working log.
  const journalEntries = all
    .filter((value) => value.kind === "journal" && value.dogId === "primary")
    .map((value) => {
      const record = value as Extract<SyncValue, { kind: "journal" }>;
      return { id: record.id, at: record.at, ...record.entry } as JournalEntry;
    })
    .sort((a, b) => a.at - b.at);
  return {
    ...previous,
    journal: journalEntries.length ? journalEntries : undefined,
    dogName: dog.dogName,
    dailyCap: dog.dailyCap,
    onboarding: dog.onboarding,
    activeScenarioId: scenarios.some((s) => s.id === previous.activeScenarioId)
      ? previous.activeScenarioId
      : scenarios[0].id,
    scenarios,
  };
}
