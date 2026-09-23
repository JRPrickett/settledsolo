# SettledSolo handover

**Last updated:** 23 September 2026 (real product screenshots and backup reminder on `claude/settledsolo-release-hardening-6xkd4v`)
**Repository:** `JRPrickett/settledsolo`  
**Reviewed main:** `ae1e760` (through PR #64 and PR #62)

This is the current-state handover for another agent or contributor picking up SettledSolo. Read `AGENTS.md` first for repository rules.


## Executive status

Main is current through PR #64 (and PR #62, legal/policy disclosures). PRs #52–#56 closed the
storage-fallback recovery gap, stale-tab cloud-export identity checks, competing-window protection
and the legacy product-analytics pipeline. Browser-heavy CI remains targeted to relevant changes.

The optional-account setup phase is **complete**. Accounts and sync are active in preview and
production with separate D1 databases, Better Auth email OTP, verified Resend delivery, local-first
sync, recoverable conflicts, cloud export/deletion and post-deploy verification. Guest training
remains local-first and usable offline.

The active development phase is **release hardening → small-beta readiness**. Remaining priorities
are real installed-device lifecycle evidence, real two-device sync/offline/conflict proof, the
remaining security/privacy checks and public-beta essentials. SettledSolo does not claim
professional review or endorsement. Avoid discretionary feature expansion until those release
gates are clear.

The custom product-event analytics Worker/database has been retired. Registered Better Auth
account totals are now the canonical user-count metric; an exact PWA-install count is not inferred
from persistent device identifiers.

See `SECURITY.md` for the threat boundaries, incident response and recovery runbook. Re-run
**Provision isolated account database** only when rebuilding an environment; it is idempotent and
reuses an existing database, so UUIDs are deliberately not recorded in this repository.

Separately, `docs/SA-QUALITY-ROADMAP.md` items 1-5 remain complete, with the 22 September
follow-up safety hardening now also applied. The remaining behaviour-quality release gate is
real-device testing; product heuristics remain explicitly labelled as heuristics.

### 23 September — real product screenshots and backup reminder (branch `claude/settledsolo-release-hardening-6xkd4v`)

Not yet merged at the time of writing; check GitHub for its PR state.

- **Real product screenshots.** The homepage "quiet guide" section showed hand-built CSS mock
  phones whose content had drifted from the app (wrong warm-ups, a count-up clock, old button
  copy). It now shows three real screens (Today, live departure, review) in phone frames, captured
  from the actual app with a sample dog and history by `npm run product:screens`
  (`scripts/render-product-screens.mjs`; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for a local
  Chromium). The JPEGs in `app-v2/public/screens/` are committed, carry descriptive alt text and
  load lazily; the default Workbox globs do not precache them. Re-run the script after visible UI
  changes to those screens.
- **Backup reminder for local-only logs.** Downloading a backup now records a device-local
  timestamp (`settledsolo.last-backup-at.v1`). When a log has 10+ saved sessions, is not syncing
  to an account, and has no backup in 30 days, Today's storage notice becomes a reminder with
  **Download backup** and **Remind me later** (14-day snooze,
  `settledsolo.backup-reminder-snoozed-until.v1`). Both keys are device-local and never exported,
  synced or restored. Thresholds are product choices, in `app-v2/src/data/backupReminder.ts`.
  Covered by unit tests and `e2e/backup-reminder.spec.ts`.
- **Roadmaps refreshed.** `HARDENING-ROADMAP.md` marks what PRs #59–#64 and this branch closed,
  and adds a ranked "Suggested further improvements" list (F1–F8).
- **Support-payments privacy.** When `VITE_SUPPORT_URL` is set, `/privacy` shows an "Optional
  support payments" section and the support card says who handles payment. The provider is
  named from the link's host (Ko-fi, Buy Me a Coffee, otherwise generic), and nothing appears
  when the link is unset. Owner action: set the variable on preview, check, then production.

### 23 September — social share cards, page metadata, adaptive steps and payments plan — merged (PR #64)

- **Share cards.** Branded 1200x630 PNG cards for home, help, resources and evidence live in
  `app-v2/public/social/` (other public pages use the home card). `npm run social:images`
  re-renders them and the 180x180 `apple-touch-icon.png` from HTML with the brand fonts, colours,
  doorway mark and hero photo (set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a local Chromium). The
  PNGs are committed; CI never renders them. The old share image was a WebP hero photo with no
  dimensions, and iOS ignored the SVG apple-touch-icon.
- **Server-side page metadata.** Link-preview crawlers never run JavaScript, so every public page
  previously shared as the homepage. `app-v2/src/public/pageMeta.ts` is now the single source of
  each page's title, description, card and alt text; the Worker replaces the `<!--seo-->` block
  in the served HTML with the requested page's tags (canonical only for public pages, none for
  `/app/` or not-found pages) and drops stale `content-length`/`etag`. The client router uses the
  same module. A Worker test fails if `index.html`'s default block drifts from the home metadata.
