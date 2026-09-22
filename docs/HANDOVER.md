# SettledSolo handover

**Last updated:** 22 September 2026 (account phase complete; hardening/beta-readiness handover)
**Repository:** `JRPrickett/settledsolo`  
**Reviewed main:** `bf5fbec` (through PR #55, before this documentation merge)

This is the current-state handover for another agent or contributor picking up SettledSolo. Read `AGENTS.md` first for repository rules.


## Executive status

Main is current through PR #55 before this documentation refresh. PRs #52–#55 closed the
storage-fallback recovery gap, stale-tab cloud-export identity checks, competing-window protection
and the legacy product-analytics pipeline. Browser-heavy CI remains targeted to relevant changes.

The optional-account setup phase is **complete**. Accounts and sync are active in preview and
production with separate D1 databases, Better Auth email OTP, verified Resend delivery, local-first
sync, recoverable conflicts, cloud export/deletion and post-deploy verification. Guest training
remains local-first and usable offline.

The active development phase is **release hardening → small-beta readiness**. Remaining priorities
are real installed-device lifecycle evidence, real two-device sync/offline/conflict proof, the
remaining security/privacy checks, qualified behaviour-professional review and public-beta
essentials. Avoid discretionary feature expansion until those release gates are clear.

The custom product-event analytics Worker/database has been retired. Registered Better Auth
account totals are now the canonical user-count metric; an exact PWA-install count is not inferred
from persistent device identifiers.

## PR #41 — native background return alerts — merged

The current branch replaces the iOS silent-audio/Media Session workaround that generated a
two-second silent WAV, looped it and continuously updated Media Session position. That approach
kept the page alive more often, but made SettledSolo appear as a media player on the Lock Screen
and produced unstable/jumpy playback progress.

The replacement keeps the actual training state unchanged and timestamp-derived:

- foreground warning/target chimes still use Web Audio after the user's departure tap;
- Screen Wake Lock remains best-effort while the PWA is visible;
- SettledSolo no longer creates a looping audio element or claims Media Session ownership;
- the **main departure target** can schedule one native background reminder using standards-based
  Web Push;
- a Cloudflare `ReturnAlertScheduler` Durable Object stores only the push endpoint, anonymous
  installation ID mapping, opaque session token and target timestamp until delivery/cancellation;
- the Web Push request intentionally carries no payload. The scheduler receives the push endpoint,
  opaque identifiers and target timestamp, but no dog name, note, outcome or training history;
- the generated service worker displays **Time to come back**; it requests sound when SettledSolo
  is backgrounded and stays silent when a visible app window is present so the foreground chime
  is not doubled;
- returning early asks the scheduler to cancel the pending alarm, and push TTL is limited to
  60 seconds to reduce stale delivery;
- failure to configure, subscribe, schedule or deliver push never blocks starting, returning from
  or saving a local session.

The preview deployment after merge completed successfully. It created both VAPID Worker secrets automatically and the deploy workflow remained green. The deploy path provisions a stable VAPID key pair automatically the first time either key
is missing, while preserving existing keys on normal deployments. `npm run push:keys` remains a
manual recovery utility; see `docs/PUSH-ALERTS-SETUP.md`. Real installed-iPhone
 delivery/cancellation and duplicate-sound behaviour remain a physical-device release gate; do
not treat automated WebKit as proof.

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

### 21 September — account export identity guard (merged, PR #53)

Branch `fix/account-export-identity` closes a stale-tab gap found in the post-account
security review of main `8116985`. The UI already sends its displayed account ID when
exporting; the API now requires it to match the authenticated session before reading
private records. A missing/mismatched ID returns a private/no-store 409 response without
user or training data. Sync and deletion already enforced this check.

Local Worker TypeScript and `npm run test:accounts` pass (11 Worker tests, plus account
tooling tests), including both directions of a two-account mismatch, missing identity,
and the existing successful complete export. GitHub fast CI remains the review gate.
No schema, cookie, UI or deployment changes; browser checks are not required for this
server-only guard. This does not replace real two-device release evidence.


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

Active in both preview and production. Preview and production use distinct account D1 databases;
the production Wrangler config carries the live non-secret account bindings so direct Cloudflare
repository builds cannot silently disable accounts. Secrets remain Worker/GitHub environment
secrets. Private account data stays within the isolated account databases; no separate
product-event analytics database is used.

- Better Auth 1.7.5 + hashed email OTP, secure HTTP-only cookies.
- Generated auth migration + per-user sync records/change log with delete cascades.
- Same-origin auth, sync and account export/delete APIs; no-store/noindex responses.
- Stable mutation IDs, expected server revisions, tombstones and incremental cursor.
- Local sync metadata belongs to one account; changing accounts cannot silently upload it.
- Sign-out pauses sync; reset only clears the device; cloud deletion requires recent sign-in.
- Conflicts retain both versions and an exportable archive. Passkeys remain future work.

## Usage metrics and the "how many users?" requirement

The custom `threshold-events` Worker / `threshold-analytics` D1 product-event pipeline is
retired. The modern app does not need app-open, session or device-level telemetry to operate.

**Canonical user metric:** registered Better Auth accounts. Use the manual
**Count registered accounts** GitHub workflow (production or preview), or run
`npm run accounts:count -- production` with the Cloudflare credentials and D1 IDs available.
The query returns only a count from Better Auth's `user` table.

An exact cross-platform PWA-install count is not available from browser APIs, so SettledSolo
does not manufacture one with a persistent installation identifier. Cloudflare Web Analytics
may still provide directional aggregate web traffic where enabled, but that is not the same as
registered users or installed apps.

After this cleanup is merged, the unused `threshold-events` Worker and
`threshold-analytics` D1 database can be deleted from Cloudflare after any final export worth
keeping.

## Cloudflare/deployment position

Modern production config:

- Worker: `settledsolo`
- config: `wrangler.app.jsonc`
- canonical `SITE_URL`: `https://settledsolo.com`

The previous `settledsolo-web` app name is retired and must not be used as a
deployment target. The retired `threshold-events` Worker is not part of the modern app.

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

1. ~~Storage fallback/recovery and actionable backup messaging.~~ Done: PR #52.
2. ~~Reject stale-tab cloud exports after an account switch.~~ Done: PR #53.
3. ~~Protect training/sync from competing app windows.~~ Done: PR #54.
4. ~~Retire legacy product analytics and replace it with registered-account counts.~~ Done: PR #55.
5. Complete real installed iOS/Android lifecycle checks and real two-device sync/offline/conflict evidence.
6. Finish the remaining browser-level conflict/recovery and security/privacy assertions.
7. Clear qualified behaviour-professional review plus feedback/contact, accessibility, product
   screenshots and final social/privacy/provider wording.
8. Start with a deliberately small invited beta and measure adoption/reliability without efficacy claims.


## Known documentation debt

The roadmap documents now reflect live account activation and the move to beta readiness.
`README.md` still contains long legacy development-history sections that are useful context but
are not the best source for today's priority.

Use this handover for current status and `docs/HARDENING-ROADMAP.md` for the active implementation
sequence.

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

## 21 September 2026 — post-account storage recovery pass (merged, PR #52)

Reviewed main `8116985`: production and preview deployment runs and CI passed. Accounts
are active. PR #51 (`docs/complete-account-phase`) remains open and owns the broad
roadmap/status refresh; its changes are not yet on main. Open PRs #44–#46 are GitHub
Actions major-version dependency updates. No competing runtime hardening PR was open.

Branch `fix/storage-fallback-recovery` addresses the next H3 recovery gap:

- retain the latest successful IndexedDB read in the fallback, including account ownership,
  unsynced changes and a recovered active checkpoint;
- report storage-mode changes from all repository operations, including timer checkpoints;
- show an actionable recovery notice across app screens and training, with saved-data backup;
- withhold the PWA update notice while data is only in memory, to avoid inviting a data-losing reload.

No D1 migration, remote data mutation, auth change or deployment is involved. Guest/offline
training and training recommendations are unchanged. JSON backups still exclude sync ownership.

Local TypeScript, unit/legacy/Worker tests and production build passed (115 modern tests and
11 Worker tests). Browser installation failed against the Playwright CDN, so the two new
real-storage browser journeys require GitHub CI. Worker dry-run verification is being checked
separately; do not treat a partial local verification run as the complete release gate.

Next: review CI for this PR, then complete multi-tab/live-session ownership policy and
real-device/two-device account evidence. Broader roadmap priorities remain in PR #51.

## Single-window training guard — merged PR #54

PR #54 adds an app-entry guard before repository/account hooks mount. Only a window holding
`settledsolo-app-window` can run the app. A competing window presents a return/close/retry flow,
then mounts fresh and reads current persisted data. No timeout, hidden-tab takeover or forced
handover is used. Missing or denied Web Locks requires an explicit one-window compatibility
confirmation; that mode retains local serialization but cannot guarantee cross-window exclusion.

Unit/browser coverage verifies ownership lifetime, contention, cleanup/Strict Mode, no account
traffic from blocked windows, latest-data handover, timer recovery and one saved session. Installed
phone lifecycle testing remains outstanding.

Next: record real installed-device window/suspension checks, then harden real two-device sync
conflicts/reconnect. Do not treat the local-window policy as cross-device coordination or proof of
all PWA update/notification gates.
