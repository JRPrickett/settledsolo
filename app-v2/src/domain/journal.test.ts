import { describe, expect, it } from "vitest";
import { cleanJournal, difficultAbsencesSince, upcomingPlannedAbsences } from "./journal";

const NOW = new Date(2026, 8, 24, 12).getTime();
const HOUR = 60 * 60 * 1000;

describe("cleanJournal", () => {
  it("keeps valid entries, repairs fields and drops the rest", () => {
    const entries = cleanJournal([
      { type: "life-event", id: "a", at: 3, category: "moved-home", note: "New flat" },
      { type: "life-event", id: "b", at: 1, category: "not-a-category", note: "" },
      { type: "real-absence", id: "c", at: 2, durationSeconds: 999999, outcome: "weird", note: "x".repeat(400) },
      { type: "planned-absence", id: "d", at: 4, durationSeconds: 10, cover: "nobody" },
      { type: "real-absence", id: "a", at: 5, durationSeconds: 600, outcome: "relaxed" },
      { type: "something-else", id: "e", at: 6 },
      "junk",
      null
    ]);
    expect(entries.map((entry) => entry.id)).toEqual(["c", "a", "d"]);
    expect(entries[0]).toMatchObject({ durationSeconds: 24 * 3600, outcome: "unknown" });
    expect((entries[0] as { note: string }).note).toHaveLength(280);
    expect(entries[2]).toMatchObject({ durationSeconds: 60, cover: "not-covered", note: "" });
    expect(cleanJournal("nope")).toEqual([]);
  });
});

describe("journal queries", () => {
  const journal = cleanJournal([
    { type: "real-absence", id: "r1", at: NOW - 3 * HOUR, durationSeconds: 3600, outcome: "concern" },
    { type: "real-absence", id: "r2", at: NOW - 2 * HOUR, durationSeconds: 3600, outcome: "relaxed" },
    { type: "planned-absence", id: "p1", at: NOW + 30 * HOUR, durationSeconds: 3600, cover: "walker" },
    { type: "planned-absence", id: "p2", at: NOW + 10 * 24 * HOUR, durationSeconds: 3600, cover: "walker" },
    { type: "planned-absence", id: "p3", at: NOW - 30 * HOUR, durationSeconds: 3600, cover: "walker" }
  ]);

  it("finds difficult unavoidable absences after a time", () => {
    expect(difficultAbsencesSince(journal, NOW - 4 * HOUR).map((entry) => entry.id)).toEqual(["r1"]);
    expect(difficultAbsencesSince(journal, NOW - HOUR)).toEqual([]);
  });

  it("lists the coming week's planned absences, soonest first", () => {
    expect(upcomingPlannedAbsences(journal, NOW).map((entry) => entry.id)).toEqual(["p1"]);
  });
});
