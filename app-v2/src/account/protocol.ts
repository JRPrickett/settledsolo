import { z } from "zod";
import type {
  AppData,
  ObservedSignal,
  Scenario,
  TrainingSession,
  DepartureCueSession,
} from "../domain/types";
import { OBSERVED_SIGNAL_VALUES } from "../domain/observedSignals";
const id = z.string().min(1).max(100);
const seconds = z.number().int().min(0).max(86400);
const outcome = z.enum(["relaxed", "concern", "distressed"]);
// Derived from the domain list so a new observed signal cannot be rejected here.
const signalValues = OBSERVED_SIGNAL_VALUES as [ObservedSignal, ...ObservedSignal[]];
const profile = z
  .object({
    kind: z.literal("profile"),
    dogId: id,
    dogName: z.string().max(40),
    dailyCap: z.number().int().min(1).max(10).optional(),
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
      .array(
        z.enum([
          "morning",
          "afternoon",
          "evening",
          "not-walked-yet",
          "after-a-walk",
          "before-food",
          "after-food",
          "radio-or-tv-on",
          "crated-confined",
          "free-roam",
        ]),
      )
      .max(10),
    stopReason: z.string().max(2000),
    note: z.string().max(10000),
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
export const valueSchema = z.discriminatedUnion("kind", [
  profile,
  scenario,
  session,
  cue,
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
  return {
    ...previous,
    dogName: dog.dogName,
    dailyCap: dog.dailyCap,
    onboarding: dog.onboarding,
    activeScenarioId: scenarios.some((s) => s.id === previous.activeScenarioId)
      ? previous.activeScenarioId
      : scenarios[0].id,
    scenarios,
  };
}
