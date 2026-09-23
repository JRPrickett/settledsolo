import { describe, expect, it } from "vitest";
import { SESSION_TAG_OPTIONS, SESSION_TAG_VALUES } from "./sessionTags";

describe("session context tags", () => {
  it("keeps every existing value so saved sessions stay readable", () => {
    expect(SESSION_TAG_VALUES).toEqual(
      expect.arrayContaining([
        "morning",
        "afternoon",
        "evening",
        "not-walked-yet",
        "after-a-walk",
        "before-food",
        "after-food",
        "radio-or-tv-on",
        "crated-confined",
        "free-roam"
      ])
    );
  });

  it("records food, a remote feeder, noise and whether someone else was home", () => {
    expect(SESSION_TAG_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: "food-left", label: "Food or chew left" },
        { value: "remote-feeder", label: "Remote treat feeder used" },
        { value: "noise-disturbance", label: "Noise or disturbance" },
        { value: "someone-home", label: "Someone else was home" }
      ])
    );
  });

  it("has unique values and labels", () => {
    expect(new Set(SESSION_TAG_VALUES).size).toBe(SESSION_TAG_VALUES.length);
    const labels = SESSION_TAG_OPTIONS.map((option) => option.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });
});
