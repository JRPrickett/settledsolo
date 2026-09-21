# SettledSolo security and recovery

**Reviewed:** 21 September 2026

Security is an operating practice, not a one-off claim. No internet service can
guarantee that a breach or data-loss event is impossible. SettledSolo instead
uses layered controls to reduce likelihood, limit impact, detect regressions and
keep recovery possible.

## Data and trust boundaries

- Training data is local-first. It remains on the device unless the user
  explicitly connects the log to an account.
- Connected account, session and training records are stored in a dedicated D1
  database. Preview and production use different databases and secrets.
- Passwordless sign-in uses short-lived, single-use six-digit codes. OTP values
  are hashed at rest and are never written to application logs.
- The authentication cookie is `Secure` and `HttpOnly`. API responses are
  private, `no-store` and noindexed.
- Dog names, notes, session outcomes and training history must never be sent to
  analytics or included in Worker logs.

## Enforced controls

- Every state-changing API request must have the exact configured origin.
- API routes, methods, content types and body sizes are allowlisted and bounded.
- Account, OTP delivery and background-alert endpoints have independent edge
  rate-limit bindings. The OTP key is an HMAC of the normalized email address,
  so the rate-limit key does not expose an address.
- Account ownership is taken only from the authenticated server session, never
  from a client-supplied user ID.
- Account deletion requires a fresh session, typed confirmation and the current
  account ID. It deletes cloud data but deliberately does not remotely erase a
  user's local copy.
- Push endpoints must use HTTPS, an approved provider hostname, no credentials
  and the default port.
- Production is served only on `settledsolo.com`; the default production
  `workers.dev` hostname and preview URLs are disabled.
- Browser isolation, content restrictions, HSTS and anti-framing headers are
  applied by the Worker to both successful and error responses.
- Deployment workflows use read-only repository permissions, immutable action
  revisions, lockfile installs and step-scoped secrets. Manual environment
  workflows run only from `main`.
- Secret scanning with push protection, dependency vulnerability alerts,
  automated security fixes and CodeQL scanning are enabled. Dependabot
  configuration is committed for npm and GitHub Actions updates.

## Data-loss recovery

Cloudflare D1 Time Travel is always enabled for production-backend databases.
It can restore to a minute-level point in time within the provider's retention
window (currently 30 days on Workers Paid and 7 days on Workers Free). A restore
overwrites the database in place, cancels in-flight queries and is therefore an
incident operation, not a routine test.

If data corruption or accidental deletion is suspected:

1. Stop production account deployments and record the earliest known bad time
   in UTC. Do not delete the affected database.
2. Preserve current evidence: deployment SHA, Cloudflare audit events, GitHub
   Actions run, affected account/time range and the current D1 bookmark.
3. Check the proposed restore point without changing data:

   ```sh
   npx wrangler d1 time-travel info settledsolo-accounts-production --timestamp="2026-09-21T12:00:00Z"
   ```

4. Confirm the restore scope and accept the expected loss of legitimate writes
   made after that point. Record the current bookmark so the restore can be
   undone.
5. Only an authorised operator should perform the destructive restore:

   ```sh
   npx wrangler d1 time-travel restore settledsolo-accounts-production --bookmark=REVIEWED_BOOKMARK
   ```

6. Verify account status, sign-in, export and two-device sync before reopening
   normal changes. Keep the bookmark returned by the restore as the undo path.
7. Notify affected users when confidentiality, integrity or availability of
   their data may have been impacted, following applicable legal requirements.

For retention beyond Time Travel's window, add encrypted scheduled D1 exports
to separately controlled R2 storage, with a documented retention period and a
regular restore drill. Until that exists, Time Travel is the primary cloud
recovery layer and user-exported backups are the long-term portable copy.

Reference: [Cloudflare D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/).

## Incident response

For a suspected credential or data exposure:

1. Contain: pause deploys, disable the affected integration if needed and
   preserve audit evidence.
2. Rotate in this order: Cloudflare deployment token, Resend key, then the
   affected environment's Better Auth secret. A Better Auth secret rotation
   invalidates existing sessions, so users must sign in again.
3. Review D1, Worker, Resend and GitHub audit records without copying private
   request data into tickets or chat.
4. Determine the affected data, accounts and time window. Do not claim safety
   until the evidence supports it.
5. Patch, test in preview, deploy through the protected workflow, verify live
   endpoints and document the result.

Never paste tokens, OTPs, cookies, database exports or user training data into
issues, pull requests, screenshots or chat.

## Operational checks before public beta

- Require phishing-resistant MFA/passkeys for GitHub, Cloudflare and Resend
  administrators; keep at least two recovery methods under separate control.
- Use a dedicated least-privilege Cloudflare deployment token, separate for
  preview and production where practical, and rotate it on a schedule.
- Add production environment reviewers and restrict deployments to `main`.
- Protect `main`: require the CI and CodeQL checks, at least one review, resolved
  conversations, and block force pushes/deletion.
- Review GitHub vulnerability, automated security-update and CodeQL alerts on
  a defined cadence.
- Add a Cloudflare WAF rate-limit rule for distributed OTP abuse. Worker rate
  limits are an application layer, not a replacement for WAF controls.
- Verify provider retention, subprocessor and incident-notification terms, and
  keep the privacy notice aligned with actual storage and deletion behaviour.
- Run a quarterly recovery exercise in preview and record the time to restore.

Security reports should be sent privately to the project owner. Do not open a
public issue containing exploit details or user data.
