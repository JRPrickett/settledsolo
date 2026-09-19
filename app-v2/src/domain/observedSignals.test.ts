import { describe, expect, it } from "vitest";
import {
  OBSERVED_SIGNAL_VALUES,
  observedSignalLabel,
  observedSignalOptions
} from "./observedSignals";

describe("observed signals", () => {
  it("offers food refusal alongside the original six", () => {
    expect(OBSERVED_SIGNAL_VALUES).toHaveLength(7);
    expect(OBSERVED_SIGNAL_VALUES).toContain("food-refusal");
  });

  it("gives every signal a human label rather than its raw value", () => {
    for (const signal of OBSERVED_SIGNAL_VALUES) {
      const label = observedSignalLabel(signal);
      expect(label).toBeTruthy();
      expect(label).not.toBe(signal);
    }
  });

  it("keeps the option list and the value list in step", () => {
    expect(observedSignalOptions.map((option) => option.value)).toEqual(
      OBSERVED_SIGNAL_VALUES
    );
  });

  it("does not reorder or rename the existing six", () => {
    expect(OBSERVED_SIGNAL_VALUES.slice(0, 6)).toEqual([
      "exit-watching",
      "pacing",
      "panting",
      "whining",
      "barking-howling",
      "unable-to-settle"
    ]);
  });
});
