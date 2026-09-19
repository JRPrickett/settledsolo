# Optional account activation

Accounts and sync are merged on `main`, but **not activated on any deployed Worker**.
Guest use remains the default. Unconfigured account endpoints fail closed with JSON and the app
continues to work locally. Never point account bindings at the analytics database.

## Current activation state

Verified on 19 September 2026, after PR #28 merged as `e13f5d4`:

| Item | State |
| --- | --- |
| Account/sync code on `main` | Merged, CI green |
| Preview Worker | Deployed at `https://settledsolo-web-preview.jasonrprickett.workers.dev` |
| `ACCOUNTS_ENABLED` on the deployed preview Worker | `false` |
| Account D1 databases | **Created and empty.** `settledsolo-accounts-preview` and `settledsolo-accounts-production`, with distinct IDs |
| Account D1 migrations | **Not applied.** Deployment applies them when accounts are enabled |
| Account variables and secrets | **All unset.** Both D1 IDs still need storing as repository variables |
| Cloudflare deployment credentials | Present in both the `preview` and `production` GitHub environments, with D1 read/edit permission |
| Live `/api/account/status` on preview | `{"available":false}`, private and noindexed |
| Unknown API paths on preview | Fail closed as JSON, never the app shell |

So the code path is deployed and failing closed exactly as intended, and every
remaining step is provisioning and configuration rather than implementation.

Provisioning confirmed that the existing Cloudflare API token carries D1 read/edit
permission and that both GitHub environments hold Cloudflare credentials.

The remaining blocker is email delivery: accounts cannot be activated without a verified
sender, and `AUTH_ORIGIN`, `AUTH_EMAIL_FROM`, `RESEND_API_KEY` and `BETTER_AUTH_SECRET`
are all still unset.

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
When `ACCOUNTS_ENABLED` is unset/false, deployment explicitly disables account endpoints; it
does not delete existing cloud data. Set the variable consistently once enabled to avoid
accidentally disabling accounts on a later deployment.

Verify a real delivered OTP, expiry/error handling, logout and a fresh OTP before deletion in
preview. Confirm the privacy notice and sender identity before enabling production. Production
remains a manual workflow dispatch from main.

## Activation order

1. ~~Run **Provision isolated account database** for `preview`, then for `production`.~~
   Done: both databases exist and are empty. Re-run it at any time to reprint an ID.
2. Set `ACCOUNTS_PREVIEW_D1_ID` and `ACCOUNTS_PRODUCTION_D1_ID` as repository variables.
3. Complete Resend sender/domain verification and generate a separate
   `BETTER_AUTH_SECRET` per environment.
4. Set the remaining preview environment values, leaving `ACCOUNTS_ENABLED` unset.
5. Run **Verify account configuration** for `preview` until it reports a complete
   configuration. Nothing is deployed while it still lists outstanding items.
6. Set `ACCOUNTS_ENABLED` to `true` for preview and run **Deploy SettledSolo Preview**.
   The endpoint check must report `accounts available: true`.
7. Verify a real delivered OTP, expiry and error handling, sign-out, a fresh OTP, and
   two-device sync and recovery on preview before touching production.
8. Repeat steps 4 to 6 for production, with `AUTH_ORIGIN` set to `https://settledsolo.com`,
   only once the preview evidence and the release requirements are recorded.

Both D1 IDs must be set before either environment can be activated: the deployment
refuses to run when the two IDs are missing, malformed or identical.

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
