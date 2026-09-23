import { describe, expect, it } from "vitest";
import { handleRequest, type Env } from "./index";

function envWithAssets(
  fetch: (request: Request) => Promise<Response>,
): Env {
  return {
    SITE_URL: "https://settledsolo.com",
    ASSETS: { fetch } as Fetcher,
  };
}

describe("worker security boundary", () => {
  it("adds isolation headers without de-indexing the production homepage", async () => {
    const response = await handleRequest(
      new Request("https://settledsolo.com/"),
      envWithAssets(async () =>
        new Response("<html>home</html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'self'",
    );
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin",
    );
    expect(response.headers.get("origin-agent-cluster")).toBe("?1");
    expect(response.headers.get("x-permitted-cross-domain-policies")).toBe(
      "none",
    );
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("keeps app and API responses private and rejects static writes", async () => {
    const env = envWithAssets(async () =>
      new Response("<html>app</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
    const app = await handleRequest(
      new Request("https://settledsolo.com/app/"),
      env,
    );
    const api = await handleRequest(
      new Request("https://settledsolo.com/api/account/status"),
      env,
    );
    const write = await handleRequest(
      new Request("https://settledsolo.com/", { method: "POST" }),
      env,
    );

    expect(app.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(api.headers.get("cache-control")).toContain("no-store");
    expect(api.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(write.status).toBe(405);
    expect(write.headers.get("allow")).toBe("GET, HEAD");
  });

  it("fails closed with generic secure responses", async () => {
    const response = await handleRequest(
      new Request("https://settledsolo.com/private"),
      envWithAssets(async () => {
        throw new Error("private internal details");
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(
      "SettledSolo is temporarily unavailable.",
    );
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });
});

describe("unknown public paths", () => {
  const html = () =>
    envWithAssets(async () =>
      new Response("<html>shell</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    );

  it("serves the app shell with a real 404 status and noindex", async () => {
    const response = await handleRequest(
      new Request("https://settledsolo.com/no-such-page"),
      html(),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("<html>shell</html>");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("keeps known public pages, the app and static files at 200", async () => {
    for (const path of ["/", "/help/", "/contact", "/privacy", "/app/", "/app/today"]) {
      const response = await handleRequest(
        new Request(`https://settledsolo.com${path}`),
        html(),
      );
      expect(response.status, path).toBe(200);
    }
    const asset = await handleRequest(
      new Request("https://settledsolo.com/robots.txt"),
      envWithAssets(async () =>
        new Response("User-agent: *", { headers: { "Content-Type": "text/plain" } }),
      ),
    );
    expect(asset.status).toBe(200);
  });
});

describe("content security policy", () => {
  it("allows no inline styles or scripts in production", async () => {
    const response = await handleRequest(
      new Request("https://settledsolo.com/"),
      envWithAssets(async () =>
        new Response("<html>home</html>", { headers: { "Content-Type": "text/html" } }),
      ),
    );
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});
