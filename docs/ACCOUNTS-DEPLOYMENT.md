# Optional account activation

Accounts and sync are active in preview and production. Guest use remains fully
supported and local-first. Unconfigured account endpoints still fail closed with
JSON and the app continues to work locally. Never point account bindings at the
analytics database.

## Current activation state

Updated on 21 September 2026 after account activation:

| Item | State |
| --- | --- |
| Account/sync code on `main` | Merged, CI green |
| Production Worker | `settledsolo` on `https://settledsolo.com` |
| Preview Worker | Deployed at `https://settledsolo-web-preview.jasonrprickett.workers.dev` |
| `ACCOUNTS_ENABLED` | `true` in preview and production |
| Account D1 databases | Active, isolated `settledsolo-accounts-preview` and `settledsolo-accounts-production` databases |
| Account D1 migrations | Applied independently in both environments |
| Account variables and secrets | Configured through the corresponding GitHub environments |
| Cloudflare deployment credentials | Present in both the `preview` and `production` GitHub environments, with D1 read/edit permission |
| Live `/api/account/status` | `{"available":true}`, private and noindexed |
| Unknown API paths on preview | Fail closed as JSON, never the app shell |

The original activation steps below remain as the runbook for rebuilding an
environment. Current security and recovery controls are documented in
`SECURITY.md`.

The provisioning workflow is idempotent: it reuses a database that already exists and
reprints its ID, so re-run it rather than recording the UUIDs here, where they would go
stale. The run log and job summary both print them.

## Check configuration without deploying

Run **Verify account configuration** (`.github/workflows/verify-accounts-config.yml`)
for an environment at any point. It reports which variables and secrets are present,
lists everything still outstanding and never prints a secret value. It does not deploy,
apply migrations or upload secrets.

The same report runs locally:

```sh
npm run accounts:preflight preview
```

Deployment runs this check first, so an incomplete activation now fails before any
D1 migration or secret upload rather than part-way through.

After a deployment, endpoint behaviour is checked against the live Worker:

```sh
npm run accounts:verify https://settledsolo-web-preview.jasonrprickett.workers.dev
```

This fails if a deployment that claimed to enable accounts reports them unavailable,
if account responses become cacheable or indexable, or if an unknown API path falls
through to the app shell. Set `ACCOUNTS_VERIFY_ORIGIN` (or `AUTH_ORIGIN`) as an
environment variable for the deploy workflows to run it automatically; without either,
the step is skipped with a notice.

`npm run verify` additionally dry-runs the accounts-enabled Worker configuration for
both targets using placeholder values, so a broken binding, migration path or rate
limiter fails in CI instead of at activation.

## Review before activation

- Merge the account PR only after code, D1, mobile-browser and production-PWA CI gates pass.
- Review `ACCOUNT-SYNC.md` and the recorded app behaviour in `ACCOUNTS-REVIEW.md`.
- Complete sender/domain verification with the email provider (the current adapter is Resend).
- Finalise public privacy/contact details, provider data-processing terms, retention and backups.
- Installed-device gates in `DEVICE-TEST-MATRIX.md` remain separate and are not cleared by CI.

## Provision isolated databases

Run **Provision isolated account database** once for `preview` and once for `production`. It creates or reuses only these names:

- `settledsolo-accounts-preview`
- `settledsolo-accounts-production`

It uses the existing environment's `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
The token needs D1 read/edit permission in addition to the existing Worker deployment permissions.
The workflow prints database IDs in its job summary, never tokens. It does not enable accounts,
deploy the Worker, or touch the analytics database.

Equivalent local commands, with credentials supplied privately in the environment:

```sh
node scripts/provision-accounts.mjs preview
node scripts/provision-accounts.mjs production
```

## GitHub configuration

Set both D1 IDs as repository variables. Use environment-scoped variables/secrets for the rest.

