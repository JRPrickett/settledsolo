import { describe, expect, it, vi } from "vitest";
import { createOpaqueId } from "./ids";

describe("opaque record IDs", () => {
  it("preserves prefixes and never uses Math.random", () => {
    const insecureRandom = vi
      .spyOn(Math, "random")
      .mockImplementation(() => {
        throw new Error("Math.random must not be used for record IDs");
      });

    try {
      const first = createOpaqueId("p");
      const second = createOpaqueId("p");
      expect(first).toMatch(/^p[a-f0-9]{32,48}$/);
      expect(second).not.toBe(first);
    } finally {
      insecureRandom.mockRestore();
    }
  });
});
