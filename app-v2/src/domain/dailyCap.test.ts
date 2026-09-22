import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_CAP,
  MAX_DAILY_CAP,
  clampDailyCap,
  isDailyCapReached,
  sessionsToday
} from "./dailyCap";
import type { AppData, Scenario, TrainingSession } from "./types";

function session(at: number): TrainingSession {
  return {
    id: crypto.randomUUID(),
    at,
    targetSeconds: 30,
    actualSeconds: 30,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: ""
  };
}

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "training",
    label: "Separation training",
    startSeconds: 5,
    sessions: [],
    ...overrides
  };
}

function appData(scenarios: Scenario[]): AppData {
  return {
    dogName: "Biscuit",
    activeScenarioId: scenarios[0]?.id ?? "training",
    scenarios
  };
}

describe("sessionsToday", () => {
  it("counts only sessions from today, across every training track", () => {
    const now = new Date("2026-06-15T14:00:00").getTime();
    const yesterday = new Date("2026-06-14T09:00:00").getTime();
    const earlierToday = new Date("2026-06-15T07:00:00").getTime();

    const data = appData([
      scenario({ id: "a", sessions: [session(yesterday), session(earlierToday)] }),
      scenario({ id: "b", sessions: [session(earlierToday)] })
    ]);

    expect(sessionsToday(data, now)).toBe(2);
  });
});

describe("isDailyCapReached", () => {
  it("is not reached with no sessions today", () => {
    const data = appData([scenario()]);
    expect(isDailyCapReached(data)).toBe(false);
  });

  it("is reached once the default cap of two is met", () => {
    const now = Date.now();
    const data = appData([scenario({ sessions: [session(now), session(now)] })]);
    expect(isDailyCapReached(data)).toBe(true);
    expect(sessionsToday(data, now)).toBe(DEFAULT_DAILY_CAP);
  });

  it("respects a custom cap", () => {
    const now = Date.now();
    const data = appData([scenario({ sessions: [session(now)] })]);
    expect(isDailyCapReached(data, 1, now)).toBe(true);
  });

  it("keeps custom caps inside the supported product range", () => {
    expect(clampDailyCap(0)).toBe(1);
    expect(clampDailyCap(MAX_DAILY_CAP + 10)).toBe(MAX_DAILY_CAP);
    expect(clampDailyCap(Number.NaN)).toBe(DEFAULT_DAILY_CAP);
  });
});
