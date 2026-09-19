# SettledSolo next phase — Release Candidate to Accounts & Sync

Date: 18 September 2026

## Current work — account activation

The user explicitly prioritised optional accounts and sync on 19 September 2026. PR #28
implemented that behind deployment configuration and is now **merged** as `e13f5d4`. The code is
deployed to the preview Worker with accounts disabled; no account D1 database exists yet and no
account variables or secrets are configured. The current phase is provisioning and configuration.
Use `HANDOVER.md`, `ACCOUNTS-DEPLOYMENT.md` and `ACCOUNTS-REVIEW.md` for the current state.
The earlier numbered plan below is historical scope; guided onboarding and PR #26 hardening
are already merged. Physical-device and professional-review release gates remain open.

## Current position

The modern SettledSolo PWA is live on the isolated Cloudflare preview Worker.

Automated CI is green across the modern TypeScript/Vitest suite, legacy regression tests, the
Cloudflare Worker dry-run, Chromium mobile journeys and WebKit mobile journeys.

Real iPhone testing has now confirmed the core live-session resilience path:

- switching apps does not lose the session;
- lock/unlock does not lose the session;
- closing/reopening does not lose the session;
- the session chime works on the tested device.

That means the next phase should shift from timer-risk reduction toward release preparation and
optional accounts.

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

### A2. Behaviour/content review

Before public beta, have an appropriately qualified canine behaviour professional review:

- outcome wording;
- observed signs;
- progression/setback explanations;
- departure-cue ladder;
- repeated-distress support wording;
- statements on the public evidence/help pages.

Any requested changes should alter wording/heuristics without weakening the core rule that the
target is a ceiling, not a quota.

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

### A5. Cutover

When A1-A4 are satisfied:

1. Select the verified main commit and record the existing production commit for rollback.
2. Deploy the merged build to `settledsolo-web`.
3. Connect the canonical domain.
4. Preserve legacy import compatibility.
5. Keep analytics/events on its separate Worker.
6. Treat this build as the rollback point before accounts/sync.

## Phase B — Optional Accounts

Goal: protect progress without changing the first-run experience.

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
- optional passkey registration immediately after successful sign-in;
- no password requirement;
- no forced account before training.

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
- add/manage passkey;
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

## Suggested implementation PR sequence

1. **RC polish and cutover readiness**
2. **Better Auth + preview D1 + OTP**
3. **Account UI + passkeys**
4. **Guest import + local sync metadata**
5. **Remote sync + conflict/retry tests**
6. **Export/delete/privacy + beta readiness**

Keeping these separate makes the release baseline easy to recover if the first account implementation
causes regressions.
