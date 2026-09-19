import type {
  AppData,
  DepartureCueSession,
  ObservedSignal,
  Outcome,
  Scenario,
  SessionTag,
  TrainingSession
} from "../domain/types";
import {
  PRE_PROTOCOL_FINDINGS,
  PRE_PROTOCOL_OBSERVATION_VERSION
} from "../domain/preProtocolObservation";
import { readLegacyAppData } from "./legacyImport";
import { SESSION_TAG_VALUES } from "../domain/sessionTags";

const outcomes: Outcome[] = ["relaxed", "concern", "distressed"];
const signals: ObservedSignal[] = [
  "exit-watching",
  "pacing",
  "panting",
  "whining",
  "barking-howling",
  "unable-to-settle"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanOnboarding(value: unknown): AppData["onboarding"] {
  if (!isRecord(value) || value.version !== 2) return undefined;

  const startingPath = String(value.startingPath || "");
  if (
    startingPath !== "departure-cues" &&
    startingPath !== "micro-departure" &&
    startingPath !== "known-duration"
  ) {
    return undefined;
  }

  return {
    version: 2,
    startingPath,
    completedAt: Math.max(0, finiteNumber(value.completedAt, Date.now()))
  };
}

function cleanPreProtocol(
  value: unknown
): AppData["preProtocolObservation"] {
  if (!isRecord(value) || value.version !== PRE_PROTOCOL_OBSERVATION_VERSION)
    return undefined;
  if (value.outcome !== "observed" && value.outcome !== "skipped")
    return undefined;

  const findings = Array.isArray(value.findings) ? value.findings : [];
  return {
    version: PRE_PROTOCOL_OBSERVATION_VERSION,
    outcome: value.outcome,
    findings:
      value.outcome === "observed"
        ? PRE_PROTOCOL_FINDINGS.filter((finding) => findings.includes(finding))
        : [],
    completedAt: Math.max(0, finiteNumber(value.completedAt, Date.now()))
  };
}

function cleanOutcome(value: unknown): Outcome {
  return outcomes.includes(value as Outcome)
    ? (value as Outcome)
    : "distressed";
}

function cleanSignals(value: unknown): ObservedSignal[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter((item): item is ObservedSignal =>
      signals.includes(item as ObservedSignal)
    )
  )];
}

function cleanTags(value: unknown): SessionTag[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter((item): item is SessionTag =>
      SESSION_TAG_VALUES.includes(item as SessionTag)
    )
  )];
}

function cleanSession(value: unknown, index: number): TrainingSession | null {
  if (!isRecord(value)) return null;

  return {
    id: String(value.id || `imported-session-${index + 1}`).slice(0, 100),
    at: Math.max(0, finiteNumber(value.at, Date.now())),
    targetSeconds: Math.max(
      1,
      Math.round(finiteNumber(value.targetSeconds, 1))
    ),
    actualSeconds: Math.max(
      1,
      Math.round(finiteNumber(value.actualSeconds, 1))
    ),
    outcome: cleanOutcome(value.outcome),
    stoppedEarly: Boolean(value.stoppedEarly),
    signals: cleanSignals(value.signals),
    tags: cleanTags(value.tags),
    stopReason: String(value.stopReason || "").slice(0, 80),
    note: String(value.note || "").slice(0, 2000)
  };
}

function cleanCueSession(
  value: unknown,
  index: number
): DepartureCueSession | null {
  if (!isRecord(value)) return null;

  return {
    id: String(value.id || `imported-cue-${index + 1}`).slice(0, 100),
    at: Math.max(0, finiteNumber(value.at, Date.now())),
    cueIndex: Math.max(
      0,
      Math.min(7, Math.round(finiteNumber(value.cueIndex, 0)))
    ),
    relaxedReps: Math.max(
      0,
      Math.min(3, Math.round(finiteNumber(value.relaxedReps, 0)))
    ),
    concernReps: Math.max(
      0,
      Math.min(3, Math.round(finiteNumber(value.concernReps, 0)))
    ),
    outcome: cleanOutcome(value.outcome)
  };
}