- **Training engine refinements (evidence-reviewed).** Steps are now proportional: 10% of the
  current duration, 1 s minimum, 2 min maximum, replacing fixed tiers that swung from 33% to 0.4%.
  Rationale: dogs time by ratio and need ~44-94% differences to discriminate durations (Cliff &
  Jackson 2019), so 10% steps stay imperceptible. A relaxed session with stress signs ticked now
  holds the plan, and 7+ days without a timed session restarts one step easier (spontaneous
  recovery). Increases adapt to the last 10 sessions: 5% after any struggle, 10% normally, 15%
  after 5+ clean relaxed in a row (percentile-schedule shaping, Galbicka 1994); step-downs stay
  at 10%. All values are labelled heuristics; see `EVIDENCE-BASE.md`.
- **Payments plan.** `docs/PAYMENTS-PLAN.md` compares Ko-fi, Buy Me a Coffee, Paddle, Stripe
  Managed Payments, Lemon Squeezy and standard Stripe for a UK seller. It recommends Ko-fi for
  optional support now (via `VITE_SUPPORT_URL`), and Paddle as merchant of record for any later
  paid add-ons, because a UK seller owes EU VAT from the first EU consumer sale. Nothing is
  implemented; owner decisions are listed there.
- **After deploying:** re-scrape the home, help, resources and evidence URLs in the Facebook
  Sharing Debugger and LinkedIn Post Inspector (both cache previews), and check an X/Slack/WhatsApp
  preview once.

### 23 September — storage-drift fix and browser-CI discipline — merged (PR #63)

- **Divergent-store data loss fixed.** After any IndexedDB failure, the repository saves only to
  the localStorage fallback for the rest of that page; on the next load IndexedDB's older record
  won and those changes were silently lost (reproduced deterministically: rename a track while
  IndexedDB fails, reload, the name reverts). The fallback now records when its app data was
  written (`dog-training-app.fallback.savedAt.v1`, beside the unchanged AppData JSON), and
  `loadAppData` keeps the fallback when it is newer than the IndexedDB record's `updatedAt`,
  promoting it back into IndexedDB. Older installs without the stamp keep the previous behaviour.
  This closes the "divergent populated stores" gap noted under PR #27 and is the likely cause of
  the intermittent CI failure in `behavior-guidance.spec.ts` › one-time observation.
- **Browser CI is explicit.** Each CI run's summary states "Browser checks: running/skipped" with
  the triggering files, and notes that every push to a browser-impacting PR re-runs the ~5 minute
  suite. `AGENTS.md` now requires local runs of affected specs (repeat new/changed specs ≥10),
  persistence-aware reload specs, batched pushes and listing locally run specs in the PR.

### 23 September — cue practice and sync-conflict pass — merged (PR #61)

- **Cue practice is resumable.** An unfinished set is checkpointed after every rep to the
  device-local key `settledsolo.cue-practice.v1` (`session/cueCheckpoint.ts`), tied to its track
  and cue, and resumes on the next launch. It expires after two hours, is validated on load, is
  ignored when a newer set was already saved (app killed between save and clear), is cleared by
  reset and backup restore, and is never synced or backed up.
- **Cue practice discard/double-save.** Close with recorded reps now confirms (defaulting to keep);
  an untouched set closes immediately. Save has an in-flight guard; before this a fast double tap
  recorded the set twice.
- **Browser-level sync conflicts (H3).** `sync-conflicts.spec.ts` runs two browser contexts against
  the shared mock account server: concurrent edits of one session raise a review instead of
  overwriting, keep the local edit until resolved, archive both versions and converge; a session
  deleted on one device and edited on another can be kept and returns to the deleting device.
  The mock server and sign-in helpers now live in `e2e/accountHelpers.ts`.
- **Readable conflict review.** The conflict card showed a raw record key and JSON. It now titles
  the record and lists both versions in plain language (`account/conflictSummary.ts`); the full
  versions stay in the downloadable conflict archive. "1 changes need your review" plurals fixed.
- This is still mock-server evidence. Real two-device sync against the live Worker/D1 remains a
  release gate.
