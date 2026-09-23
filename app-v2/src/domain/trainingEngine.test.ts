import { describe, expect, it } from "vitest";
import { buildPracticeDepartures, recommendNext, stepSize } from "./trainingEngine";
import type { TrainingSession } from "./types";

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    targetSeconds: 30,
    actualSeconds: 30,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: "",
    ...overrides
  };
}

describe("recommendNext", () => {
  it("starts from a known comfortable duration", () => {
    expect(recommendNext([], 5)).toMatchObject({
      targetSeconds: 5,
      direction: "start"
    });
  });

  it("repeats after the first relaxed session", () => {
    expect(recommendNext([session()], 5)).toMatchObject({
      targetSeconds: 30,
      direction: "repeat"
    });
  });

  it("uses a small absolute increase after consecutive relaxed sessions", () => {
    expect(recommendNext([session(), session()], 5)).toMatchObject({
      targetSeconds: 33,
      direction: "increase"
    });
  });

  it("stays below the observed distress point even if an older relaxed session was longer", () => {
    const result = recommendNext(
      [
        session({ targetSeconds: 24, actualSeconds: 24 }),
        session({
          targetSeconds: 30,
          actualSeconds: 18,
          outcome: "distressed",
          stoppedEarly: true
        })
      ],
      5
    );
    expect(result.targetSeconds).toBe(16);
    expect(result.direction).toBe("reduce");
  });

  it("stays below an early concern point instead of returning to a longer old anchor", () => {
    const result = recommendNext(
      [
        session({ targetSeconds: 25, actualSeconds: 25 }),
        session({
          targetSeconds: 30,
          actualSeconds: 12,
          outcome: "concern",
          stoppedEarly: true
        })
      ],
      5
    );
    expect(result.targetSeconds).toBe(10);
    expect(result.direction).toBe("reduce");
  });

  it("returns to configured start if distress occurs before any relaxed anchor", () => {
    const result = recommendNext(
      [
        session({
          targetSeconds: 20,
          actualSeconds: 8,
          outcome: "distressed",
          stoppedEarly: true
        })
      ],
      4
    );
    expect(result.targetSeconds).toBe(7);
  });

  it("treats an early relaxed return as a comfortable anchor", () => {
    const result = recommendNext(
      [
        session({
          targetSeconds: 30,
          actualSeconds: 19,
          stoppedEarly: true
        })
      ],
      5
    );
    expect(result.targetSeconds).toBe(19);
    expect(result.direction).toBe("repeat");
  });

  it("flags repeated difficult sessions for support", () => {
    const result = recommendNext(
      [
        session({ outcome: "concern" }),
        session({ outcome: "distressed" }),
        session({ outcome: "concern" })
      ],
      5
    );
    expect(result.supportFlag).toBe(true);
    expect(result.restDayRecommended).toBe(false);
  });

  it("recommends a rest day when distress lands on top of a difficult pattern", () => {
    const result = recommendNext(
      [
        session({ outcome: "concern" }),
        session({ outcome: "distressed" }),
        session({ outcome: "distressed" })
      ],
      5
    );
    expect(result.supportFlag).toBe(true);
    expect(result.restDayRecommended).toBe(true);
  });

  it("recommends a rest day after an isolated distressed session", () => {
    const result = recommendNext(
      [session(), session(), session({ outcome: "distressed" })],
      5
    );
    expect(result.supportFlag).toBe(false);
    expect(result.restDayRecommended).toBe(true);
  });

  it("pauses timed training after a high-risk observation", () => {
    const result = recommendNext(
      [session({ outcome: "distressed", signals: ["escape-attempt"] })],
      5
    );
    expect(result.highRiskFlag).toBe(true);
    expect(result.referralSuggested).toBe(true);
    expect(result.direction).toBe("reduce");
  });
});

describe("stepSize", () => {
  it.each([
    [5, 1],
    [20, 2],
    [45, 3],
    [90, 5],
    [240, 10],
    [480, 15],
    [1200, 30],
    [2400, 60]
  ])("uses transparent tiered increments for %i seconds", (seconds, expected) => {
    expect(stepSize(seconds)).toBe(expected);
  });
});

describe("buildPracticeDepartures", () => {
  it("does not add practice departures for very short targets", () => {
    expect(buildPracticeDepartures(6)).toEqual([]);
  });

  it("keeps practice departures shorter than the main target", () => {
    const practice = buildPracticeDepartures(120);
    expect(practice.length).toBeGreaterThan(0);
    expect(practice.every((seconds) => seconds < 120)).toBe(true);
  });

  it("uses a seed to create deterministic but different warm-up durations", () => {
    const first = buildPracticeDepartures(120, 1);
    const sameSeed = buildPracticeDepartures(120, 1);
    const second = buildPracticeDepartures(120, 2);

    expect(sameSeed).toEqual(first);
    expect(second).not.toEqual(first);
    expect([...second].sort((a, b) => a - b)).toEqual(
      [...first].sort((a, b) => a - b)
    );
    expect(new Set(first).size).toBe(first.length);
    expect(new Set(second).size).toBe(second.length);
  });

  it("respects a configured warm-up count", () => {
    expect(buildPracticeDepartures(120, 0, 0)).toEqual([]);
    expect(buildPracticeDepartures(120, 0, 1)).toHaveLength(1);
    expect(buildPracticeDepartures(120, 0, 3)).toHaveLength(3);
  });

  it("keeps every practice departure shorter than the target at any count", () => {
    const practice = buildPracticeDepartures(300, 2, 3);
    expect(practice).toHaveLength(3);
    expect(practice.every((seconds) => seconds > 0 && seconds < 300)).toBe(true);
    expect(new Set(practice).size).toBe(practice.length);
  });

  it("defaults to four warm-ups for short targets and two for longer targets", () => {
    expect(buildPracticeDepartures(599, 0)).toHaveLength(4);
    expect(buildPracticeDepartures(600, 0)).toHaveLength(2);
  });

  it("caps warm-ups at one minute and half the target below two minutes", () => {
    const short = buildPracticeDepartures(119, 0);
    const longer = buildPracticeDepartures(599, 0);

    expect(short.every((seconds) => seconds <= Math.floor(119 / 2))).toBe(true);
    expect(longer.every((seconds) => seconds <= 60)).toBe(true);
  });

  it("keeps warm-ups in ascending order when shuffle is disabled", () => {
    const practice = buildPracticeDepartures(300, 3, 4, false);
    expect(practice).toEqual([...practice].sort((a, b) => a - b));
  });

  it("keeps every shuffled duration within the brief safety bounds", () => {
    const practice = buildPracticeDepartures(119, 1234, 4, true);
    expect(practice).toHaveLength(4);
    expect(practice.every((seconds) => seconds >= 2 && seconds <= 59)).toBe(true);
  });
});

