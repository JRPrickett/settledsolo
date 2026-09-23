import { describe, expect, it } from "vitest";
import { effectiveWalkBackSeconds, headBackAt, returnedEarly } from "./walkBack";

describe("walk-back reminders", () => {
  it("caps the lead at a quarter of the target and skips very short departures", () => {
    expect(effectiveWalkBackSeconds(10, 30)).toBe(0);
    expect(effectiveWalkBackSeconds(40, 30)).toBe(10);
    expect(effectiveWalkBackSeconds(600, 30)).toBe(30);
    expect(effectiveWalkBackSeconds(600, 0)).toBe(0);
    expect(effectiveWalkBackSeconds(3600, 300)).toBe(300);
  });

  it("fires the reminder the lead before the target", () => {
    expect(headBackAt(1_000, 600, 30)).toBe(1_000 + 570_000);
    expect(headBackAt(1_000, 600, 0)).toBe(1_000 + 600_000);
  });

  it("treats a return inside the walk-back window as on target", () => {
    expect(returnedEarly(580, 600, 30)).toBe(false);
    expect(returnedEarly(569, 600, 30)).toBe(true);
    expect(returnedEarly(599, 600, 0)).toBe(true);
    expect(returnedEarly(650, 600, 30)).toBe(false);
  });
});