- **Milestones follow targets.** Milestones, "longest relaxed" and achievement totals now credit
  `min(actual, target)` (`creditedSeconds`), so forgetting to tap "I'm back" can no longer award
  several rungs in one session. History keeps the real duration; the plan already capped at the
  target. See the evidence-base product rule.
- **Walk-back reminders.** Push, chime and a "Time to head back" label fire a device-local walk-back
  time before the main target (More → Return alerts; default 30s, capped at a quarter of the
  target, none under 20s; `session/walkBack.ts`). Returns inside that window are not early stops
  and credit the full target. The push notification now reads "Time to head back". See the
  evidence-base product rule.
- **Overrun correction.** When the timer ran at least max(30s, 25% of target) past the target, the
  review offers "I was back on time" (`CORRECT_MAIN_RETURN`, can only lower the time, survives a
  reload, undoable). `return-timing.spec.ts` uses Playwright's fake clock for these journeys.
- **Milestone ladder** grows from 14 to 20 rungs, 10 seconds to 4 hours: 10s, 15s, 30s, 1m, 2m,
  3m, 5m, 10m, 15m, 20m, 30m, 45m, 1h, 75m, 90m, 2h, 2.5h, 3h, 3.5h, 4h. Early rungs are close
  together for dogs starting from seconds. Earned rungs are derived from history, so existing
  users gain the new rungs retroactively with no data migration.
- **Live timer.** The countdown overflowed the ring on phones ("00:02" ~257px in a ~213px ring,
  and "+00:04" wrapped). The clock is now `m:ss`/`h:mm:ss`, sized from the ring with container
  units and its character count, and never wraps. The ring fills smoothly from the start
  timestamp via `requestAnimationFrame`, stepping once a second under reduced motion. The
  Android/desktop return-alert prompt on the pre-departure screen was unstyled and is now styled.
  `live-timer.spec.ts` measures fit (including `2:00:00`) and smoothness.

### 23 September — accessibility and session-safety pass — merged (PR #60)

- **Discard protection.** Close (review) and End session (departure, settle break, practice
  check-in) previously discarded the whole session in one tap even after the dog had been
  left. Once any real departure has happened (`hasRealDeparture` in `sessionMachine.ts`),
  ending opens a confirmation that defaults to keeping the session. An untouched session still
  closes immediately. A deliberately discarded session is not saved and so does not use a
  daily-limit allowance.
- **Unreadable history notes fixed.** The History editor's note field inherited the dark review
  screen's near-white text on a light surface (1.06:1 contrast).
- **Navigation contrast/size.** Bottom-nav labels went from 10px at 3.3:1 to 12px at 5.3:1 with
  48px touch targets; account-notice text and button also now meet 4.5:1.
- **Progress chart semantics.** The chart is a labelled group (it contains focusable bars), the
  filters are `aria-pressed` toggles rather than tabs without panels, and the selected-bar caption
  is announced.
- **Scroll reset.** Switching tabs, or returning from a session/cue practice/account view, starts
  at the top of the new screen instead of keeping the previous screen's offset.
- **Stale copy.** Progress no longer promises what "the production app will" do; it explains how
  logged signs feed the observation summary.
- `accessibility.spec.ts` now runs axe on public info pages, a full session, Progress, History,
  the history editor, More and an early distressed review.
- The cue-practice gaps noted here were closed in the following pass.

### 22 September — release-hardening pass — merged (PR #59)

- **Live-session bug fixed.** On Android/desktop, the first "I'm leaving now" tap awaited the
  browser notification prompt *before* starting the timer. An owner who walked out with the
  prompt still open had no running departure. The timer now starts synchronously on the tap;
  permission is still requested within the same gesture and push scheduling waits for the
  answer. A pending alert is flagged cancelled when the departure ends, so a late "granted"
  cannot schedule a return alert for a finished departure. Regression-tested; the existing
  reload-recovery journey failed consistently in the authoring environment's Chromium because
  of this, where its prompt takes about a second to resolve.
- **Error screen rescue.** The app error boundary now offers "Download a backup first", reading
  persisted storage directly because the React tree holding the data has failed. Browser
  coverage forces a render failure, checks the backup contents and proves reload recovers.
- **Contact/feedback.** New `/contact` page and More → Help & feedback card (help, resources,
  evidence, privacy, terms, contact). The inbox comes from `VITE_CONTACT_EMAIL`; while it is unset
  the page and links still show the self-service routes but no email address or send button. The feedback email template carries only app mode, storage mode and browser
  string, editable before sending, never the dog name or training record.
- **Build-time links wired.** `VITE_SUPPORT_URL` was documented but never passed by either deploy
  workflow. Both workflows now read `VITE_SUPPORT_URL` and `VITE_CONTACT_EMAIL` from GitHub
  environment variables in the build ("Verify product") step. Cloudflare direct builds need the
  same variables set in the Cloudflare build settings if that path is used.
