import type { SyncValue } from "./protocol";
import { DEPARTURE_CUES } from "../domain/departureCues";
import { observedSignalLabel } from "../domain/observedSignals";
import { formatDuration } from "../domain/trainingEngine";
import type { Outcome } from "../domain/types";

const OUTCOME_LABEL: Record<Outcome, string> = {
  relaxed: "Relaxed",
  concern: "Some concern",
  distressed: "Distressed"
};

const KIND_LABEL: Record<SyncValue["kind"], string> = {
  profile: "Dog profile",
  scenario: "Training track",
  session: "Timed session",
  cue: "Departure cue practice"
};

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** What kind of record a conflict is about, from whichever version still exists. */
export function conflictTitle(local: SyncValue | null, remote: SyncValue | null): string {
  const value = local ?? remote;
  if (!value) return "A deleted record";
  if (value.kind === "session" || value.kind === "cue") {
    return `${KIND_LABEL[value.kind]} from ${when(value.at)}`;
  }
  return KIND_LABEL[value.kind];
}

/** Plain-language lines an owner can compare, instead of raw sync JSON. */
export function describeSyncValue(value: SyncValue | null): string[] {
  if (!value) return ["Deleted"];
  switch (value.kind) {
    case "profile":
      return [
        `Dog name: ${value.dogName || "not set"}`,
        ...(value.dailyCap ? [`Timed sessions per day: ${value.dailyCap}`] : [])
      ];
    case "scenario":
      return [
        `Name: ${value.label}`,
        `Starting comfort: ${formatDuration(value.startSeconds)}`,
        ...(value.warmupCount !== undefined ? [`Practice departures: ${value.warmupCount}`] : [])
      ];
    case "session":
      return [
        `${formatDuration(value.actualSeconds)} of ${formatDuration(value.targetSeconds)} · ${OUTCOME_LABEL[value.outcome]}${value.stoppedEarly ? " · returned early" : ""}`,
        ...(value.signals.length
          ? [`Signs: ${value.signals.map(observedSignalLabel).join(", ")}`]
          : []),
        ...(value.stopReason ? [`Why early: ${value.stopReason}`] : []),
        ...(value.note ? [`Note: ${value.note}`] : [])
      ];
    case "cue":
      return [
        `Cue: ${DEPARTURE_CUES[value.cueIndex] ?? `level ${value.cueIndex + 1}`}`,
        `${value.relaxedReps} relaxed · ${value.concernReps} concerned · ${OUTCOME_LABEL[value.outcome]}`
      ];
  }
}
