# SettledSolo production hardening roadmap

**Date:** 21 September 2026 · **Last reviewed:** 23 September 2026 (through PR #64 plus the open
release-hardening branch)
**Phase:** Production hardening  
**Status:** Accounts active; automated hardening H1–H3 and H6 substantially complete (PRs #52–#64);
real-device, live two-device and small-beta evidence still pending
**Goal:** Freeze discretionary feature work and make the existing product reliable, recoverable, secure and predictable enough for a small public beta.

The behaviour-quality roadmap in `SA-QUALITY-ROADMAP.md` is complete. This roadmap is deliberately about **how the product behaves under failure, interruption and real use**, not about adding more training features.

## Release principles

A hardening change should improve at least one of these guarantees:

1. **No silent training-data loss.**
2. **A live session never silently restarts, disappears or saves twice.**
3. **Offline/network/account failure never blocks local training.**
4. **A destructive action is explicit and its scope is clear.**
5. **Recovery paths are tested, not merely documented.**
6. **State-dependent copy tells the truth about where data is stored and synced.**
7. **CI catches syntax, type, lockfile and configuration mistakes before deployment.**
8. **Security controls fail closed without exposing training content or secrets.**

New product features should wait unless they directly close a release blocker found during this work.

## H1 — CI and build determinism

**Release blocker. Do first.**

- Add a dedicated TypeScript check for Playwright E2E specs so malformed browser tests fail in the fast verification job. Done in PR #34.
- Pin the Node version in `.node-version` and make GitHub workflows consume that file. Cloudflare Workers Builds also supports `.node-version`, so direct builds and GitHub builds can use the same runtime. **Done: CI and both deploy workflows use `node-version-file: .node-version`.**
- Use `npm ci --ignore-scripts` in CI and deploy workflows rather than `npm install`, so a stale or inconsistent lockfile fails immediately. **Done.**
- Split the large `core-flow.spec.ts` into focused specs (onboarding, session lifecycle, history/data, behaviour guidance, install/public) to reduce merge-conflict risk. **Done: PR #37.**
- Keep the expensive Chromium/WebKit/PWA job targeted: run it on browser-impacting PRs, on browser-impacting direct pushes to `main`, and on explicit manual full-CI runs. Do not repeat it on the `main` merge push after the same PR already passed.
- Browser-impacting paths include runtime/frontend/PWA files, E2E specs, root dependency manifests and `.node-version`. Unit-test-only changes under `app-v2/src/**` stay on fast Vitest/type/build verification and do not download browsers.
- Upload Playwright traces/screenshots on browser-test failure, not only account review screenshots. **Done: PR #61.**
- State in every CI run why the browser suite ran or was skipped, and require local repeated runs before pushing browser-impacting changes. **Done: storage-drift PR (`AGENTS.md` §6).**
- Keep production deployment manual and preview deployment gated by the same fast verification commands as CI.

**Exit:** the same commit installs deterministically and passes TypeScript, unit, Worker dry-run, mobile browser and production-PWA checks before it can be considered releasable.

## H2 — Critical user-flow coverage

Add browser-level proof for flows that exist in the product but are not yet covered end to end.

- Manual history add, edit and delete. **Done: PR #38.**
- Explicit early return from a timed departure, save, and resulting next-plan behaviour. **Done: PR #38.**
- Progress screen after a mixture of relaxed / concern / distressed sessions. **Done: PR #38.**
- Backup **export + restore round-trip**, not restore alone. **Done: PR #38.**
- Track/scenario settings: duration entry, minutes/seconds handling, warm-up count, shuffle and rest settings. **Done: PR #38.**
- Navigation after save/recovery so a completed session cannot reappear as active. **Done: `session-lifecycle.spec.ts` (recovered review saves once; a saved return is not undone by an older checkpoint, PR #63).**
- Error-boundary fallback and successful reload/recovery. **Done: release-hardening PR (22 Sept) — the error screen also downloads a saved-data backup.**
- Account-aware copy: local-only users and connected users must not be told contradictory things about backup/sync. **History copy fixed in PR #38; the backup reminder only appears for logs that are not syncing (release-hardening branch).**
- Discarding a session after a real departure, or a cue-practice set with recorded reps, asks first and defaults to keeping it. **Done: PRs #60 and #61.**
- A pending notification prompt never delays the departure timer. **Done: PR #59.**

**Exit:** every primary screen and every destructive/data-changing action has at least one realistic browser journey.


## H3 — Storage, recovery and concurrency

This is a high-risk product area because failures can lose trust even when the training logic is correct.

Already protected: reload recovery, fallback-to-IndexedDB promotion, expired-checkpoint rejection,
save deduplication, offline local save, storage-failure backup/recovery messaging and single-window
write ownership.

Still harden:

- multiple tabs/windows policy and enforcement; **Done: PR #54; see `MULTI-WINDOW-SAFETY.md`.**
- rapid repeated add/edit/delete cannot overwrite newer local data; **Done: PR #40.**
- corrupted/partially valid stored data normalises/falls back safely; **Done: PR #40.**
- storage-write failure preserves the last durable snapshot and surfaces recovery/backup actions; **Done: PR #52.**
- backup restore never imports authentication/sync ownership from another account; **Done: PR #40.**
- add browser-level sync conflict resolution for concurrent edit/delete cases, not only model tests; **Done: `sync-conflicts.spec.ts` (mock account server); live two-device evidence remains under H5.**
- prove sign-out, local reset and cloud deletion remain distinct operations; **Done: PR #40.**
- divergent IndexedDB/fallback stores cannot revert newer changes on the next load; **Done: PR #63 (`dog-training-app.fallback.savedAt.v1`, newest copy wins).**
- an interrupted cue-practice set resumes instead of being lost; **Done: PR #61 (`settledsolo.cue-practice.v1`).**
- local-only owners with real history are reminded to keep an off-device backup; **Done: release-hardening branch (10+ sessions, no sync, no backup in 30 days; 14-day snooze).**

**Exit:** interruption, concurrency or malformed local state cannot silently discard a completed session.

## H4 — PWA and device lifecycle

Automated PWA coverage remains necessary but is not enough for installed mobile behaviour.

- Prove update UI is never actionable during a live session or cue-practice session. **Structurally true: `App.tsx` returns the live-session and cue-practice views before `PwaUpdateNotice` renders. Still needs a browser regression that simulates a waiting service worker mid-session.**
- Test old-build/new-service-worker transitions on preview without forcing a live-session reload.
- Complete installed-iPhone Airplane Mode relaunch and offline save.
- Replace the looping silent-audio/Media Session workaround with standards-based Web Push for the main return point. **Done: PR #41. Preview deploy auto-provisioned its VAPID pair successfully; physical-device evidence is still required.**
- Complete iOS notification permission/denial, background delivery/cancellation and duplicate-chime checks, including the walk-back "Time to head back" lead time added in PR #61.
- Confirm the installed PWA no longer exposes fake media-player controls in Lock Screen / Control Centre.
- Complete the Android installed-PWA matrix.
- Run desktop sanity checks for first run, session, history, backup/restore and track switching.
- Record device, OS, browser/PWA mode, commit and result in `DEVICE-TEST-MATRIX.md`.

**Exit:** the real-device matrix contains evidence for iOS and Android, with any OS limitation explicitly documented rather than assumed away.


## H5 — Account and sync operational validation

**Activation/setup complete.** Preview and production have isolated D1 databases, Better Auth
email OTP, verified Resend delivery, account/sync bindings, migrations, secrets and live
post-deploy endpoint verification. PRs #49 and #50 hardened the production deployment path and
fixed the verifier's expected account state.

Remaining work here is release evidence rather than provisioning:

- verify expiry, wrong/expired codes and resend/rate-limit behaviour on the live provider;
- verify real two-device initial import, incremental sync, offline save/reconnect and conflict recovery;
- verify stale-tab account checks on sync/export/delete;
- verify cloud export completeness;
- verify account deletion requires recent auth and typed confirmation while leaving local copies untouched;
- document provider retention/backups and final privacy wording before broad beta.

**Exit:** live account behaviour has been exercised across two real devices and failure/recovery
paths without losing, duplicating or leaking training data.

## H6 — Security and privacy verification

The Worker already has a strong baseline: same-origin checks, secure cookies, request-size limits, route allowlists, database-backed auth limits, an edge rate limiter, private/no-store API responses, CSP/HSTS and no request-body logging.

Hardening work:

- add regression assertions for security headers on public, app and API responses; **Done in the passwordless/security hardening PR.**
- test rejected origin/method/content-type/oversized requests; **Done in the passwordless/security hardening PR.**
- test that user-provided/imported HTML-like text is rendered as text and cannot execute; **Done: release-hardening PR (22 Sept).**
- confirm preview/app/API noindex behaviour; unknown public paths now return a real 404 with noindex; **404 done in PR #59; per-page metadata is now written by the Worker (PR #64).**
- keep workflow permissions minimal and secrets out of logs/generated config; **Step-scoped secrets and immutable action revisions added in the passwordless/security hardening PR.**
- review dependencies and keep lockfile-driven installs reproducible; **Dependabot configuration added; lockfile installs retained.**
- confirm the retired product-event analytics pipeline has not been reintroduced; **Retirement completed in PR #55; keep this as a regression boundary.**
- review CSP exceptions such as `style-src 'unsafe-inline'` before beta and retain only what the UI requires. **Done: `'unsafe-inline'` removed; the production-bundle PWA gate now runs under the Worker's CSP and fails on any violation (this also removed Zod's eval probe).**

**Exit:** known security boundaries are executable tests where practical, not just assumptions in documentation.

## H7 — Public-beta readiness

Only after the reliability gates above are substantially green:

- add a clear feedback/contact route; **Done: `/contact` and More → Help & feedback. Set the `VITE_CONTACT_EMAIL` GitHub environment variable to show the inbox.**
- finalise privacy/account/provider wording; **the support-payments privacy section is done and the Ko-fi link is live.**
- replace stale local-only/account-coming-later copy wherever account state can differ;
- publish the owned resources/FAQ/cheatsheet pages and final SEO metadata; **metadata done: per-page titles, descriptions and share cards served in the HTML (PR #64).**
- add final real product screenshots and social-share image metadata; **Done: share cards in PR #64; real app screens on the homepage via `npm run product:screens` (release-hardening branch).**
- confirm brand/domain/trademark readiness;
- choose a payments approach; **Done as a plan: `PAYMENTS-PLAN.md` (Ko-fi support now, merchant-of-record provider later). Nothing paid is implemented.**
- invite a small beta cohort and record qualitative failures/friction before widening access.

Do not use training outcomes as an efficacy claim.


## Immediate order

1. ~~E2E typecheck, reproducible builds, targeted browser CI and spec split.~~ Done: PRs #34–#37.
2. ~~Critical-flow browser coverage and repository storage/concurrency baseline.~~ Done: PRs #38 and #40.
3. ~~Storage-failure recovery, stale-tab export identity, single-window ownership and analytics retirement.~~ Done: PRs #52–#55.
4. Complete installed iOS/Android lifecycle gates, including update/notification/background-return
   and walk-back reminder evidence.
5. Complete real two-device sync/offline/conflict and live OTP/rate-limit checks.
6. ~~Browser-level sync conflict/recovery and security/privacy assertions.~~ Done: PRs #59, #61
   and #63 (mock account server; live evidence stays in step 5).
7. ~~Contact route, share assets, page metadata and product screenshots.~~ Done: PRs #59, #64 and
   the release-hardening branch, including the support-payments privacy section. Still open:
   final account/provider wording review and a manual screen-reader pass (see F3 below).
8. Begin a deliberately small invited beta, then widen only after reliability/friction evidence is acceptable.

## Suggested further improvements

These come from the 21–23 September hardening passes. They are proposals, not merged work. Each
should stay small, be tested, and follow the release principles above. Ordered by release value.

**F1 — Enable optional support.** ~~Done.~~ The Ko-fi link is a built-in default (overridable by
`VITE_SUPPORT_URL`), and `/privacy` has an "Optional support payments" section naming the provider.

**F2 — Update-during-session regression (H4).** Add a PWA-gate spec that installs a build, serves a
changed service worker while a departure is running, and asserts no update prompt or reload
until the session is saved. This turns today's structural guarantee into an executable one.

**F3 — Manual assistive-technology pass (H7).** axe covers static rules; nobody has yet run a
session with VoiceOver (iOS) and TalkBack (Android). Check that the live clock does not flood
announcements, that "I'm back" is reachable at once, and that the review ratings read clearly.
Record results in `DEVICE-TEST-MATRIX.md`.

**F4 — Visible save-failure recovery at review time (H3).** Storage failure elsewhere is covered,
but if the final review save throws, `LiveSession.tsx` quietly re-enables Save with no message.
Show what happened, keep the review on screen, and offer a retry plus a "download this session"
action. The active-session checkpoint means nothing is lost meanwhile. Add a forced-failure
browser test.

**F5 — Privacy-safe crash visibility (needs a privacy decision).** Beta testers' errors are
currently invisible unless reported. Any option must follow `AGENTS.md` §5: no training
content, names or durations, and only an error type, build hash and screen name. Decide
whether to use this, or rely on `/contact` feedback alone, before the beta widens.

**F6 — Performance budget in CI (H1).** Add a bundle-size check (and optionally a Lighthouse run
on the production build) so the homepage imagery and app bundle cannot grow unnoticed. It
should run in the fast job, not the browser job.

**F7 — Post-deploy social and search checks (H7).** After the next production deploy, re-scrape
home/help/resources/evidence in the Facebook Sharing Debugger and LinkedIn Post Inspector, and
confirm Search Console coverage for the public pages only.

**F8 — Beta feedback loop (H7).** Before inviting testers, write a one-page beta brief: what to
test, how to send feedback (`/contact`), and a short list of friction questions. Log findings
against these roadmap sections rather than as new features.

Deliberately **not** proposed while hardening is open: new training features, multi-dog
workspaces, paid add-ons, or engagement mechanics. Revisit them after beta evidence
(`BETA-ROADMAP.md`, `PAYMENTS-PLAN.md`).

## Public-beta release gate

A beta candidate is not ready merely because CI is green. It should also satisfy:

- no known path that silently loses training data;
- no known path that resets or duplicates an active/completed session;
- deterministic dependency install and pinned build runtime;
- current Chromium + WebKit automated journeys green;
- production service-worker/offline gate green;
- real installed iOS and Android checks recorded;
- live account/two-device checks recorded;
- privacy/account copy matches actual behaviour;
- evidence and product-heuristic boundaries are accurately represented;
- rollback/export/recovery paths are understood.

### H3 follow-up — storage failure recovery (21 September, merged PR #52)

`fix/storage-fallback-recovery` preserves the last successful IndexedDB snapshot when a later
operation fails, reports checkpoint-only storage degradation, and puts a saved-training backup
action on a cross-screen recovery notice. Memory-only storage also suppresses the PWA update
prompt. Browser regressions cover a stale fallback retaining history/ownership, and full storage
failure during a session followed by save/export. PR #54 subsequently closed the local multi-window policy/guard. Divergent populated stores across
visits are fixed (PR #63: newer fallback app data now wins). Live cross-device conflicts and
real-device release gates remain.