- **Real 404s.** Unknown public paths render a not-found page (noindex, no canonical) and the
  Worker returns status 404 instead of a 200 duplicate of the homepage. `app-v2/src/public/routes.ts`
  is the single public-route list used by the router, Worker and service-worker offline allowlist.
- **CSP tightened and executable.** `style-src 'unsafe-inline'` is removed. The CSP lives in
  `worker/csp.ts` and the vite preview server sends it, so `npm run test:pwa` now includes
  `csp.spec.ts`, which fails on any `securitypolicyviolation` across public pages and a full
  training session. That gate exposed Zod's `new Function` probe firing on every page; Zod now
  runs in `jitless` mode.
- **Long names.** Long unbroken dog/track names or notes previously widened the mobile layout and
  pushed the bottom navigation off-screen. App text now wraps and the header name chip truncates.
- HTML-like imported text is covered by a browser test proving it renders inertly as text.

Local evidence: `npm run verify` green; full Chromium Playwright suite and Chromium PWA/CSP gate
green. WebKit could not run in the authoring environment, so the WebKit/iPhone profile relies on CI.

### 22 September — warm-up and red-flag safety hardening

The live session now records every real warm-up departure before allowing the next step. A
relaxed warm-up moves to the settle break; concern or distress ends the session before the main
departure and saves the shorter observation. Warm-up reviews persist with the saved session,
backup/restore and account sync.

The app now recognises self-injury, escape attempts and destructive escape behaviour as high-risk
signals. Any such signal pauses timed training and points the owner to a vet or qualified
behaviour professional instead of waiting for the normal repeated-difficulty threshold.

The one-time pre-protocol observation is no longer offered to known-duration users and its copy
requires an already-safe absence; it does not ask owners to leave for a few minutes to discover
a limit. Today Shuffle now changes the order of a fixed bounded warm-up set, and the daily
ceiling is described as a SettledSolo safety limit rather than clinical dosage.

### 22 September — beta-readiness UX, owned resources and SEO

The history editor now reflows inside narrow mobile viewports, keeps form controls at a usable
touch-target size and exposes an explicit, confirmed delete action from the history row as well
as the editor. Desktop live sessions keep the “I'm back” control visible after the warm-up target
is reached. The public site now has owned resources/FAQ content, canonical SEO metadata, a sitemap
and a beta roadmap. No named external commercial training site is linked or presented as an
affiliation. Monetisation remains a later product decision with a free core.

See `ACCOUNTS-DEPLOYMENT.md` for the current state table and the ordered activation runbook,
and `ACCOUNTS-REVIEW.md` for review results, test coverage and outstanding real-device and
provider evidence.

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

This handles an empty primary store. (Superseded 23 September: newer fallback data now wins over
an older IndexedDB record; see the storage-drift fix.) It deliberately does **not** reconcile two already-divergent
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
- configurable warm-up departures with an explicit outcome check for every real practice step;
- default four warm-ups for targets under 10 minutes;
- warm-ups capped at one minute and, for targets under two minutes, at no more than 50% of target;
- Today-page Shuffle, which changes the order of a fixed bounded warm-up set;
- live departure timer with progress circle;
- timestamp-based reload/interruption recovery;
- behavioural outcome + observed-signal recording, including high-risk escalation;
- session context tags including confinement/free-roam;
- daily timed-session ceiling;
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
work in that roadmap. The product maintains an evidence/heuristic boundary and does not claim
professional review or endorsement.

Any new behaviour feature should start from fresh evidence/research rather than treating the
completed roadmap as an open backlog.

## Public-beta/release work still outstanding

Before a broad public beta, remaining work includes:

- complete the physical-device release gates;
- publish the owned resources/FAQ/cheatsheet and complete the SEO pass;
- ~~feedback/contact route~~ done in the release-hardening pass; set `VITE_CONTACT_EMAIL` to open the inbox;
- ~~final real product screenshots/social metadata~~ done (PR #64 cards/metadata; screenshots in the release-hardening branch after it);
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
6. ~~Browser-level sync-conflict assertions~~ done (mock server); real two-device evidence remains in step 5.
7. Set `VITE_CONTACT_EMAIL` (and `VITE_SUPPORT_URL` when a provider is confirmed) as GitHub
   environment variables, then clear accessibility and final privacy/provider wording (Phase 1 of
   `docs/PAYMENTS-PLAN.md` adds a Ko-fi line to the privacy notice).
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
