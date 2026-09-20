import { handleAccountApi } from "./accounts/api";
import type { AccountEnv } from "./accounts/auth";
import { handlePushApi, type PushEnv } from "./push";

export { ReturnAlertScheduler } from "./push";

interface Env extends AccountEnv, PushEnv {
  ASSETS: Fetcher;
  /** Canonical production origin. Preview hosts are automatically noindexed. */
  SITE_URL?: string;
}

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests"
].join("; ");

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

  const isApi = url.pathname.startsWith("/api/");
  if (isApi) headers.set("Cache-Control", "no-store, private");

  const isAppRoute = url.pathname === "/app" || url.pathname.startsWith("/app/");
  if (!productionHost(url, env) || isAppRoute || isApi) {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/push/")) {
      return secure(await handlePushApi(request, env), url, env);
    }

    if (url.pathname.startsWith("/api/")) return secure(await handleAccountApi(request, env), url, env);

    const redirect = canonicalHostRedirect(url, env);
    if (redirect) return secure(redirect, url, env);

    return secure(await env.ASSETS.fetch(request), url, env);
  }
} satisfies ExportedHandler<Env>;
