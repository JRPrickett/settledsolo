# SettledSolo next phase — Beta readiness after accounts

Date: 22 September 2026


## Current work — post-account hardening and beta readiness

The optional account/sync baseline is implemented and active in both preview and production:
Better Auth email OTP, isolated D1 databases, verified Resend delivery, local-first sync, cloud
export/deletion and deployment verification are live. PRs #49 and #50 closed the final production
deployment/configuration regressions.

Account setup is therefore no longer the active development phase. Remaining account work is
release evidence and operational validation: real two-device/offline/conflict checks, provider
retention/privacy details and abuse/rate-limit observation.

Since that activation, PRs #52–#56 have also hardened storage fallback, stale-tab account export,
single-window write ownership and removed the old product-event analytics pipeline. The active
development phase is now **release hardening → small beta readiness**. Physical-device and
public-beta evidence gates remain open; the product does not claim professional review or
endorsement.

## Current position

The modern SettledSolo PWA is live on the isolated Cloudflare preview Worker.

Automated CI is green across the modern TypeScript/Vitest suite, legacy regression tests, the
Cloudflare Worker dry-run, Chromium mobile journeys and WebKit mobile journeys.

Real iPhone testing has now confirmed the core live-session resilience path:

- switching apps does not lose the session;
- lock/unlock does not lose the session;
- closing/reopening does not lose the session;
- the session chime works on the tested device.

With accounts now active, the next phase is device lifecycle proof, real two-device/recovery evidence,
remaining security/privacy closure and public-beta essentials.

## Phase A — Release Candidate

Goal: reach a modern local-first build that is safe to merge and use as the production baseline
before account code changes the data path.

### A0. Guided starting assessment

- replace the single duration field with a short first-run assessment;
- route cue-sensitive/uncertain dogs into departure-cue practice before real leaving;
- use an already observed comfortable duration when the owner genuinely has one;
- otherwise begin with a clearly labelled conservative micro-departure heuristic;
- show the owner their starting plan before saving setup;
- encourage direct camera/video observation without turning onboarding into a diagnostic test;
- preserve existing users without forcing them through the new onboarding;
- persist only the resulting route/version rather than every intake answer.

### A1. Finish physical-device release gates

iOS remaining:

- Airplane Mode relaunch and full offline session/save;
- notification permission/denial path;
- deployment/update prompt during an active session;
- repeated/background chime duplication check;
- Media Session presentation where available.

Android:

- browser + installed PWA;
- camera/app switching;
- lock/unlock;
- chimes/notifications;
- force-close/recovery;
- offline relaunch/session;
- update prompt safety.

Desktop:

- first run;
- session/history;
- export/restore;
- legacy restore;
- training-track switching.

### A2. Evidence and owned content

The product does not claim professional review or endorsement. Instead:

- maintain the evidence page and evidence-base notes as the source boundary for the product;
- label progression, warm-up and referral thresholds as SettledSolo product heuristics;
- keep the owned help, FAQ, cheatsheet and resource pages aligned with that boundary;
- retain clear referral wording for veterinary or qualified behaviour support when safety requires it.

### A3. Brand/domain launch readiness

- complete formal exact/similar trademark checks;
- secure/connect `settledsolo.com`, `.app` and `.co.uk`;
- use `settledsolo.com` as canonical;
- redirect the other domains;
- export final icon variants;
- create Open Graph/social preview artwork.

### A4. Public-site beta essentials

Already implemented:

- landing page;
- app route;
- privacy;
- terms;
- help;
- evidence;
- noindex app/preview policy.

Still required:

- feedback/contact route;
- real SettledSolo screenshots rather than illustrative placeholders;
- accessibility pass;
- metadata/social-image finalisation;
- final account/privacy language once the sync provider is deployed.


### A5. Cutover — complete baseline

The modern app is already the production baseline on `settledsolo`, the canonical domain is live,
accounts are active, and the legacy product-event analytics Worker has been retired. Preserve legacy
import compatibility and use the current production commit/history as the rollback reference for
future release work.

## Phase B — Optional Accounts ✅ baseline complete

Goal: protect progress without changing the first-run experience.

**Status:** the scoped account baseline is active in preview and production. Passkeys remain
intentionally deferred. Manual multi-device/offline/conflict proof remains a release-validation task.

### Architecture

- Better Auth hosted inside the existing SettledSolo Worker.
- Cloudflare D1 for account/session/private training data.
- Separate preview and production D1 databases.
- Same-origin auth/API routes.
- Local IndexedDB remains the immediate working copy.
- Account sync never blocks a live session.

### Authentication UX

Guest remains the default.

After meaningful progress:

> **Your progress is currently saved on this device.**
> Create a free account to back it up and use SettledSolo on your other devices.

First auth flow:

- email OTP;
- no password requirement;
- no forced account before training;
- passkeys are a later enhancement, not part of the completed baseline.

### B1. Auth foundation

- create preview D1;
- bind it to `settledsolo-web-preview`;
- add Better Auth;
- schema migration;
- session/cookie security;
- OTP email delivery;
- rate limiting;
- sign-in/sign-out/session tests.

### B2. Account UI

- account status in More;
- create account/sign in;
- last sync state;
- passkey management — **deferred beyond the baseline**;
- sign out;
- remove local account data without deleting cloud account.

### B3. Guest import

Before upload, show:

- dog name;
- training-track count;
- session count;
- cue-practice count.

Require explicit confirmation.

Preserve existing stable scenario/session IDs.

### B4. Sync engine

- local write first;
- durable local outbox;
- idempotent remote upserts;
- tombstones for deletes;
- retries with backoff;
- last successful sync timestamp;
- append-only session merge;
- recoverable conflict handling for editable records.

### B5. Multi-device proof

Automated and manual tests must cover:

- device A creates session -> device B receives it;
- both devices create sessions offline -> later merge;
- same scenario renamed on both devices -> conflict does not silently discard one edit;
- duplicate retries do not duplicate sessions;
- delete/account-delete propagation;
- sign-out does not delete cloud history.

### B6. Account controls

Before public account launch:

- account data export;
- full account deletion;
- email/recovery path;
- privacy/subprocessor details;
- log audit for accidental private-content capture;
- auth abuse/rate-limit tests.

## Phase C — Small beta

Start with a deliberately small cohort rather than immediate broad promotion.

Measure only useful product signals:

- onboarding completion;
- first session completion;
- return sessions;
- sessions across multiple weeks;
- account conversion after local use;
- sync success/failure;
- qualitative reports of planning/logging friction.

Do not use training outcomes as an efficacy claim.

## Suggested implementation PR sequence from here

1. **Installed-device lifecycle evidence** — iOS/Android update, notification, background-return and offline checks.
2. **Real account recovery evidence** — two-device initial import, offline/reconnect, conflicts, OTP errors and rate limits.
3. **Remaining browser/security closure** — sync conflict journeys, XSS/noindex assertions and provider retention/privacy wording.
4. **Public-beta essentials** — feedback/contact, accessibility, real product screenshots and social metadata.
5. **Small beta** — invite a limited cohort, record friction/failures and measure registered-account adoption plus sync reliability.

Passkeys, collaboration features and extra telemetry stay behind this baseline rather than becoming
the next immediate feature tranche.
