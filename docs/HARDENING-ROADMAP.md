# SettledSolo production hardening roadmap

**Date:** 21 September 2026
**Phase:** Production hardening  
**Status:** Accounts active; PRs #52–#55 merged; device/two-device/beta evidence pending
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
- Pin the Node version in `.node-version` and make GitHub workflows consume that file. Cloudflare Workers Builds also supports `.node-version`, so direct builds and GitHub builds can use the same runtime.
- Use `npm ci --ignore-scripts` in CI and deploy workflows rather than `npm install`, so a stale or inconsistent lockfile fails immediately.
- Split the large `core-flow.spec.ts` into focused specs (onboarding, session lifecycle, history/data, behaviour guidance, install/public) to reduce merge-conflict risk. **Done: PR #37.**
- Keep the expensive Chromium/WebKit/PWA job targeted: run it on browser-impacting PRs, on browser-impacting direct pushes to `main`, and on explicit manual full-CI runs. Do not repeat it on the `main` merge push after the same PR already passed.
- Browser-impacting paths include runtime/frontend/PWA files, E2E specs, root dependency manifests and `.node-version`. Unit-test-only changes under `app-v2/src/**` stay on fast Vitest/type/build verification and do not download browsers.
- Upload Playwright traces/screenshots on browser-test failure, not only account review screenshots.
- Keep production deployment manual and preview deployment gated by the same fast verification commands as CI.

**Exit:** the same commit installs deterministically and passes TypeScript, unit, Worker dry-run, mobile browser and production-PWA checks before it can be considered releasable.

## H2 — Critical user-flow coverage

Add browser-level proof for flows that exist in the product but are not yet covered end to end.

- Manual history add, edit and delete. **Done: PR #38.**
- Explicit early return from a timed departure, save, and resulting next-plan behaviour. **Done: PR #38.**
- Progress screen after a mixture of relaxed / concern / distressed sessions. **Done: PR #38.**
- Backup **export + restore round-trip**, not restore alone. **Done: PR #38.**
- Track/scenario settings: duration entry, minutes/seconds handling, warm-up count, shuffle and rest settings. **Done: PR #38.**
- Navigation after save/recovery so a completed session cannot reappear as active.
- Error-boundary fallback and successful reload/recovery.
- Account-aware copy: local-only users and connected users must not be told contradictory things about backup/sync. **History copy fixed in PR #38.**

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
- add browser-level sync conflict resolution for concurrent edit/delete cases, not only model tests;
- prove sign-out, local reset and cloud deletion remain distinct operations; **Done: PR #40.**

**Exit:** interruption, concurrency or malformed local state cannot silently discard a completed session.

## H4 — PWA and device lifecycle

Automated PWA coverage remains necessary but is not enough for installed mobile behaviour.

- Prove update UI is never actionable during a live session or cue-practice session.
- Test old-build/new-service-worker transitions on preview without forcing a live-session reload.
- Complete installed-iPhone Airplane Mode relaunch and offline save.
- Replace the looping silent-audio/Media Session workaround with standards-based Web Push for the main return point. **Done: PR #41. Preview deploy auto-provisioned its VAPID pair successfully; physical-device evidence is still required.**
- Complete iOS notification permission/denial, background delivery/cancellation and duplicate-chime checks.
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
- test that user-provided/imported HTML-like text is rendered as text and cannot execute;
- confirm preview/app/API noindex behaviour;
- keep workflow permissions minimal and secrets out of logs/generated config; **Step-scoped secrets and immutable action revisions added in the passwordless/security hardening PR.**
- review dependencies and keep lockfile-driven installs reproducible; **Dependabot configuration added; lockfile installs retained.**
- confirm the retired product-event analytics pipeline has not been reintroduced; **Retirement completed in PR #55; keep this as a regression boundary.**
- review CSP exceptions such as `style-src 'unsafe-inline'` before beta and retain only what the UI requires.

**Exit:** known security boundaries are executable tests where practical, not just assumptions in documentation.

## H7 — Public-beta readiness

Only after the reliability gates above are substantially green:

- add a clear feedback/contact route;
- finalise privacy/account/provider wording;
- replace stale local-only/account-coming-later copy wherever account state can differ;
- add final real product screenshots and social-share image metadata;
- confirm brand/domain/trademark readiness;
- invite a small beta cohort and record qualitative failures/friction before widening access.

Do not use training outcomes as an efficacy claim.


## Immediate order

1. ~~E2E typecheck, reproducible builds, targeted browser CI and spec split.~~ Done: PRs #34–#37.
2. ~~Critical-flow browser coverage and repository storage/concurrency baseline.~~ Done: PRs #38 and #40.
3. ~~Storage-failure recovery, stale-tab export identity, single-window ownership and analytics retirement.~~ Done: PRs #52–#55.
4. Complete installed iOS/Android lifecycle gates, including update/notification/background-return evidence.
5. Complete real two-device sync/offline/conflict and live OTP/rate-limit checks.
6. Add the remaining browser-level sync conflict/recovery and security/privacy assertions.
7. Clear qualified behaviour-professional review and public-beta contact/accessibility/assets/provider wording.
8. Begin a deliberately small invited beta, then widen only after reliability/friction evidence is acceptable.

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
- qualified behaviour-professional review recorded;
- rollback/export/recovery paths are understood.

### H3 follow-up — storage failure recovery (21 September, merged PR #52)

`fix/storage-fallback-recovery` preserves the last successful IndexedDB snapshot when a later
operation fails, reports checkpoint-only storage degradation, and puts a saved-training backup
action on a cross-screen recovery notice. Memory-only storage also suppresses the PWA update
prompt. Browser regressions cover a stale fallback retaining history/ownership, and full storage
failure during a session followed by save/export. PR #54 subsequently closed the local multi-window policy/guard. Divergent populated stores across
visits, cross-device conflicts and real-device release gates remain.
