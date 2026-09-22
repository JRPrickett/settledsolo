import { describe, expect, it } from "vitest";
import { feedbackMailto } from "./contact";
import { isAppPath, isPublicPagePath, normalisePublicPath } from "./routes";

describe("feedback email", () => {
  it("prefills readable text without private training fields", () => {
    const href = feedbackMailto("hello@example.com", { installed: true, storage: "device" });
    expect(href.startsWith("mailto:hello@example.com?")).toBe(true);
    expect(href).not.toContain("+");
    const body = new URLSearchParams(href.split("?")[1]).get("body") ?? "";
    expect(body).toContain("App mode: installed app");
    expect(body).toContain("Storage: saved on this device");
    expect(body).not.toMatch(/dog|session history|note/i);
  });

  it("omits technical details when no context is given", () => {
    const body = new URLSearchParams(feedbackMailto("hello@example.com").split("?")[1]).get("body") ?? "";
    expect(body).not.toContain("App mode");
  });
});

describe("public routes", () => {
  it("recognises known pages with or without a trailing slash", () => {
    expect(isPublicPagePath("/")).toBe(true);
    expect(isPublicPagePath("/help/")).toBe(true);
    expect(isPublicPagePath("/contact")).toBe(true);
    expect(isPublicPagePath("/helpful")).toBe(false);
    expect(isPublicPagePath("/index.html")).toBe(false);
    expect(normalisePublicPath("///")).toBe("/");
  });

  it("separates the app from public pages", () => {
    expect(isAppPath("/app")).toBe(true);
    expect(isAppPath("/app/")).toBe(true);
    expect(isAppPath("/application")).toBe(false);
  });
});
