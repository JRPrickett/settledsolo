# SettledSolo handover

**Last updated:** 19 September 2026 (production hardening phase; PRs #34–#35 merged)
**Repository:** `JRPrickett/settledsolo`  
**Reviewed main:** `b58f6450f2e0b4d82649b8c3101867a9cbc3027e`

This is the current-state handover for another agent or contributor picking up SettledSolo. Read `AGENTS.md` first for repository rules.

## Executive status

PRs #34 and #35 are merged and green. PR #36 reduces CI spend by running Chromium/WebKit/PWA checks only for browser-impacting
changes, while fast verification continues broadly. The current hardening branch splits the
727-line `core-flow.spec.ts` into focused specs without changing the 23 existing journeys. The active development phase is **production hardening**:
reliability, recovery, security and flow correctness before discretionary feature work.
The physical-device and qualified behaviour-professional release gates still apply and remain open.

Accounts and sync are **merged and deployed to the preview Worker, but not activated**. The
merged implementation covers Better Auth email OTP, optional account UI, explicit guest-log
import, local outbox, revision-based incremental sync, recoverable conflicts, cloud
export/deletion and isolated account deployment tooling. Guest training remains usable offline.

Account activation remains a parallel gated track: its remaining work is provisioning and
configuration rather than implementation. Verified on `b58f645`:

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

Separately, `docs/SA-QUALITY-ROADMAP.md` **items 1-5 are now complete**, including all three of
item 5's sub-items. The behaviour-quality thread has no queued work; what remains there is the
qualified behaviour-professional review gate, not implementation.

See `ACCOUNTS-DEPLOYMENT.md` for the current state table and the ordered activation runbook,
and `ACCOUNTS-REVIEW.md` for review results, test coverage and outstanding real-device and
provider evidence.

## What changed most recently

### PR #34 — E2E TypeScript gate — merged

The browser specs are now typechecked during `npm run verify`, before Playwright browsers are
installed or launched. This closes the gap that allowed malformed merge-conflict resolutions in
`core-flow.spec.ts` to pass the fast verification stage. Final CI passed the fast verification,
Chromium/WebKit mobile journeys and production-PWA gate.

### PR #32 — Persistent-difficulty referral — merged

`docs/SA-QUALITY-ROADMAP.md` item 5's last sub-item, which completes items 1-5 of that roadmap.

The app already softened the plan and suggested a separation-anxiety specialist after a bad
patch. It had nothing for the case where difficulty persists and training alone is not shifting
it — the point at which real referral norms involve a vet.

- A second support tier above the existing one, deliberately harder to trigger: across the last
  ten sessions, at least three distressed, at least six not relaxed, and the current target no
  higher than at the start of the window. A bad week still gets the existing specialist
  suggestion, not this.
- It names a vet or veterinary behaviourist as the people qualified to assess whether something
  medical is contributing and to discuss medication alongside training. It never recommends,
  prescribes or implies a medication, and does not diagnose.
- Copy says "veterinary behaviourist" rather than DACVB, matching the rest of the product; the
  evidence base explains the credential and why this tier names a vet rather than a trainer.
- It supersedes the generic support card rather than stacking with it, and never raises
  difficulty — covered by tests.
- The window and counts are a **product heuristic, not a clinical threshold**; the evidence base
  says so explicitly, since no source establishes a number of difficult sessions after which
  veterinary input is indicated.

### PR #31 — Food/treat refusal signal — merged

`docs/SA-QUALITY-ROADMAP.md` item 5's first sub-item. A dog declining food it would normally
take is a practitioner-recognised sign of being above threshold, and the app recorded six
observed signs without it.

- Added as "Refused food or treats", optional like the other six, and appearing automatically
  in the live session, the manual session form, history chips and progress insights because
  those all derive from the shared signal list.
- Signal labels are now a `Record<ObservedSignal, string>`, so adding a signal to the union
  without a label is a compile error instead of a raw value leaking into the UI.
- Backup restore and the sync protocol now derive their allowlists from that same list rather
  than duplicating it. The sync schema had both a hardcoded six-value enum and a hardcoded
  `.max(6)` cap, either of which would have silently rejected a session carrying the new
  signal; both are now derived.
- Sourced to CSAT practitioner practice in the evidence base, explicitly not to a controlled
  study, and only meaningful when food was actually offered.

Adding the browser journey exposed a **pre-existing bug on `main`**: the history detail row
rendered only when a session had tags, a stop reason or a note, and never checked signals. A
session recorded with observed signs and nothing else therefore never displayed them, which
defeats the purpose of recording them. Fixed here and covered by the new journey.

### PR #30 — Pre-protocol observation step — merged

`docs/SA-QUALITY-ROADMAP.md` item 5's "record the dog alone" sub-item, from Bain (2025).
Confinement anxiety, noise sensitivity and incomplete housetraining can all look like
separation-related distress; one observation before training starts separates them cheaply.

- Offered on Today before a track's first timed departure, once only, and recorded whether the
  owner does it or skips it so it is never asked twice.
- Not offered while a cue-first plan still excludes real departures — asking those owners to
  leave would contradict the plan they were just given.
- Never blocks training: the start button stays available beside it.
- A camera is suggested but explicitly optional; listening from another room is offered as an
  equally valid alternative.
- Findings map to non-diagnostic guidance that names alternative explanations and, for a
  confinement observation, points at the existing free-roam comparison tags.
- Persisted as a versioned record on `AppData`, normalised on load, carried through
  backup/restore, and included in the synced mutation set.

The timing and the findings list are **product choices, not clinical rules**; the evidence base
records that distinction.

### PR #27 — Preserve fallback training data during storage recovery — merged

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

**PR #34 closed the E2E typecheck gap:** `npm run verify` now runs a dedicated
`app-v2/tsconfig.e2e.json` check covering the Playwright E2E spec files.
A malformed or type-invalid browser spec therefore fails in the fast verification job before
browser installation and execution. This specifically prevents the class of merge-conflict
breakage that escaped `verify` three times on 19 September 2026.

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

## Behaviour-quality roadmap status

`docs/SA-QUALITY-ROADMAP.md` items 1–5 are complete. There is no queued implementation
work in that roadmap. The remaining behaviour-related release requirement is a qualified
behaviour-professional review of the wording and heuristics already implemented.

Any new behaviour feature should start from fresh evidence/research rather than treating the
completed roadmap as an open backlog.

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

Use `docs/HARDENING-ROADMAP.md` as the active implementation roadmap.

1. ~~Close the E2E typecheck gap so broken Playwright specs fail during `verify`.~~ Done: PR #34.
2. ~~Pin the build Node version, use lockfile-strict `npm ci`, and establish the hardening roadmap.~~ Done: PR #35.
3. ~~Land targeted browser-CI gating so expensive browser/PWA checks only run for relevant changes.~~ Done: PR #36.
4. Split the large E2E spec into focused files and retain the same behavioural coverage. **In review.**
5. Add missing critical-flow journeys: history add/edit/delete, explicit early return and next
   plan, progress after mixed outcomes, backup export/restore round-trip, and settings flows.
6. Harden local storage/concurrency and browser-level account conflict recovery.
7. Complete PWA update-safety and the real iOS/Android/desktop device gates.
8. In parallel, configure verified email delivery and activate **preview accounts only**; then
   prove real OTP and two-device sync/recovery before production.
9. Clear the qualified behaviour-professional review and public-beta contact/privacy/assets gates.
10. Activate production accounts only after the hardening, preview and release evidence is recorded.
11. Add user-count/admin metrics and optional passkeys only after the baseline is stable.

## Known documentation debt

Several older documents were written before the latest merges.

In particular:

- `docs/NEXT-PHASE.md` still contains historical wording such as "Merge PR #11" and should not be used literally for current PR state.
- `docs/PRODUCT-PLAN.md` still describes some modern-app cutover work as future even though the current Cloudflare build uses `app-v2`.
- `README.md` contains long legacy development-history sections that are useful context but are not the best source for today's priority.

Use this handover for current status and `docs/HARDENING-ROADMAP.md` for the active implementation sequence. Update the older roadmap docs opportunistically when touching the relevant area.

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
