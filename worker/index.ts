import { handleAccountApi } from "./accounts/api";
import type { AccountEnv } from "./accounts/auth";
import { handlePushApi, type PushEnv } from "./push";
import { isAppPath, isPublicPagePath } from "../app-v2/src/public/routes";
import { contentSecurityPolicy } from "./csp";

export { ReturnAlertScheduler } from "./push";

export interface Env extends AccountEnv, PushEnv {
  ASSETS: Fetcher;
  /** Canonical production origin. Preview hosts are automatically noindexed. */
  SITE_URL?: string;
}

const CSP = contentSecurityPolicy();

function productionHost(url: URL, env: Env): boolean {
  if (!env.SITE_URL) return false;
  try {
    return new URL(env.SITE_URL).hostname === url.hostname;
  } catch {
    return false;
  }
}

function canonicalHostRedirect(url: URL, env: Env): Response | null {
  if (!env.SITE_URL) return null;

  let canonical: URL;
  try {
    canonical = new URL(env.SITE_URL);
  } catch {
    return null;
  }

  if (url.hostname === canonical.hostname) return null;

  const sibling =
    url.hostname === `www.${canonical.hostname}` ||
    canonical.hostname === `www.${url.hostname}`;

  if (!sibling) return null;

  const target = new URL(url.toString());
  target.protocol = "https:";
  target.hostname = canonical.hostname;
  target.port = "";
  return new Response(null, {
    status: 301,
    headers: { location: target.toString() }
  });
}

function secure(response: Response, url: URL, env: Env): Response {
  const headers = new Headers(response.headers);

  headers.set("Content-Security-Policy", CSP);
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Origin-Agent-Cluster", "?1");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");

  const isApi = url.pathname.startsWith("/api/");
  if (isApi) headers.set("Cache-Control", "no-store, private");

  const isAppRoute = isAppPath(url.pathname);
  if (!productionHost(url, env) || isAppRoute || isApi || response.status === 404) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  const isImmutableAsset =
    response.ok &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname === "/photos/hero-settled-at-home-v2.webp");

  if (isImmutableAsset) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if ((headers.get("content-type") ?? "").includes("text/html")) {
    headers.set("Cache-Control", "no-cache");
  }

  if (url.pathname === "/" && (headers.get("content-type") ?? "").includes("text/html")) {
    headers.set(
      "Link",
      '</photos/hero-settled-at-home-v2.webp?v=2>; rel="preload"; as="image"; type="image/webp"; fetchpriority="high"'
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Single-page asset handling serves the app shell for every unknown path. Keep
 * the shell (it renders a helpful not-found page) but report a real 404 so
 * mistyped or stale URLs are not indexed as duplicates of the homepage.
 */
function notFoundForUnknownPage(response: Response, url: URL): Response {
  const isHtml = (response.headers.get("content-type") ?? "").includes("text/html");
  if (
    response.status !== 200 ||
    !isHtml ||
    isAppPath(url.pathname) ||
    isPublicPagePath(url.pathname)
  ) {
    return response;
  }
  return new Response(response.body, { status: 404, headers: response.headers });
}

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (url.pathname.startsWith("/api/push/")) {
      return secure(await handlePushApi(request, env), url, env);
    }

    if (url.pathname.startsWith("/api/"))
      return secure(await handleAccountApi(request, env), url, env);

    if (!["GET", "HEAD"].includes(request.method)) {
      return secure(
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        }),
        url,
        env,
      );
    }

    const redirect = canonicalHostRedirect(url, env);
    if (redirect) return secure(redirect, url, env);

    return secure(notFoundForUnknownPage(await env.ASSETS.fetch(request), url), url, env);
  } catch {
    const unavailable = url.pathname.startsWith("/api/")
      ? Response.json(
          { error: "Service unavailable. Try again later." },
          { status: 503 },
        )
      : new Response("SettledSolo is temporarily unavailable.", {
          status: 503,
        });

    return secure(unavailable, url, env);
  }
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;
