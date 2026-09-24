import { describe, expect, it } from "vitest";
import { buildTrainingSummary, SUMMARY_SESSION_ROWS } from "./trainingSummary";
import type { AppData, TrainingSession } from "../domain/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 23, 12);

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

function data(sessions: TrainingSession[], extra: Partial<AppData> = {}): AppData {
  return {
    dogName: "Mabel",
    activeScenarioId: "home",
    onboarding: { version: 2, startingPath: "known-duration", completedAt: NOW - 30 * DAY },
    scenarios: [{ id: "home", label: "Home alone", startSeconds: 45, sessions }],
    ...extra
  };
}

describe("buildTrainingSummary", () => {
  it("summarises outcomes, signs, context and the next plan per track", () => {
    const summary = buildTrainingSummary(
      data([
        session({ at: NOW - 5 * DAY, targetSeconds: 45, actualSeconds: 45 }),
        session({ at: NOW - 4 * DAY, targetSeconds: 50, actualSeconds: 50, tags: ["food-left", "morning"] }),
        session({
          at: NOW - 3 * DAY,
          targetSeconds: 55,
          actualSeconds: 30,
          outcome: "concern",
          stoppedEarly: true,
          signals: ["whining", "pacing"],
          tags: ["food-left"],
          stopReason: "  Whined at the door  ",
          note: "Neighbour's drill started"
        }),
        session({ at: NOW - DAY, targetSeconds: 27, actualSeconds: 27, signals: ["whining"] })
      ]),
      NOW
    );

    expect(summary).toMatchObject({
      dogName: "Mabel",
      generatedAt: NOW,
      startingRoute: "From a comfortable absence the owner had already seen",
      dailyCap: 2,
      totalSessions: 4,
      firstAt: NOW - 5 * DAY,
      lastAt: NOW - DAY,
      observation: null
    });

    const [track] = summary.tracks;
    expect(track).toMatchObject({
      label: "Home alone",
      startSeconds: 45,
      sessionCount: 4,
      outcomes: { relaxed: 3, concern: 1, distressed: 0 },
      recentTotal: 4,
      recentRelaxed: 3,
      longestRelaxedSeconds: 50,
      highRiskDates: [],
      cuePractice: null,
      olderSessions: 0
    });
    expect(track.signals).toEqual([
      { label: "Whining", count: 2 },
      { label: "Pacing", count: 1 }
    ]);
    expect(track.tags).toEqual([
      { label: "Food or chew left", count: 2 },
      { label: "Morning", count: 1 }
    ]);
    // Most recent first, with readable labels and trimmed owner text.
    expect(track.rows[0]).toMatchObject({ targetSeconds: 27, signals: ["Whining"] });
    expect(track.rows[1]).toMatchObject({
      outcome: "concern",
      stoppedEarly: true,
      stopReason: "Whined at the door",
      note: "Neighbour's drill started",
      tags: ["Food or chew left"]
    });
    // The next plan comes from the same engine as Today.
    expect(track.next).toMatchObject({ targetSeconds: 27, direction: "Repeat", paused: false });
  });

  it("flags a high-risk sign and a paused plan", () => {
    const summary = buildTrainingSummary(
      data([
        session({ at: NOW - 2 * DAY }),
        session({ at: NOW - DAY, outcome: "distressed", signals: ["escape-attempt"], stoppedEarly: true, actualSeconds: 20 })
      ]),
      NOW
    );
    const [track] = summary.tracks;
    expect(track.highRiskDates).toEqual([NOW - DAY]);
    expect(track.rows[0].highRisk).toBe(true);
    expect(track.next).toMatchObject({ paused: true, vetSuggested: true });
  });

  it("lists the most recent sessions and counts the older ones", () => {
    const many = Array.from({ length: SUMMARY_SESSION_ROWS + 5 }, (_, index) =>
      session({ id: `s${index}`, at: NOW - (40 - index) * DAY })
    );
    const [track] = buildTrainingSummary(data(many), NOW).tracks;
    expect(track.rows).toHaveLength(SUMMARY_SESSION_ROWS);
    expect(track.rows[0].id).toBe(`s${SUMMARY_SESSION_ROWS + 4}`);
    expect(track.olderSessions).toBe(5);
  });

  it("summarises warm-ups, cue practice and the one-time observation", () => {
    const summary = buildTrainingSummary(
      data(
        [
          session({
            practiceReviews: [
              { targetSeconds: 10, actualSeconds: 10, outcome: "relaxed" },
              { targetSeconds: 20, actualSeconds: 12, outcome: "concern" }
            ]
          })
        ],
        {
          onboarding: { version: 2, startingPath: "micro-departure", completedAt: NOW - 9 * DAY },
          preProtocolObservation: {
            version: 1,
            outcome: "observed",
            findings: ["reacted-to-noises"],
            completedAt: NOW - 8 * DAY
          }
        }
      ),
      NOW
    );
    expect(summary.startingRoute).toBe("Very brief first departure (no known comfortable absence)");
    expect(summary.observation).toEqual({
      skipped: false,
      findings: ["They reacted to noises outside rather than to my absence"],
      at: NOW - 8 * DAY
    });
    expect(summary.tracks[0].rows[0].warmups).toEqual({ total: 2, relaxed: 1 });

    const withCues = buildTrainingSummary(
      {
        ...data([]),
        scenarios: [{
          id: "home",
          label: "Home alone",
          startSeconds: 3,
          sessions: [],
          cuePractice: {
            level: 1,
            sessions: [{ id: "c1", at: NOW - DAY, cueIndex: 1, relaxedReps: 3, concernReps: 0, outcome: "relaxed" }]
          }
        }]
      },
      NOW
    );
    expect(withCues.tracks[0]).toMatchObject({
      sessionCount: 0,
      next: null,
      cuePractice: {
        currentCue: "Stand near the exit for a moment, then move away",
        sets: 1,
        lastOutcome: "relaxed",
        lastAt: NOW - DAY
      }
    });
    expect(withCues.firstAt).toBeNull();
  });
});
