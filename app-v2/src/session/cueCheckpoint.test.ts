import { describe, expect, it } from "vitest";
import { parseCueCheckpoint } from "./cueCheckpoint";

const now = 10_000_000;
const valid = { scenarioId: "training", cueIndex: 0, rep: 2, relaxedReps: 2, concernReps: 0, savedAt: now - 1_000 };

describe("cue practice checkpoint", () => {
  it("restores a consistent unfinished or finished set", () => {
    expect(parseCueCheckpoint(valid, now)).toEqual(valid);
    expect(parseCueCheckpoint({ ...valid, rep: 3, relaxedReps: 1, concernReps: 1 }, now)).not.toBeNull();
  });

  it("rejects stale, empty, future or internally inconsistent sets", () => {
    expect(parseCueCheckpoint({ ...valid, savedAt: now - 3 * 60 * 60 * 1000 }, now)).toBeNull();
    expect(parseCueCheckpoint({ ...valid, savedAt: now + 60_000 }, now)).toBeNull();
    expect(parseCueCheckpoint({ ...valid, rep: 0, relaxedReps: 0 }, now)).toBeNull();
    expect(parseCueCheckpoint({ ...valid, rep: 1 }, now)).toBeNull();
    expect(parseCueCheckpoint({ ...valid, concernReps: 1 }, now)).toBeNull();
    expect(parseCueCheckpoint({ ...valid, cueIndex: 99 }, now)).toBeNull();
    expect(parseCueCheckpoint({ ...valid, scenarioId: "" }, now)).toBeNull();
    expect(parseCueCheckpoint("not an object", now)).toBeNull();
  });
});
