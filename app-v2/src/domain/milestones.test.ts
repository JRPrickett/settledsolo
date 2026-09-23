import { describe, expect, it } from "vitest";
import {
  MILESTONE_LADDER,
  achievementSnapshot,
  earnedMilestones,
  longestRelaxedSeconds,
  milestoneBoard,
  newlyEarnedAchievements,
  newlyEarnedMilestones
} from "./milestones";
import type { AppData, Scenario, TrainingSession } from "./types";

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  // Most fixtures describe a session that met its target exactly.
  const actualSeconds = overrides.actualSeconds ?? 30;
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    targetSeconds: actualSeconds,
    actualSeconds,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: "",
    ...overrides
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

describe("earnedMilestones", () => {
  it("earns nothing with no sessions", () => {
    const data = appData([scenario()]);
    expect(earnedMilestones(data).size).toBe(0);
  });

  it("credits a relaxed session that reached a rung", () => {
    const data = appData([
      scenario({ sessions: [session({ actualSeconds: 65 })] })
    ]);
    const earned = earnedMilestones(data);
    expect(earned.has(30)).toBe(true);
    expect(earned.has(60)).toBe(true);
    expect(earned.has(120)).toBe(false);
  });

  it("credits a relaxed session even when it stopped before the target", () => {
    const data = appData([
      scenario({
        sessions: [
          session({ targetSeconds: 300, actualSeconds: 65, stoppedEarly: true })
        ]
      })
    ]);
    expect(earnedMilestones(data).has(60)).toBe(true);
  });

  it("does not credit a distressed or concerned session", () => {
    const data = appData([
      scenario({ sessions: [session({ actualSeconds: 65, outcome: "distressed" })] })
    ]);
    expect(earnedMilestones(data).has(30)).toBe(false);
  });

  it("combines credit across every training track for the same dog", () => {
    const data = appData([
      scenario({ id: "a", label: "A", sessions: [session({ actualSeconds: 35 })] }),
      scenario({ id: "b", label: "B", sessions: [session({ actualSeconds: 65 })] })
    ]);
    const earned = earnedMilestones(data);
    expect(earned.has(30)).toBe(true);
    expect(earned.has(60)).toBe(true);
    expect(earned.get(60)?.scenarioLabel).toBe("B");
  });

  it("keeps the earliest date a rung was first reached", () => {
    const earlier = Date.now() - 1000;
    const later = Date.now();
    const data = appData([
      scenario({
        sessions: [
          session({ at: later, actualSeconds: 90 }),
          session({ at: earlier, actualSeconds: 65 })
        ]
      })
    ]);
    expect(earnedMilestones(data).get(60)?.at).toBe(earlier);
  });
});

describe("longestRelaxedSeconds", () => {
  it("ignores non-relaxed sessions", () => {
    const data = appData([
      scenario({
        sessions: [
          session({ actualSeconds: 200, outcome: "distressed" }),
          session({ actualSeconds: 40 })
        ]
      })
    ]);
    expect(longestRelaxedSeconds(data)).toBe(40);
  });
});

describe("milestoneBoard", () => {
  it("reports the next unearned rung and progress toward it", () => {
    const data = appData([scenario({ sessions: [session({ actualSeconds: 45 })] })]);
    const board = milestoneBoard(data);
    expect(board.next).toEqual({ seconds: 60, label: "1 min" });
    expect(board.progressToNext).toBeCloseTo(0.5, 5);
  });

  it("reports no next rung once every milestone is earned", () => {
    const data = appData([
      scenario({
        sessions: [session({ actualSeconds: MILESTONE_LADDER.at(-1)!.seconds })]
      })
    ]);
    expect(milestoneBoard(data).next).toBeNull();
  });
});

describe("newlyEarnedMilestones", () => {
  it("returns only the rungs crossed by the latest save", () => {
    const before = appData([scenario({ sessions: [session({ actualSeconds: 45 })] })]);
    const after = appData([
      scenario({
        sessions: [session({ actualSeconds: 45 }), session({ actualSeconds: 130 })]
      })
    ]);
    const gained = newlyEarnedMilestones(before, after);
    expect(gained.map((m) => m.seconds)).toEqual([60, 120]);
  });
});

describe("achievements", () => {
  it("awards the first-relaxed-session achievement once", () => {
    const before = appData([scenario()]);
    const after = appData([scenario({ sessions: [session()] })]);
    const gained = newlyEarnedAchievements(before, after);
    expect(gained.map((a) => a.id)).toContain("first-relaxed-session");
  });

  it("does not re-award an already-met achievement", () => {
    const sessions = [session(), session()];
    const before = appData([scenario({ sessions: [sessions[0]] })]);
    const after = appData([scenario({ sessions })]);
    const gained = newlyEarnedAchievements(before, after);
    expect(gained.map((a) => a.id)).not.toContain("first-relaxed-session");
  });

  it("breaks the relaxed-in-a-row streak on a concerned session", () => {
    const data = appData([
      scenario({
        sessions: [
          session({ outcome: "concern" }),
          session(),
          session(),
          session()
        ]
      })
    ]);
    expect(achievementSnapshot(data).currentRelaxedRun).toBe(3);
  });
});

describe("target-capped credit", () => {
  it("never earns rungs beyond the target when the owner forgets to return", () => {
    // Target 30s, but the clock ran for 25 minutes before "I'm back".
    const data = appData([scenario({ sessions: [session({ targetSeconds: 30, actualSeconds: 1500 })] })]);
    expect([...earnedMilestones(data).keys()]).toEqual([10, 15, 30]);
    expect(longestRelaxedSeconds(data)).toBe(30);
    expect(achievementSnapshot(data).totalRelaxedSeconds).toBe(30);
    expect(milestoneBoard(data).next?.seconds).toBe(60);
  });

  it("still credits relaxed time when returning early", () => {
    const data = appData([
      scenario({ sessions: [session({ targetSeconds: 90, actualSeconds: 70, stoppedEarly: true })] })
    ]);
    expect([...earnedMilestones(data).keys()]).toEqual([10, 15, 30, 60]);
    expect(longestRelaxedSeconds(data)).toBe(70);
  });

  it("reaches later rungs only as targets progress", () => {
    const data = appData([
      scenario({
        sessions: [
          session({ at: 1, targetSeconds: 30, actualSeconds: 600 }),
          session({ at: 2, targetSeconds: 60, actualSeconds: 600 }),
          session({ at: 3, targetSeconds: 120, actualSeconds: 125 })
        ]
      })
    ]);
    const earned = earnedMilestones(data);
    expect([...earned.keys()]).toEqual([10, 15, 30, 60, 120]);
    expect(earned.get(120)?.at).toBe(3);
    expect(earned.get(120)?.actualSeconds).toBe(120);
  });
});

describe("milestone ladder", () => {
  it("has twenty strictly increasing rungs up to the four-hour limit", () => {
    expect(MILESTONE_LADDER).toHaveLength(20);
    expect(MILESTONE_LADDER[0].seconds).toBe(10);
    expect(MILESTONE_LADDER.at(-1)).toEqual({ seconds: 14400, label: "4 hours" });
    MILESTONE_LADDER.slice(1).forEach((rung, index) => {
      expect(rung.seconds).toBeGreaterThan(MILESTONE_LADDER[index].seconds);
    });
    expect(new Set(MILESTONE_LADDER.map((rung) => rung.label)).size).toBe(20);
  });
});
