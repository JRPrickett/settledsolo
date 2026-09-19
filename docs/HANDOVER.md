# SettledSolo handover

**Last updated:** 19 September 2026 (account activation tooling)
**Repository:** `JRPrickett/settledsolo`  
**Reviewed main:** `e13f5d4280a5cb9655016341cc506f76e7f373bd`

This is the current-state handover for another agent or contributor picking up SettledSolo. Read `AGENTS.md` first for repository rules.

## Executive status

Reviewed main: `e13f5d4` (PR #28 merged, CI green). PR #27 storage recovery is a separate
open PR, still based on `8cf04d9`. The user has explicitly prioritised **optional accounts
and sync**, ahead of the remaining physical-device/behaviour-quality work. Those release
gates still apply.

Accounts and sync are **merged and deployed to the preview Worker, but not activated**. The
merged implementation covers Better Auth email OTP, optional account UI, explicit guest-log
import, local outbox, revision-based incremental sync, recoverable conflicts, cloud
export/deletion and isolated account deployment tooling. Guest training remains usable offline.

The current phase is **activation**, and the remaining work is provisioning and configuration
rather than implementation. Verified on `e13f5d4`:

- the preview Worker at `https://settledsolo-web-preview.jasonrprickett.workers.dev` runs the
  merged account code with `ACCOUNTS_ENABLED="false"`;
- `/api/account/status` returns `{"available":false}`, private and noindexed, and unknown API
  paths fail closed as JSON rather than falling through to the app shell;
- both account D1 databases now exist and are empty, with distinct IDs, and no account
  migrations have been applied to either yet;
- the Cloudflare API token carries D1 read/edit permission, and both GitHub environments hold
  Cloudflare credentials;
- **all seven account variables and secrets are still unset**, including the two D1 IDs.

The remaining blocker is email delivery. There is no verified sender yet, so `AUTH_ORIGIN`,
`AUTH_EMAIL_FROM`, `RESEND_API_KEY` and `BETTER_AUTH_SECRET` cannot be finalised and preview
cannot be activated. Nothing else stands between the current state and preview accounts.

Re-run **Provision isolated account database** to reprint a database ID: it is idempotent and
reuses an existing database, so the UUIDs are deliberately not recorded in this repository.

See `ACCOUNTS-DEPLOYMENT.md` for the current state table and the ordered activation runbook,
and `ACCOUNTS-REVIEW.md` for review results, test coverage and outstanding real-device and
provider evidence.

## What changed most recently

### PR #27 — Preserve fallback training data during storage recovery — open

A user who trains while IndexedDB is unavailable saves setup, history and an active session
into the localStorage fallback. When IndexedDB later became available with an empty database,
startup seeded it from legacy data and silently ignored that saved progress.

Now:

- an absent IndexedDB app record is promoted from existing fallback data rather than from
  legacy migration data;
- a valid fallback active-session checkpoint is recovered with its original timer/review state;
- an expired or invalid checkpoint is cleared instead of resurrected;
- browser regressions cover history/ID preservation, running-session recovery, save/reload and
  expired-checkpoint rejection.

This handles an empty primary store. It deliberately does **not** reconcile two already-divergent
populated stores, or concurrent tabs. Guest/local use and training recommendations are unchanged.

This branch predates PR #28, so it carries a merge of `main`. Account sync wiring added to
`repository.ts` by PR #28 is preserved alongside the recovery change.

### PR #29 — Account activation tooling — merged

Activation was a multi-step configuration dance with no way to check it except by deploying.
This adds the missing checks without changing any account or sync behaviour:

- `npm run accounts:preflight <target>` reports every outstanding variable or secret at once
  instead of failing on the first one, and never prints a secret value;
- a **Verify account configuration** workflow runs that report for an environment without
  deploying, applying migrations or uploading secrets;
- both deploy workflows run the preflight before installing anything, so an incomplete
  activation fails before the first D1 migration or secret upload rather than part-way through;
- `npm run accounts:verify <origin>` probes a deployed Worker and fails when a deployment that
  claimed to enable accounts reports them unavailable, when account responses become cacheable
  or indexable, or when an unknown API path falls through to the app shell. Both deploy
  workflows run it after deploying when `ACCOUNTS_VERIFY_ORIGIN` or `AUTH_ORIGIN` is set;
- `npm run verify` now also dry-runs the accounts-enabled Worker configuration for both targets
  using placeholder values, so a broken binding, migration path or rate limiter fails in CI
  rather than at activation.

`accountConfig` keeps its existing fail-closed behaviour; the validation rules simply moved into
a shared `accountConfigProblems` so the preflight and the deployment cannot disagree.

### PR #28 — Optional email accounts and local-first cloud sync — merged

Better Auth email OTP, optional account UI, explicit guest-log import, durable local outbox,
revision-based incremental sync, recoverable conflicts, cloud export and deletion, and the
isolated account deployment/provisioning tooling. Accounts stay disabled until configured.

### PR #26 — Release hardening gates — merged

This starts the post-onboarding release-hardening phase.

Changes on the PR branch:

- prevents duplicate history records from a fast/double tap on **Save session** by using an in-flight save guard;
- the new recovered-review test exposed a real lifecycle/persistence race: an older active-session checkpoint could finish after the post-save clear, and a parent rerender could also retrigger persistence because the callback identity changed;
- active-session save/clear/reset mutations are now serialized and the live persistence callback is stable across parent rerenders, so a completed review cannot be re-persisted after its clear;
- adds a recovered-review browser journey that reloads before save, deliberately double-taps save and proves one history record remains after a second reload;
- adds notification-denial coverage proving denial does not block training and is not immediately re-prompted;
- adds a separate production-PWA Playwright gate that builds the real service worker and proves it installs/controls the app in Chromium/Pixel 7 and WebKit/iPhone 15 profiles;
- Chromium additionally proves an offline relaunch, offline save and reconnect cycle; Playwright WebKit cannot reliably emulate offline+reload and the real iPhone Airplane Mode check therefore remains manual;
- changes preview deployment to follow `main` rather than the obsolete `modern-app-shell-engine` branch.

The production-service-worker test does **not** clear the real installed-iPhone Airplane Mode gate; that remains manual evidence.


### PR #24 — Prevent iOS form focus zoom — merged

The first-run dog-name field was inheriting a 12px label size, triggering iOS Safari's focus zoom. Other controls also had sub-16px sizes.

Now:

- text/number inputs, selects and textareas use at least 16px;
- checkbox/radio controls are excluded;
- pinch-to-zoom remains enabled;
- mobile browser regression coverage fails if visible eligible controls fall below 16px.

This is an app-wide invariant. Preserve it.

### PR #23 — Danger-zone reset and restart onboarding — merged

`More` now contains **Danger zone → Reset SettledSolo**.

The reset:

- requires typing `RESET`;
- offers a backup first;
- clears dog/profile setup, training tracks, timed-session history, departure-cue progress and onboarding state;
- clears an active persisted session;
- clears legacy Threshold migration seed data so old data cannot reappear on reload/fallback;
- returns immediately to first-run onboarding;
- is covered by a reset + full reload browser regression journey.

This was added specifically so an existing user can rerun the new onboarding from scratch.

### PR #22 — Recover cached homepage hero failures — merged

Added recovery for stale/cached homepage hero-image failures after the hero asset/path changes.

### PR #21 — Evidence-led guided onboarding — merged

First-run setup is no longer just dog name + duration.

Current routing:

1. **Departure cues first**
   - used when getting-ready cues already cause watchfulness/concern/distress or the owner is unsure;
   - no real leaving is offered initially;
   - uses the existing departure-cue ladder.

2. **Micro-departure**
   - used when departure cues appear neutral but there is no known-comfortable absence;
   - starts with a **3-second observation**;
   - the exact 3 seconds is explicitly documented as a conservative SettledSolo product heuristic, not a clinically validated threshold.

3. **Known comfortable duration**
   - used only when the owner has already observed a calm absence;
   - that duration becomes the starting ceiling.

Other onboarding behaviour:

- no "find the maximum tolerance" test;
- camera/video observation is encouraged where practical;
- only onboarding version + resulting starting path are persisted, not every intake answer;
- existing users are not forced through onboarding;
- backup/restore preserves the onboarding route;
- cue-first users stay on a cue-practice Today screen until repeated calm final-doorway practice allows the first brief timed departure.

The exact cue-readiness rule is also a product heuristic and should remain labelled/documented as such.

### PR #20 — Homepage hero loading — merged

The public hero image path/loading/cache behaviour was improved:

- duplicate CSS background image removed;
- current WebP asset used directly;
- eager/high-priority loading/preload;
- immutable asset caching;
- faster reveal.

## Current product capability

The modern PWA currently includes:

- public marketing site plus `/app`;
- installable/offline PWA shell;
- first-run guided onboarding with three starting paths;
- local-first IndexedDB storage with localStorage/memory fallback;
- legacy Threshold migration;
- Today / Progress / History / More navigation;
- adaptive next-session recommendation engine;
- departure-cue practice ladder;
- configurable/variable warm-up departures;
- default four warm-ups for targets under 10 minutes;
- warm-ups capped at one minute and, for targets under two minutes, at no more than 50% of target;
- warm-up shuffle option;
- live departure timer with progress circle;
- timestamp-based reload/interruption recovery;
- behavioural outcome + observed-signal recording;
- session context tags including confinement/free-roam;
- daily main-departure ceiling;
- milestones/achievements and progress views;
- JSON backup/restore;
- CSV export;
- notification/chime/Media Session progressive enhancement;
- interactive iOS installation guide matching the current Safari menu → Share → Add to Home Screen flow;
- destructive reset/re-onboarding flow;
- Vitest + Playwright coverage;
- Chromium/Pixel 7 and WebKit/iPhone 15 CI profiles.

## Current behavioural/evidence position

Read `docs/EVIDENCE-BASE.md` before changing the training algorithm.

The core product position is:

- systematic/gradual desensitisation;
- keep planned exposure below meaningful distress;
- observe behaviour, not just elapsed time;
- target is a ceiling, not a quota;
- setbacks make the next plan easier;
- repeated difficulty can trigger support/rest guidance;
- departure cues can be practised separately without actually leaving.

Important distinction:

**Evidence-backed principle:** begin with exposure brief/easy enough not to provoke anxiety and progress gradually based on observed behaviour.

**SettledSolo heuristics:** exact 3-second micro-departure, exact progression increments, exact repeated-calm cue-readiness gate.

Do not blur those two categories in UI, marketing or documentation.

## Storage and data architecture

### Current private training data

The active app is local-first.

Primary store:

- IndexedDB database: `dog-training-app`
- app record key: `app-data`
- active-session key: `active-session`

Fallback:

- localStorage app key: `dog-training-app.fallback.v1`
- active-session fallback key: `dog-training-app.active.fallback.v1`

Legacy migration key:

- `threshold.v2`

The reset flow deliberately clears the legacy migration key as well as modern persisted state.

### Accounts / cloud data

Merged on `main`, deployed to preview, not yet activated. The normal Wrangler configs remain
unbound to account D1. Deployment generates a temporary config only when accounts are enabled
and validates distinct preview/production database IDs. Private account data stays separate
from the analytics Worker/database.

- Better Auth 1.7.5 + hashed email OTP, secure HTTP-only cookies.
- Generated auth migration + per-user sync records/change log with delete cascades.
- Same-origin auth, sync and account export/delete APIs; no-store/noindex responses.
- Stable mutation IDs, expected server revisions, tombstones and incremental cursor.
- Local sync metadata belongs to one account; changing accounts cannot silently upload it.
- Sign-out pauses sync; reset only clears the device; cloud deletion requires recent sign-in.
- Conflicts retain both versions and an exportable archive. Passkeys remain future work.

## Analytics and the "how many users?" requirement

The separate `cloudflare-worker/` event service currently accepts only:

- `app_open`
- `session_started`
- `session_saved`

It stores basic app/platform metadata only. It must not receive dog names, notes, outcomes, durations or training history.

**Current limitation:** app-open counts are not a trustworthy unique-user/member count because there is no persistent anonymous user/install identifier.

For the production roadmap distinguish:

- **registered members/users:** exact count from account D1 once accounts exist;
- **active registered users:** activity/last-active measure after account implementation;
- **anonymous installations/guest active users:** only countable if a privacy-conscious random installation ID is deliberately added and disclosed.

Do not advertise raw event totals as "users".

A private internal admin dashboard remains a planned item, ideally protected by Cloudflare Access rather than a custom app password.

Suggested future metrics:

- total registered accounts;
- new accounts 7/30d;
- active accounts 7/30d;
- anonymous installations if implemented;
- account conversion;
- onboarding completion;
- starting-path split;
- sessions started/saved/completed;
- departure-cue usage;
- sync/API reliability.

## Cloudflare/deployment position

Modern production config:

- Worker: `settledsolo-web`
- config: `wrangler.app.jsonc`
- canonical `SITE_URL`: `https://settledsolo.com`

Preview config:

- Worker: `settledsolo-web-preview`
- config: `wrangler.preview.jsonc`

Production deployment is **manual workflow dispatch** from `main` via `.github/workflows/deploy-production.yml`.

The production Worker:

- serves `dist-v2`;
- runs Worker-first;
- applies CSP/security headers;
- noindexes non-production hosts and `/app`;
- gives immutable caching to built assets / current hero asset;
- gives HTML `no-cache`;
- handles canonical www/non-www sibling redirect.

### Preview deployment

PR #26 changes `.github/workflows/deploy-preview.yml` so relevant pushes to `main` deploy the preview Worker. Manual dispatch remains available.

Production deployment remains manual. Do not make production auto-deploy merely to mirror preview.

## CI / verification

GitHub CI runs on pull requests and pushes to `main`.

Main commands:

```bash
npm install --ignore-scripts
npm run verify
npm run test:e2e
npm run test:pwa
```

`npm run verify` includes:

- JS syntax checks for retained legacy code;
- TypeScript check for `app-v2`;
- legacy regression suite;
- modern Vitest suite;
- modern production build;
- Cloudflare Worker dry-run;
- accounts-enabled Worker dry-run for both targets, using placeholder values.

The normal Playwright suite then runs against:

- Chromium / Pixel 7 profile;
- WebKit / iPhone 15 profile.

PR #26 also adds `npm run test:pwa`, which builds the production bundle and generated service worker. Both mobile profiles prove service-worker control; Chromium additionally verifies the full offline relaunch/save/reconnect cycle. Playwright WebKit's offline+reload emulation currently fails inside the engine itself, so real iOS Airplane Mode remains a physical-device gate.

Do not treat WebKit emulation as evidence of installed iPhone PWA lifecycle behaviour.

## Real-device release gates still open

See `docs/DEVICE-TEST-MATRIX.md` for the complete checklist.

Real iPhone evidence already recorded:

- active session survives switching apps;
- survives lock/unlock;
- survives close/reopen;
- chime was audible on the tested device.

Still important on iOS:

- real installed-PWA Airplane Mode relaunch + complete offline save (production service-worker behaviour is now covered automatically in PR #26, but real iOS lifecycle behaviour is not);
- real notification permission/denial behaviour;
- update prompt while an active session exists;
- duplicate warning/target chime behaviour across background/repeated sessions;
- Media Session/Control Centre behaviour where available;
- real-device confirmation that a recovered session saves exactly once (automated recovery/deduplication coverage is in PR #26).

Android installed-PWA testing is still largely open.

Desktop sanity checks are still open.

## Remaining behaviour-quality work

`docs/SA-QUALITY-ROADMAP.md` says items 1–4 are complete.

The smaller remaining item 5 includes:

- food/treat refusal as an optional seventh observed signal;
- a one-time "record the dog alone" pre-protocol observation step;
- a non-prescriptive vet/medication-adjacent support nudge after repeated stalled/distressed sessions.

These should be treated as separate, reviewable changes and remain evidence-aware.

## Public-beta/release work still outstanding

Before a broad public beta, remaining work includes:

- complete the physical-device release gates;
- qualified behaviour-professional review of wording/heuristics;
- feedback/contact route;
- final real product screenshots/social metadata;
- final account/privacy wording once auth/sync exists;
- confirm formal brand/trademark/domain readiness;
- small beta cohort and qualitative feedback.

Do not use training outcomes as an efficacy claim.

## Recommended next sequence

1. ~~Finish account-branch CI/review and merge the independently reviewed changes.~~ Done: PR #28.
2. ~~Provision isolated D1 databases~~ Done: both exist and are empty. Configuring verified
   email delivery and the remaining secrets is **the current blocking step** — it needs an
   email provider account with a verified sender, which cannot be created from an agent
   workspace. Then follow the activation order in `ACCOUNTS-DEPLOYMENT.md`, checking progress
   with **Verify account configuration**.
3. Activate preview only, then verify real OTP delivery and two-device sync/recovery.
4. Complete remaining physical-device and professional behavioural-review gates.
5. Finish smaller behaviour-quality and public-beta contact/privacy/assets work.
6. Activate production accounts only after preview evidence and release requirements are recorded.
7. Add user-count/admin metrics and optional passkeys after the baseline is stable.

## Known documentation debt

Several older documents were written before the latest merges.

In particular:

- `docs/NEXT-PHASE.md` still contains historical wording such as "Merge PR #11" and should not be used literally for current PR state.
- `docs/PRODUCT-PLAN.md` still describes some modern-app cutover work as future even though the current Cloudflare build uses `app-v2`.
- `README.md` contains long legacy development-history sections that are useful context but are not the best source for today's priority.

Use this handover as current status and update the older roadmap docs opportunistically when touching the relevant area.

## How the next agent should begin

Before making a change:

1. Read `AGENTS.md`.
2. Read this file.
3. Fetch current `main`, recent merged PRs and any open PRs.
4. Check whether this handover is still current.
5. Read the domain-specific document relevant to the task.
6. Branch from current `main`.
7. Keep the next PR focused.
8. Update this handover if the PR materially changes project state.

## Handover maintenance

After a meaningful merge, update at least:

- "What changed most recently";
- current phase;
- open PR/CI state;
- known release gates;
- recommended next sequence if priorities changed;
- architecture/data/deployment notes if affected.

The goal is that a fresh agent can continue the project from the repository alone, without needing the previous chat history.
