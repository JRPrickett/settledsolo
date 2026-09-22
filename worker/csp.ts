/**
 * The Content Security Policy for every SettledSolo response. Shared with the
 * production-preview test server so browser tests exercise the real policy.
 *
 * style-src deliberately has no 'unsafe-inline': the build emits only external
 * stylesheets, and React style props use the CSSOM, which CSP does not block.
 */
export function contentSecurityPolicy({
  upgradeInsecureRequests = true
}: { upgradeInsecureRequests?: boolean } = {}): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self'",
    "script-src 'self'",
    "connect-src 'self'",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ];
  // Plain-HTTP local test servers cannot serve upgraded subresource requests.
  if (upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
