import type { SyncValue } from "./protocol";
import { DEPARTURE_CUES } from "../domain/departureCues";
import { observedSignalLabel } from "../domain/observedSignals";
import { formatDuration } from "../domain/trainingEngine";
import { COVER_LABELS, LIFE_EVENT_LABELS, REAL_ABSENCE_OUTCOME_LABELS } from "../domain/journal";
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
  cue: "Departure cue practice",
  journal: "Journal entry"
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
  if (value.kind === "session" || value.kind === "cue" || value.kind === "journal") {
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
    case "journal": {
      const entry = value.entry;
      const lines =
        entry.type === "life-event"
          ? [`Life event: ${LIFE_EVENT_LABELS[entry.category]}`]
          : entry.type === "real-absence"
            ? [`Unavoidable absence: ${formatDuration(entry.durationSeconds)} · ${REAL_ABSENCE_OUTCOME_LABELS[entry.outcome]}`]
            : [`Planned absence: ${formatDuration(entry.durationSeconds)} · ${COVER_LABELS[entry.cover]}`];
      return [...lines, ...(entry.note ? [`Note: ${entry.note}`] : [])];
    }
    case "cue":
      return [
        `Cue: ${DEPARTURE_CUES[value.cueIndex] ?? `level ${value.cueIndex + 1}`}`,
        `${value.relaxedReps} relaxed · ${value.concernReps} concerned · ${OUTCOME_LABEL[value.outcome]}`
      ];
  }
}
