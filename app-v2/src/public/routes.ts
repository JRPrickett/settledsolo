/**
 * Public pages the client router renders. The Worker uses the same list to
 * return a real 404 for unknown paths, and the service worker uses it for its
 * offline navigation allowlist, so the three cannot drift apart.
 */
export const PUBLIC_PAGE_PATHS = [
  "/",
  "/help",
  "/resources",
  "/evidence",
  "/contact",
  "/privacy",
  "/terms"
] as const;

export type PublicPagePath = (typeof PUBLIC_PAGE_PATHS)[number];

export function normalisePublicPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isAppPath(pathname: string): boolean {
  return /^\/app(?:\/|$)/.test(pathname);
}

export function isPublicPagePath(pathname: string): pathname is PublicPagePath {
  return (PUBLIC_PAGE_PATHS as readonly string[]).includes(normalisePublicPath(pathname));
}
