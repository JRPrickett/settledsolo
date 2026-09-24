import { describe, expect, it } from "vitest";
import { buildPracticeDepartures, progressionPace, recommendNext, stepSize } from "./trainingEngine";
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
    // One 10% step below the 12-second concern point, not back up to the older 25s anchor.
    expect(result.targetSeconds).toBe(11);
    expect(result.targetSeconds).toBeLessThan(12);
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

describe("regression below the starting duration", () => {
  // An owner who started from a known-comfortable 2 minutes, before the dog regressed.
  const start = 120;

  it("stays below early distress instead of returning to the longer starting duration", () => {
    const result = recommendNext(
      [
        session({ targetSeconds: 120, actualSeconds: 120 }),
        session({ targetSeconds: 95, actualSeconds: 40, outcome: "distressed", stoppedEarly: true })
      ],
      start
    );
    expect(result).toMatchObject({ targetSeconds: 36, direction: "reduce" });
  });

  it("stays below early concern instead of returning to the longer starting duration", () => {
    const result = recommendNext(
      [
        session({ targetSeconds: 120, actualSeconds: 120 }),
        session({ targetSeconds: 120, actualSeconds: 30, outcome: "concern", stoppedEarly: true })
      ],
      start
    );
    expect(result).toMatchObject({ targetSeconds: 27, direction: "reduce" });
  });

  it("steps below the starting duration when it caused distress", () => {
    const result = recommendNext(
      [session({ targetSeconds: 120, actualSeconds: 120, outcome: "distressed" })],
      start
    );
    expect(result).toMatchObject({ targetSeconds: 108, direction: "reduce" });
    expect(result.reason).toContain("even at the starting duration");
  });

  it("steps below the starting duration after concern at it", () => {
    const result = recommendNext(
      [session({ targetSeconds: 120, actualSeconds: 120, outcome: "concern" })],
      start
    );
    expect(result).toMatchObject({ targetSeconds: 108, direction: "reduce" });
  });

  it("keeps following the observed sessions after a regression", () => {
    const afterDistress = [
      session({ targetSeconds: 60, actualSeconds: 30, outcome: "distressed", stoppedEarly: true })
    ];
    // A relaxed early return does not jump back up to the starting duration...
    expect(
      recommendNext([...afterDistress, session({ targetSeconds: 27, actualSeconds: 20, stoppedEarly: true })], start)
    ).toMatchObject({ targetSeconds: 20, direction: "repeat" });

    // ...and nor does a long break.
    const day = 24 * 60 * 60 * 1000;
    const now = Date.UTC(2026, 8, 23, 12);
    expect(
      recommendNext(
        [
          session({ at: now - 20 * day, targetSeconds: 60, actualSeconds: 30, outcome: "distressed", stoppedEarly: true }),
          session({ at: now - 10 * day, targetSeconds: 27, actualSeconds: 27 })
        ],
        start,
        now
      )
    ).toMatchObject({ targetSeconds: 24, direction: "reduce" });
  });

  it("still treats an uncontradicted starting duration as known comfort", () => {
    const result = recommendNext(
      [session({ targetSeconds: 120, actualSeconds: 20, stoppedEarly: true })],
      start
    );
    expect(result).toMatchObject({ targetSeconds: 120, direction: "repeat" });
    expect(result.reason).toContain("starting duration is still a known-comfortable point");
  });

  it("never offers a target at or above where concern or distress was observed", () => {
    const outcomes = ["concern", "distressed"] as const;
    for (const configuredStart of [3, 30, 120, 600]) {
      for (const priorRelaxed of [null, 10, 120, 900]) {
        for (const outcome of outcomes) {
          for (const stoppedEarly of [true, false]) {
            for (const targetSeconds of [2, 5, 45, 120, 300, 1200]) {
              const actualSeconds = stoppedEarly ? Math.max(1, Math.round(targetSeconds / 3)) : targetSeconds;
              const history = [
                ...(priorRelaxed === null ? [] : [session({ targetSeconds: priorRelaxed, actualSeconds: priorRelaxed })]),
                session({ targetSeconds, actualSeconds, outcome, stoppedEarly })
              ];
              const observed = stoppedEarly ? actualSeconds : targetSeconds;
              const { targetSeconds: next } = recommendNext(history, configuredStart);
              expect(next >= 1 && (next < observed || next === 1)).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("stepSize", () => {
  it.each([
    [3, 1],
    [20, 2],
    [45, 5],
    [90, 9],
    [300, 30],
    [600, 60],
    [1200, 120]
  ])("is about a tenth of %i seconds", (seconds, expected) => {
    expect(stepSize(seconds)).toBe(expected);
  });

  it("never drops below one second or exceeds two minutes", () => {
    expect(stepSize(1)).toBe(1);
    expect(stepSize(0)).toBe(1);
    expect(stepSize(3600)).toBe(120);
    expect(stepSize(4 * 3600)).toBe(120);
  });

  it("keeps every step well below dogs' measured duration-discrimination threshold", () => {
    // Cliff & Jackson (2019): dogs needed at least a ~44% difference to discriminate durations.
    for (let seconds = 10; seconds <= 4 * 3600; seconds += 7) {
      expect(stepSize(seconds) / seconds).toBeLessThanOrEqual(0.15);
    }
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
    // The recent signs also make that increase a cautious 5% step (30s -> 32s).
    expect(recommendNext([...history, session(), session()], 5)).toMatchObject({
      targetSeconds: 32,
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

describe("progression pace", () => {
  const clean = (count: number, targetSeconds = 100) =>
    Array.from({ length: count }, () => session({ targetSeconds, actualSeconds: targetSeconds }));

  it("uses the standard 10% step for a short clean run", () => {
    expect(progressionPace(clean(3))).toBe("standard");
    expect(recommendNext(clean(3), 5)).toMatchObject({ targetSeconds: 110, direction: "increase" });
  });

  it("allows a 15% step after five or more clean sessions with no recent struggles", () => {
    expect(progressionPace(clean(5))).toBe("confident");
    const result = recommendNext(clean(5), 5);
    expect(result).toMatchObject({ targetSeconds: 115, direction: "increase" });
    expect(result.reason).toContain("a little bigger");
  });

  it("slows to a 5% step when any of the last ten sessions struggled", () => {
    const history = [session({ targetSeconds: 100, actualSeconds: 100, outcome: "concern" }), ...clean(6)];
    expect(progressionPace(history)).toBe("cautious");
    const result = recommendNext(history, 5);
    expect(result).toMatchObject({ targetSeconds: 105, direction: "increase" });
    expect(result.reason).toContain("smaller than usual");
  });

  it("treats a ticked stress sign as a struggle but a relaxed early return as fine", () => {
    expect(progressionPace([session({ signals: ["panting"] }), ...clean(6)])).toBe("cautious");
    expect(
      progressionPace([session({ actualSeconds: 20, stoppedEarly: true }), ...clean(5)])
    ).toBe("confident");
  });

  it("returns to normal once a struggle is more than ten sessions ago", () => {
    const history = [session({ outcome: "distressed" }), ...clean(10)];
    expect(progressionPace(history)).toBe("confident");
  });

  it("never lets the confident step exceed the two-minute cap", () => {
    expect(recommendNext(clean(6, 3600), 5)).toMatchObject({ targetSeconds: 3720 });
  });

  it("leaves step-downs at the standard size", () => {
    const history = [...clean(6), session({ targetSeconds: 100, actualSeconds: 100, outcome: "concern" })];
    expect(recommendNext(history, 5)).toMatchObject({ targetSeconds: 90, direction: "reduce" });
  });
});
