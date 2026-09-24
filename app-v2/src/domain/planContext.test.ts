import { describe, expect, it } from "vitest";
import { monthlyTrend, plateauSuggested, recommendWithJournal } from "./planContext";
import { recommendNext } from "./trainingEngine";
import type { JournalEntry, TrainingSession } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 24, 12);

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: crypto.randomUUID(),
    at: NOW - DAY,
    targetSeconds: 60,
    actualSeconds: 60,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: "",
    ...overrides
  };
}

function absence(outcome: "unknown" | "relaxed" | "concern" | "distressed", at = NOW - DAY / 2): JournalEntry {
  return { type: "real-absence", id: crypto.randomUUID(), at, durationSeconds: 3 * 3600, outcome, note: "" };
}

describe("recommendWithJournal", () => {
  const calm = [session({ at: NOW - 3 * DAY }), session({ at: NOW - 2 * DAY }), session({ at: NOW - DAY })];

  it("matches the plain plan when there is no difficult absence", () => {
    expect(recommendWithJournal(calm, 30, [], NOW)).toEqual(recommendNext(calm, 30, NOW));
    expect(recommendWithJournal(calm, 30, [absence("relaxed"), absence("unknown")], NOW)).toEqual(
      recommendNext(calm, 30, NOW)
    );
  });

  it("holds instead of stepping up after an absence with concern", () => {
    expect(recommendNext(calm, 30, NOW).direction).toBe("increase");
    const result = recommendWithJournal(calm, 30, [absence("concern")], NOW);
    expect(result).toMatchObject({ targetSeconds: 60, direction: "repeat" });
    expect(result.reason).toContain("unavoidable absence");
  });

  it("steps back after a distressing absence and suggests rest", () => {
    const result = recommendWithJournal(calm, 30, [absence("distressed")], NOW);
    expect(result).toMatchObject({ targetSeconds: 54, direction: "reduce", restDayRecommended: true });
  });

  it("ignores absences from before the last session", () => {
    expect(recommendWithJournal(calm, 30, [absence("distressed", NOW - 10 * DAY)], NOW)).toEqual(
      recommendNext(calm, 30, NOW)
    );
  });

  it("never makes a plan harder", () => {
    const hard = [session({ outcome: "distressed", stoppedEarly: true, actualSeconds: 20 })];
    const base = recommendNext(hard, 5, NOW);
    for (const outcome of ["concern", "distressed"] as const) {
      expect(recommendWithJournal(hard, 5, [absence(outcome)], NOW).targetSeconds).toBeLessThanOrEqual(base.targetSeconds);
    }
  });
});

describe("plateauSuggested", () => {
  const spread = (targets: number[], days = 20) =>
    targets.map((targetSeconds, index) =>
      session({ targetSeconds, actualSeconds: targetSeconds, at: NOW - (days - (index * days) / targets.length) * DAY })
    );

  it("needs ten sessions over at least two weeks without net progress", () => {
    expect(plateauSuggested(spread([60, 66, 60, 63, 60, 66, 60, 63, 60, 60]))).toBe(true);
    expect(plateauSuggested(spread([60, 66, 72, 79, 87, 95, 104, 114, 125, 137]))).toBe(false);
    expect(plateauSuggested(spread([60, 60, 60, 60, 60, 60, 60, 60, 60, 60], 5))).toBe(false);
    expect(plateauSuggested(spread([60, 60, 60]))).toBe(false);
  });
});

describe("monthlyTrend", () => {
  it("compares the last 30 days with the 30 before", () => {
    const sessions = [
      session({ at: NOW - 45 * DAY, targetSeconds: 30, actualSeconds: 30 }),
      session({ at: NOW - 40 * DAY, targetSeconds: 33, actualSeconds: 33, outcome: "concern" }),
      session({ at: NOW - 10 * DAY, targetSeconds: 60, actualSeconds: 60 }),
      session({ at: NOW - 2 * DAY, targetSeconds: 66, actualSeconds: 66 })
    ];
    expect(monthlyTrend(sessions, NOW)).toEqual({
      current: { sessions: 2, relaxed: 2, longestRelaxedSeconds: 66 },
      previous: { sessions: 2, relaxed: 1, longestRelaxedSeconds: 30 }
    });
  });

  it("stays quiet without two periods to compare", () => {
    expect(monthlyTrend([session({ at: NOW - 2 * DAY })], NOW)).toBeNull();
  });
});
