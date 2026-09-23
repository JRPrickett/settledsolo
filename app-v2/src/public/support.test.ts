import { describe, expect, it } from "vitest";
import { safeSupportUrl, supportProviderName } from "./support";

describe("optional support link", () => {
  it("accepts only https links", () => {
    expect(safeSupportUrl("https://ko-fi.com/settledsolo")).toBe("https://ko-fi.com/settledsolo");
    expect(safeSupportUrl("http://ko-fi.com/settledsolo")).toBeNull();
    expect(safeSupportUrl("javascript:alert(1)")).toBeNull();
    expect(safeSupportUrl("")).toBeNull();
  });

  it("names the provider for the privacy notice", () => {
    expect(supportProviderName("https://ko-fi.com/settledsolo")).toBe("Ko-fi");
    expect(supportProviderName("https://www.Ko-fi.com/settledsolo")).toBe("Ko-fi");
    expect(supportProviderName("https://www.buymeacoffee.com/settledsolo")).toBe("Buy Me a Coffee");
    expect(supportProviderName("https://notko-fi.com/settledsolo")).toBe("our support provider");
  });
});
