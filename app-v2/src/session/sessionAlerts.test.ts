import { describe, expect, it, vi } from "vitest";
import { createReturnAlertToken } from "./sessionAlerts";

describe("return alert tokens", () => {
  it("uses cryptographic randomness without falling back to Math.random", () => {
    const insecureRandom = vi
      .spyOn(Math, "random")
      .mockImplementation(() => {
        throw new Error("Math.random must not be used for opaque tokens");
      });

    try {
      const token = createReturnAlertToken();
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    } finally {
      insecureRandom.mockRestore();
    }
  });
});
