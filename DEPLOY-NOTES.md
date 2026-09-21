# SettledSolo production deployment

The original Threshold root PWA remains in this renamed `settledsolo` repository during migration.

The production replacement is built from `app-v2/`.

## Build

```bash
npm install
npm run verify
npm run build:v2
```

Build output:

```text
dist-v2/
```

## Cloudflare preview

The isolated preview Worker is configured in `wrangler.preview.jsonc`.

```bash
npm run deploy:preview
```

This deploys the SPA as the `settledsolo-web-preview` Worker.

The GitHub workflow `.github/workflows/deploy-preview.yml` auto-runs on relevant pushes to
`main` and also supports manual dispatch. It expects repository/environment
secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Preview hosts are automatically returned with `X-Robots-Tag: noindex, nofollow`.

Use the resulting workers.dev URL for the physical-device test matrix before any root-app cutover.

## Worker naming

Keep the product surfaces separate:

- `settledsolo` — production website/PWA and `settledsolo.com` custom domain
- `settledsolo-web-preview` — isolated preview website/PWA
- the separate analytics/events Worker — configured independently under `cloudflare-worker/`

The old `settledsolo-web` app name is not a deployment target. Do not point the
static site deployment at the analytics Worker or at that retired app Worker.

## Cloudflare production

Production static-asset configuration lives in `wrangler.app.jsonc`.

```bash
npm run deploy:cloudflare
```

Cloudflare Static Assets are configured with SPA fallback so direct requests to:

- `/`
- `/app/`
- `/privacy`
- `/terms`
- `/help`

resolve to the React entry point rather than returning a static 404.

The intended final domain layout is:

- `settledsolo.com` — canonical
- `settledsolo.app` — redirect
- `settledsolo.co.uk` — redirect

The production custom domain is attached to `settledsolo`. Keep the alternate
domains as redirects only; do not attach them to the application Worker.

Because the `settledsolo` Worker is also connected directly to this GitHub repository
in Cloudflare, `wrangler.app.jsonc` must remain safe to deploy on its own. It therefore
contains the live production account D1 binding and non-secret account variables/rate
limits. The Better Auth and Resend credentials remain Worker secrets. A direct Cloudflare
build must never replace the live Worker with an accounts-disabled configuration.

### Cloudflare cutover checklist

Before the first production deployment after this naming correction:

1. Confirm `settledsolo.com` is attached to the `settledsolo` Worker in
   **Workers & Pages → Settings → Domains & Routes**.
2. Confirm the `settledsolo-web` Worker has no production route or active build
   pipeline. Keep it available temporarily as a rollback reference; do not
   delete it until the live deployment has been verified.
3. Confirm the production GitHub environment token can deploy Worker versions,
   manage the production D1 binding and write the production secrets.
4. Run **Deploy SettledSolo Production** from `main`, then verify that the
   Cloudflare deployment history names `settledsolo` and that
   `https://settledsolo.com/api/account/status` reports the expected state.

The repository's deployment helper validates the Worker name before Wrangler
runs, so a stale `settledsolo-web` configuration fails closed.

## Security

`worker/index.ts` applies the production security headers, restrictive CSP, preview noindex policy
and static asset caching before requests reach the Vite app.

Review the CSP before introducing any future third-party analytics, authentication or API hosts.

## Cutover gate

Before replacing the old root PWA:

1. CI green.
2. Android-style Chromium Playwright green.
3. iPhone-style WebKit Playwright green.
4. Real installed iPhone PWA checks complete.
5. Real installed Android PWA checks complete.
6. Camera-app switching / lock-screen timer behaviour recorded.
7. Offline relaunch verified.
8. Backup/export/restore verified.
9. Qualified behaviour-professional content review complete.
10. SettledSolo domain/trademark checks recorded.