describe("persistent-difficulty referral", () => {
  /** Ten sessions with a fixed target, so progress is stalled by construction. */
  function stalled(outcomes: TrainingSession["outcome"][]): TrainingSession[] {
    return outcomes.map((outcome) =>
      session({ outcome, targetSeconds: 30, actualSeconds: 30 })
    );
  }

  const persistent: TrainingSession["outcome"][] = [
    "distressed",
    "concern",
    "distressed",
    "concern",
    "relaxed",
    "concern",
    "distressed",
    "relaxed",
    "concern",
    "concern"
  ];

  it("is not raised before there is enough history to judge", () => {
    expect(
      recommendNext(stalled(persistent).slice(0, 9), 30).referralSuggested
    ).toBe(false);
  });

  it("is raised once difficulty persists without progress", () => {
    expect(recommendNext(stalled(persistent), 30).referralSuggested).toBe(true);
  });

  it("is not raised on a bad patch that the plan is still moving past", () => {
    const progressing = stalled(persistent).map((item, index) =>
      // The target climbs across the window, so training is still working.
      ({ ...item, targetSeconds: 10 + index * 5 })
    );
    expect(recommendNext(progressing, 10).referralSuggested).toBe(false);
  });

  it("is not raised when difficulty is mild, however long it lasts", () => {
    const mild = stalled([
      "concern",
      "relaxed",
      "concern",
      "relaxed",
      "concern",
      "relaxed",
      "concern",
      "relaxed",
      "concern",
      "relaxed"
    ]);
    expect(recommendNext(mild, 30).referralSuggested).toBe(false);
  });

  it("sets a higher bar than the existing support flag", () => {
    const recentlyHard = stalled([
      "relaxed",
      "relaxed",
      "relaxed",
      "relaxed",
      "relaxed",
      "relaxed",
      "relaxed",
      "distressed",
      "distressed",
      "concern"
    ]);
    const recommendation = recommendNext(recentlyHard, 30);
    expect(recommendation.supportFlag).toBe(true);
    expect(recommendation.referralSuggested).toBe(false);
  });

  it("never raises difficulty when it fires", () => {
    const recommendation = recommendNext(stalled(persistent), 30);
    expect(recommendation.direction).not.toBe("increase");
  });
});

describe("stress signs hold the plan", () => {
  it("does not increase after a relaxed rating with stress signs noted", () => {
    const result = recommendNext(
      [session(), session(), session({ signals: ["whining", "exit-watching"] })],
      5
    );
    expect(result).toMatchObject({ targetSeconds: 30, direction: "repeat" });
    expect(result.reason).toContain("whining");
  });

  it("needs two clean relaxed sessions after one with signs before increasing", () => {
    const history = [session(), session(), session({ signals: ["pacing"] })];
    expect(recommendNext([...history, session()], 5).direction).toBe("repeat");
    expect(recommendNext([...history, session(), session()], 5)).toMatchObject({
      targetSeconds: 33,
      direction: "increase"
    });
  });
});

describe("returning after a long break", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 8, 23, 12);

  it("restarts one step easier after a week or more without a timed session", () => {
    const history = [session({ at: now - 9 * day }), session({ at: now - 8 * day })];
    const result = recommendNext(history, 5, now);
    expect(result).toMatchObject({ targetSeconds: 27, direction: "reduce" });
    expect(result.reason).toContain("8 days");
  });

  it("carries on as normal after a shorter gap", () => {
    const history = [session({ at: now - 7 * day }), session({ at: now - 6 * day })];
    expect(recommendNext(history, 5, now)).toMatchObject({ targetSeconds: 33, direction: "increase" });
  });

  it("never goes below the configured start and never increases after a break", () => {
    const history = [session({ at: now - 30 * day, targetSeconds: 5, actualSeconds: 5 })];
    expect(recommendNext(history, 5, now)).toMatchObject({ targetSeconds: 5, direction: "reduce" });
  });

  it("keeps the stricter concern and distress rules when those came last", () => {
    const history = [
      session({ at: now - 20 * day, targetSeconds: 60, actualSeconds: 60 }),
      session({ at: now - 10 * day, targetSeconds: 60, actualSeconds: 20, outcome: "distressed", stoppedEarly: true })
    ];
    expect(recommendNext(history, 5, now)).toMatchObject({ targetSeconds: 18, direction: "reduce" });
  });
});
