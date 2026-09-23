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

describe("per-page share metadata in the served HTML", () => {
  const shell =
    '<html><head><meta charset="utf-8" />\n    <!--seo-->\n    <title>Home</title>\n    <!--/seo-->\n</head><body><div id="root"></div></body></html>';
  const env = envWithAssets(async () =>
    new Response(shell, {
      headers: { "Content-Type": "text/html", "Content-Length": String(shell.length), ETag: '"abc"' },
    }),
  );
  const fetchPage = (path: string, method = "GET") =>
    handleRequest(new Request(`https://settledsolo.com${path}`, { method }), env);

  it("gives each public page its own title, card and canonical URL for crawlers", async () => {
    const help = await (await fetchPage("/help")).text();
    expect(help).toContain("<title>Help — dog separation anxiety training | SettledSolo</title>");
    expect(help).toContain('<meta property="og:image" content="https://settledsolo.com/social/help.png" />');
    expect(help).toContain('<link rel="canonical" href="https://settledsolo.com/help" />');
    expect(help).not.toContain("<title>Home</title>");
    expect(help).toContain('<div id="root"></div>');

    const resources = await (await fetchPage("/resources/")).text();
    expect(resources).toContain('content="https://settledsolo.com/social/resources.png"');
    expect(resources).toContain('href="https://settledsolo.com/resources"');
  });

  it("drops stale length and validator headers from the rewritten page", async () => {
    const response = await fetchPage("/evidence");
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("etag")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("never gives the app shell or a missing page a canonical URL", async () => {
    const app = await (await fetchPage("/app/")).text();
    expect(app).toContain("<title>SettledSolo — training app</title>");
    expect(app).not.toContain('rel="canonical"');

    const missing = await fetchPage("/no-such-page");
    expect(missing.status).toBe(404);
    const body = await missing.text();
    expect(body).toContain("<title>Page not found — SettledSolo</title>");
    expect(body).not.toContain('rel="canonical"');
  });

  it("leaves HEAD requests and non-HTML assets untouched", async () => {
    const head = await fetchPage("/help", "HEAD");
    expect(head.headers.get("content-length")).toBe(String(shell.length));

    const image = await handleRequest(
      new Request("https://settledsolo.com/social/home.png"),
      envWithAssets(async () => new Response("png-bytes", { headers: { "Content-Type": "image/png" } })),
    );
    expect(await image.text()).toBe("png-bytes");
  });
});

describe("pre-rendered public pages", () => {
  const shell = '<html><head><!--seo--><!--/seo--></head><body><div id="root"></div></body></html>';
  const pages = {
    "/": "<main><h1>Home content</h1></main>",
    "/help": "<main><h1>Help content</h1></main>",
    "*": "<main><h1>Not found content</h1></main>",
  };
  const env = envWithAssets(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/__prerender.json") return Response.json(pages);
    return new Response(shell, { headers: { "Content-Type": "text/html" } });
  });
  const fetchPage = (path: string) =>
    handleRequest(new Request(`https://settledsolo.com${path}`), env);

  it("serves each public page's content inside the root for crawlers", async () => {
    expect(await (await fetchPage("/help/")).text()).toContain(
      '<div id="root"><main><h1>Help content</h1></main></div>',
    );
    expect(await (await fetchPage("/")).text()).toContain("Home content");
  });

  it("gives unknown pages the not-found content and keeps the app an empty shell", async () => {
    const missing = await fetchPage("/nowhere");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("Not found content");
    expect(await (await fetchPage("/app/")).text()).toContain('<div id="root"></div>');
  });

  it("never serves the pre-render data directly", async () => {
    const response = await fetchPage("/__prerender.json");
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Help content");
  });

  it("falls back to the empty shell when the pre-render data is missing", async () => {
    const response = await handleRequest(
      new Request("https://settledsolo.com/help"),
      envWithAssets(async (request) =>
        new URL(request.url).pathname === "/__prerender.json"
          ? new Response("missing", { status: 404 })
          : new Response(shell, { headers: { "Content-Type": "text/html" } }),
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root"></div>');
  });
});