| Name | Kind | Value |
| --- | --- | --- |
| `ACCOUNTS_PREVIEW_D1_ID` | Repository variable | Actual preview D1 UUID |
| `ACCOUNTS_PRODUCTION_D1_ID` | Repository variable | Actual production D1 UUID |
| `ACCOUNTS_ENABLED` | Environment variable | `true` only when ready to activate that environment |
| `AUTH_ORIGIN` | Environment variable | Exact HTTPS origin; preview Worker URL for preview, `https://settledsolo.com` for production; no trailing slash |
| `AUTH_EMAIL_FROM` | Environment variable | Verified sender, e.g. `SettledSolo <login@your-verified-domain>` |
| `BETTER_AUTH_SECRET` | Environment secret | Independently generated random secret, at least 32 characters; different in preview/production |
| `RESEND_API_KEY` | Environment secret | Sending key scoped to the verified domain |
| `ACCOUNTS_VERIFY_ORIGIN` | Environment variable | Optional. Origin the post-deploy endpoint check probes; defaults to `AUTH_ORIGIN`, skipped when neither is set |

Do not put secret values in source, chat, PR descriptions, screenshots or workflow output.

## Deploy preview first

Use **Deploy SettledSolo Preview** after configuration. The deployment script:

1. Validates origins, credentials and distinct database IDs, before any D1 or secret write.
2. Creates a temporary Wrangler config with `ACCOUNTS_DB` and a native API rate limiter.
3. Applies only account migrations to the selected D1 database.
4. Uploads auth/email secrets using a private temporary file which is removed afterwards.
5. Deploys the selected Worker and removes the temporary config.

All generated config paths are ignored by git. Secrets are not written into Wrangler config.

Production is already activated, so its non-secret account binding, origin, sender and rate
limits are also committed in `wrangler.app.jsonc`. This is deliberate: the production Worker
is connected to the repository in Cloudflare, and a direct Cloudflare build must not silently
remove D1/auth bindings just because GitHub environment variables are unavailable there.
Production secrets remain Cloudflare Worker secrets and are never committed.

For preview, an unset/false `ACCOUNTS_ENABLED` still fails closed. For production, an
explicit `ACCOUNTS_ENABLED=false` remains an emergency kill switch; an unset value preserves
the already-active production configuration.

Real OTP delivery has been verified and both environments are active. Continue using preview for
destructive/recovery testing before repeating those checks in production. Production remains a
manual workflow dispatch from main.

## Activation order — complete

The infrastructure/setup portion of this checklist is complete as of 21 September 2026:

1. ~~Provision isolated D1 databases for preview and production.~~ Done; both are active and migrated.
2. ~~Set distinct preview and production D1 IDs as repository variables.~~ Done.
3. ~~Verify the Resend sender/domain and create separate Better Auth secrets.~~ Done.
4. ~~Configure the preview environment.~~ Done.
5. ~~Run preview preflight and activation deployment.~~ Done.
6. ~~Verify live preview account availability and real OTP delivery.~~ Done.
7. ~~Configure and activate production with `AUTH_ORIGIN=https://settledsolo.com`.~~ Done.
8. ~~Harden direct production deployment and post-deploy verification.~~ Done in PRs #49 and #50.

What remains is **operational/release validation**, not account setup: two-device sync,
offline/reconnect/conflict recovery, wrong/expired OTP and resend/rate-limit behaviour, cloud
export/deletion on real devices, and provider retention/privacy documentation.

Both D1 IDs must remain distinct: deployment refuses to run when the IDs are missing, malformed
or identical.

## Operational boundaries

- OTPs are hashed at rest, expire after five minutes and permit three verification attempts.
- Auth uses database-backed limits plus the Worker API rate limiter. Configure Cloudflare edge
  rules for additional protection against distributed email abuse before a broader launch.
- Sync is local-first with explicit initial consent and 25-operation client batches. The server
  accepts at most 50 operations and 512 KiB, with incremental pages of 200 changes.
- API responses are private/no-store and noindexed; API failures never fall through to the SPA.
- The Worker does not log bodies, codes, dog names, notes or training history. Better Auth logging
  is disabled. Provider operational logs/backups need their retention documented before activation.
- Account deletion requires an authenticated session created within the last ten minutes and
  typed `DELETE`. Foreign keys cascade through cloud training data and auth records.
- Deleting cloud data does not remotely wipe device copies. Sign-out pauses sync and keeps the
  local log; local reset clears the device log and disconnects it without deleting cloud history.
- Passkeys are intentionally deferred; email OTP is the complete first authentication path.
- Conflicting versions remain on the device in the conflict archive, included in backup export.
