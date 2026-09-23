import { describe, expect, it } from "vitest";
import { conflictTitle, describeSyncValue } from "./conflictSummary";
import type { SyncValue } from "./protocol";

const session: SyncValue = {
  kind: "session",
  scenarioId: "training",
  id: "s1",
  at: Date.UTC(2026, 8, 23, 9, 0),
  targetSeconds: 60,
  actualSeconds: 45,
  outcome: "concern",
  stoppedEarly: true,
  signals: ["pacing"],
  tags: [],
  stopReason: "Whined at the door",
  note: "Neighbour's dog barking"
};

describe("conflict summaries", () => {
  it("describes a session in owner-facing language", () => {
    const lines = describeSyncValue(session);
    expect(lines[0]).toBe("45s of 1:00 · Some concern · returned early");
    expect(lines).toContain("Signs: Pacing");
    expect(lines).toContain("Why early: Whined at the door");
    expect(lines).toContain("Note: Neighbour's dog barking");
    expect(lines.join(" ")).not.toMatch(/scenarioId|stoppedEarly|\{/);
  });

  it("labels deletions and titles the record from whichever version exists", () => {
    expect(describeSyncValue(null)).toEqual(["Deleted"]);
    expect(conflictTitle(null, session)).toMatch(/^Timed session from /);
    expect(conflictTitle(
      { kind: "profile", dogId: "primary", dogName: "Mabel" },
      null
    )).toBe("Dog profile");
  });
});
