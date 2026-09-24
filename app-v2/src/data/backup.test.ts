import { describe, expect, it } from "vitest";
import { backupSummary, parseBackupText } from "./backup";
import { SESSION_TAG_VALUES } from "../domain/sessionTags";

describe("backup restore", () => {
  const envelope = (appData: unknown) =>
    JSON.stringify({
      schemaVersion: 1,
      exportedAt: "2026-09-18T00:00:00.000Z",
      appData: {
        dogName: "Mabel",
        activeScenarioId: "training",
        scenarios: [
          { id: "training", label: "Separation training", startSeconds: 5, sessions: [] }
        ],
        ...(appData as object)
      }
    });

  it("restores every context tag, including food, feeder, noise and someone-home", () => {
    const data = parseBackupText(envelope({
      scenarios: [{
        id: "training",
        label: "Separation training",
        startSeconds: 5,
        sessions: [{
          id: "tagged",
          at: 1,
          targetSeconds: 10,
          actualSeconds: 10,
          outcome: "relaxed",
          stoppedEarly: false,
          signals: [],
          tags: SESSION_TAG_VALUES,
          stopReason: "",
          note: ""
        }]
      }]
    }));

    expect(data.scenarios[0].sessions[0].tags).toEqual(SESSION_TAG_VALUES);
    expect(SESSION_TAG_VALUES).toEqual(
      expect.arrayContaining(["food-left", "remote-feeder", "noise-disturbance", "someone-home"])
    );
  });

  it("restores the journal and marked first signs", () => {
    const data = parseBackupText(envelope({
      journal: [
        { type: "life-event", id: "e1", at: 5, category: "medication-change", note: "Started as prescribed" },
        { type: "real-absence", id: "e2", at: 6, durationSeconds: 3600, outcome: "distressed", note: "" },
        { type: "nonsense", id: "e3", at: 7 }
      ],
      scenarios: [{
        id: "training",
        label: "Separation training",
        startSeconds: 5,
        sessions: [{
          id: "s", at: 1, targetSeconds: 60, actualSeconds: 40, outcome: "concern", stoppedEarly: true,
          signals: [], tags: [], stopReason: "", note: "", firstSignSeconds: 90
        }]
      }]
    }));
    expect(data.journal?.map((entry) => entry.id)).toEqual(["e1", "e2"]);
    // A first sign cannot fall after the owner got back.
    expect(data.scenarios[0].sessions[0].firstSignSeconds).toBe(40);
  });

  it("preserves a recorded pre-protocol observation", () => {
    const data = parseBackupText(
      envelope({
        preProtocolObservation: {
          version: 1,
          outcome: "observed",
          findings: ["reacted-to-noises", "not-a-finding"],
          completedAt: 99
        }
      })
    );

    expect(data.preProtocolObservation).toEqual({
      version: 1,
      outcome: "observed",
      findings: ["reacted-to-noises"],
      completedAt: 99
    });
  });

  it("keeps a skipped observation skipped, without findings", () => {
    const data = parseBackupText(
      envelope({
        preProtocolObservation: {
          version: 1,
          outcome: "skipped",
          findings: ["reacted-to-noises"],
          completedAt: 5
        }
      })
    );

    expect(data.preProtocolObservation?.outcome).toBe("skipped");
    expect(data.preProtocolObservation?.findings).toEqual([]);
  });

  it("drops an unknown observation version rather than trusting it", () => {
    const data = parseBackupText(
      envelope({
        preProtocolObservation: { version: 99, outcome: "observed", findings: [] }
      })
    );

    expect(data.preProtocolObservation).toBeUndefined();
  });

  it("accepts the production backup envelope", () => {
    const data = parseBackupText(JSON.stringify({
      schemaVersion: 1,
      exportedAt: "2026-09-18T00:00:00.000Z",
      appData: {
        dogName: "Mabel",
        onboarding: {
          version: 2,
          startingPath: "known-duration",
          completedAt: 12345
        },
        activeScenarioId: "training",
        scenarios: [{
          id: "training",
          label: "Separation training",
          startSeconds: 5,
          sessions: [{
            id: "s1",
            at: 1,
            targetSeconds: 10,
            actualSeconds: 10,
            outcome: "relaxed",
            stoppedEarly: false,
            signals: ["pacing", "invalid"],
            tags: ["after-a-walk", "invalid-tag"],
            stopReason: "doorbell rang",
            note: "calm",
            practiceReviews: [
              { targetSeconds: 5, actualSeconds: 5, outcome: "relaxed" },
              { targetSeconds: 10, actualSeconds: 7, outcome: "concern" }
            ]
          }],
          warmupCount: 1,
          shuffleWarmups: false,
          restSeconds: 45
        }],
        dailyCap: 3
      }
    }));

    expect(data.dogName).toBe("Mabel");
    expect(data.onboarding).toEqual({
      version: 2,
      startingPath: "known-duration",
      completedAt: 12345
    });
    expect(data.scenarios[0].sessions[0].signals).toEqual(["pacing"]);
    expect(data.scenarios[0].sessions[0].practiceReviews).toEqual([
      { targetSeconds: 5, actualSeconds: 5, outcome: "relaxed" },
      { targetSeconds: 10, actualSeconds: 7, outcome: "concern" }
    ]);
    expect(
      parseBackupText(
        JSON.stringify({
          schemaVersion: 1,
          appData: {
            dogName: "Mabel",
            activeScenarioId: "training",
            scenarios: [
              {
                id: "training",
                label: "Separation training",
                startSeconds: 5,
                sessions: [
                  {
                    id: "s2",
                    at: 1,
                    targetSeconds: 10,
                    actualSeconds: 10,
                    outcome: "concern",
                    stoppedEarly: false,
                    signals: ["food-refusal", "invalid"],
                    tags: [],
                    stopReason: "",
                    note: ""
                  }
                ]
              }
            ]
          }
        })
      ).scenarios[0].sessions[0].signals
    ).toEqual(["food-refusal"]);
    expect(data.scenarios[0].sessions[0].tags).toEqual(["after-a-walk"]);
    expect(data.scenarios[0].sessions[0].stopReason).toBe("doorbell rang");
    expect(data.scenarios[0].warmupCount).toBe(1);
    expect(data.scenarios[0].shuffleWarmups).toBe(false);
    expect(data.scenarios[0].restSeconds).toBe(45);
    expect(data.dailyCap).toBe(3);
  });

  it("accepts a raw legacy Threshold backup", () => {
    const data = parseBackupText(JSON.stringify({
      version: 5,
      name: "Mabel",
      active: "evening",
      scenarios: [{
        id: "evening",
        label: "Evening",
        start: 8,
        sessions: [{
          id: "old",
          kind: "absence",
          at: 50,
          target: 12,
          actual: 9,
          stopped: true,
          outcome: "ok"
        }]
      }]
    }));

    expect(data.activeScenarioId).toBe("evening");
    expect(data.scenarios[0].sessions[0]).toMatchObject({
      targetSeconds: 12,
      actualSeconds: 9,
      outcome: "concern"
    });
  });

  it("reduces an older daily ceiling to the current maximum", () => {
    const data = parseBackupText(envelope({ dailyCap: 10 }));
    expect(data.dailyCap).toBe(3);
  });

  it("rejects unrecognised JSON", () => {
    expect(() => parseBackupText('{"hello":"world"}')).toThrow(
      /not a recognised/i
    );
  });

  it("summarises everything that will be restored", () => {
    const data = parseBackupText(JSON.stringify({
      activeScenarioId: "a",
      dogName: "Mabel",
      scenarios: [
        {
          id: "a",
          label: "A",
          startSeconds: 5,
          sessions: [],
          cuePractice: {
            level: 0,
            sessions: [{
              id: "c",
              at: 1,
              cueIndex: 0,
              relaxedReps: 3,
              concernReps: 0,
              outcome: "relaxed"
            }]
          }
        },
        {
          id: "b",
          label: "B",
          startSeconds: 5,
          sessions: []
        }
      ]
    }));

    expect(backupSummary(data)).toEqual({
      dogName: "Mabel",
      scenarios: 2,
      sessions: 0,
      cueSets: 1
    });
  });
});
