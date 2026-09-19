import { describe, expect, it } from "vitest";
import type { AppData, Scenario, TrainingSession } from "./types";
import {
  PRE_PROTOCOL_FINDINGS,
  observationNotes,
  recordObservation,
  shouldOfferPreProtocolObservation
} from "./preProtocolObservation";

const scenario = (sessions: TrainingSession[] = []): Scenario => ({
  id: "training",
  label: "Separation training",
  startSeconds: 5,
  sessions
});

const session = (): TrainingSession => ({
  id: "s1",
  at: Date.now(),
  targetSeconds: 5,
  actualSeconds: 5,
  outcome: "relaxed",
  stoppedEarly: false,
  signals: [],
  tags: [],
  stopReason: "",
  note: ""
});

const data = (overrides: Partial<AppData> = {}): AppData => ({
  dogName: "Mabel",
  activeScenarioId: "training",
  scenarios: [scenario()],
  ...overrides
});

describe("pre-protocol observation eligibility", () => {
  it("is offered before any duration training has happened", () => {
    expect(shouldOfferPreProtocolObservation(data(), scenario(), true)).toBe(
      true
    );
  });

  it("does not interrupt a track that is already training", () => {
    expect(
      shouldOfferPreProtocolObservation(data(), scenario([session()]), true)
    ).toBe(false);
  });

  it("is not offered while the plan has no departure yet", () => {
    expect(shouldOfferPreProtocolObservation(data(), scenario(), false)).toBe(
      false
    );
  });

  it("is never offered twice, including after it was skipped", () => {
    for (const outcome of ["observed", "skipped"] as const) {
      expect(
        shouldOfferPreProtocolObservation(
          data({ preProtocolObservation: recordObservation(outcome) }),
          scenario(),
          true
        )
      ).toBe(false);
    }
  });
});

describe("recording an observation", () => {
  it("keeps only known findings, in a stable order", () => {
    const recorded = recordObservation("observed", [
      "toileted-while-alone",
      "made-up" as never,
      "settled-when-not-confined"
    ]);
    expect(recorded.findings).toEqual([
      "settled-when-not-confined",
      "toileted-while-alone"
    ]);
  });

  it("keeps no findings when the step is skipped", () => {
    expect(recordObservation("skipped", ["reacted-to-noises"]).findings).toEqual(
      []
    );
  });
});

describe("observation guidance", () => {
  it("offers a note for every finding it accepts", () => {
    for (const finding of PRE_PROTOCOL_FINDINGS) {
      const [note] = observationNotes([finding]);
      expect(note.finding).toBe(finding);
      expect(note.note.length).toBeGreaterThan(0);
    }
  });

  it("points a confinement observation at the free-roam comparison", () => {
    const [note] = observationNotes(["settled-when-not-confined"]);
    expect(note.note).toMatch(/free-roam/i);
  });

  it("drops 'nothing notable' when something was also noticed", () => {
    const notes = observationNotes([
      "nothing-notable",
      "reacted-to-noises"
    ]).map((item) => item.finding);
    expect(notes).toEqual(["reacted-to-noises"]);
  });

  it("never diagnoses or prescribes", () => {
    const text = observationNotes(PRE_PROTOCOL_FINDINGS)
      .map((note) => note.note)
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/\b(diagnos|medication|prescrib|drug)/);
    expect(text).not.toMatch(/your dog (has|suffers)/);
  });
});
