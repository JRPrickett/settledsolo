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

  it("does not recommend a rest day for an isolated distressed session", () => {
    const result = recommendNext(
      [session(), session(), session({ outcome: "distressed" })],
      5
    );
    expect(result.supportFlag).toBe(false);
    expect(result.restDayRecommended).toBe(false);
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

  it("alternates practice order so the sequence isn't always the same shape", () => {
    const evenSeed = buildPracticeDepartures(120, 0);
    const oddSeed = buildPracticeDepartures(120, 1);
    expect(oddSeed).not.toEqual(evenSeed);
    expect([...oddSeed].sort((a, b) => a - b)).toEqual(
      [...evenSeed].sort((a, b) => a - b)
    );
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

  it("rotates practice order for counts above two", () => {
    const seedZero = buildPracticeDepartures(300, 0, 3, true);
    const seedOne = buildPracticeDepartures(300, 1, 3, true);
    expect(seedOne).toEqual([...seedZero.slice(1), seedZero[0]]);
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
