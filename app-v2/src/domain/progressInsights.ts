import type { ObservedSignal, TrainingSession } from "./types";
import { creditedSeconds } from "./trainingEngine";

export interface SignalCount {
  signal: ObservedSignal;
  count: number;
}

export interface ProgressInsights {
  longestRelaxedSeconds: number;
  recentTotal: number;
  recentRelaxed: number;
  concernOrDistress: number;
  signals: SignalCount[];
}

export function progressInsights(
  sessions: TrainingSession[],
  windowSize = 10
): ProgressInsights {
  const relaxed = sessions.filter((session) => session.outcome === "relaxed");
  const longestRelaxedSeconds = relaxed.reduce(
    (best, session) => Math.max(best, creditedSeconds(session)),
    0
  );

  const recent = sessions.slice(-Math.max(1, windowSize));
  const recentRelaxed = recent.filter(
    (session) => session.outcome === "relaxed"
  ).length;
  const concernOrDistress = recent.length - recentRelaxed;

  const counts = new Map<ObservedSignal, number>();
  for (const session of recent) {
    for (const signal of new Set(session.signals)) {
      counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }

  const signals = [...counts.entries()]
    .map(([signal, count]) => ({ signal, count }))
    .sort((a, b) => b.count - a.count || a.signal.localeCompare(b.signal));

  return {
    longestRelaxedSeconds,
    recentTotal: recent.length,
    recentRelaxed,
    concernOrDistress,
    signals
  };
}