function cleanScenario(
  value: unknown,
  index: number,
  usedIds: Set<string>
): Scenario | null {
  if (!isRecord(value)) return null;

  let id = String(value.id || `imported-scenario-${index + 1}`)
    .trim()
    .slice(0, 100);
  if (!id) id = `imported-scenario-${index + 1}`;
  const base = id;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);

  const rawSessions = Array.isArray(value.sessions) ? value.sessions : [];
  const sessions = rawSessions
    .map(cleanSession)
    .filter((session): session is TrainingSession => session !== null);

  const rawCue = isRecord(value.cuePractice) ? value.cuePractice : null;
  const rawCueSessions = Array.isArray(rawCue?.sessions)
    ? rawCue.sessions
    : [];
  const cueSessions = rawCueSessions
    .map(cleanCueSession)
    .filter((session): session is DepartureCueSession => session !== null);

  return {
    id,
    label:
      String(value.label || `Training track ${index + 1}`)
        .trim()
        .slice(0, 48) || `Training track ${index + 1}`,
    startSeconds: Math.max(
      1,
      Math.min(7200, Math.round(finiteNumber(value.startSeconds, 5)))
    ),
    sessions,
    cuePractice: rawCue
      ? {
          level: Math.max(
            0,
            Math.min(7, Math.round(finiteNumber(rawCue.level, 0)))
          ),
          sessions: cueSessions
        }
      : undefined,
    warmupCount:
      value.warmupCount == null
        ? undefined
        : Math.max(0, Math.min(4, Math.round(finiteNumber(value.warmupCount, 2)))),
    shuffleWarmups:
      value.shuffleWarmups == null ? undefined : Boolean(value.shuffleWarmups),
    restSeconds:
      value.restSeconds == null
        ? undefined
        : Math.max(0, Math.min(3600, Math.round(finiteNumber(value.restSeconds, 60))))
  };
}

export function sanitiseImportedAppData(value: unknown): AppData {
  if (!isRecord(value)) {
    throw new Error("Backup does not contain app data.");
  }

  const rawScenarios = Array.isArray(value.scenarios) ? value.scenarios : [];
  const usedIds = new Set<string>();
  const scenarios = rawScenarios
    .map((scenario, index) => cleanScenario(scenario, index, usedIds))
    .filter((scenario): scenario is Scenario => scenario !== null);

  if (!scenarios.length) {
    throw new Error("Backup does not contain any training tracks.");
  }

  const requested = String(value.activeScenarioId || "");
  const activeScenarioId = scenarios.some((scenario) => scenario.id === requested)
    ? requested
    : scenarios[0].id;

  return {
    dogName: String(value.dogName || "").trim().slice(0, 40),
    onboarding: cleanOnboarding(value.onboarding),
    preProtocolObservation: cleanPreProtocol(value.preProtocolObservation),
    activeScenarioId,
    scenarios,
    dailyCap:
      value.dailyCap == null
        ? undefined
        : Math.max(1, Math.min(10, Math.round(finiteNumber(value.dailyCap, 2))))
  };
}

export function parseBackupText(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("This file is not a recognised backup.");
  }

  if (parsed.schemaVersion === 1 && "appData" in parsed) {
    return sanitiseImportedAppData(parsed.appData);
  }

  if (Array.isArray(parsed.scenarios)) {
    if ("activeScenarioId" in parsed) {
      return sanitiseImportedAppData(parsed);
    }

    const legacy = readLegacyAppData({
      getItem: () => text
    });
    return sanitiseImportedAppData(legacy);
  }

  throw new Error("This file is not a recognised SettledSolo backup.");
}

export interface BackupSummary {
  dogName: string;
  scenarios: number;
  sessions: number;
  cueSets: number;
}

export function backupSummary(data: AppData): BackupSummary {
  return {
    dogName: data.dogName || "Unnamed dog",
    scenarios: data.scenarios.length,
    sessions: data.scenarios.reduce(
      (total, scenario) => total + scenario.sessions.length,
      0
    ),
    cueSets: data.scenarios.reduce(
      (total, scenario) =>
        total + (scenario.cuePractice?.sessions.length ?? 0),
      0
    )
  };
}
