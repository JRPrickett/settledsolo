# SettledSolo production hardening roadmap

**Date:** 20 September 2026  
**Phase:** Production hardening  
**Status:** PRs #34–#40 merged; PWA background-return-alert hardening in progress  
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

This is the highest-risk product area because failures can lose trust even when the training logic is correct.

Already protected: reload recovery, fallback-to-IndexedDB promotion, expired-checkpoint rejection, save deduplication and offline local save.

Still harden:

- define and test the policy for multiple tabs/windows using the same local log;
- prove rapid repeated add/edit/delete actions cannot overwrite newer local data; **Done: PR #40.**
- exercise corrupted or partially valid stored data and confirm safe normalisation/fallback; **Done: PR #40.**
- exercise storage-write failure where feasible and surface a useful recovery/backup message; **Storage degradation behaviour covered in PR #40; user-facing message still to assess.**
- verify backup restore never imports authentication/sync ownership from another account; **Done: PR #40.**
- add browser-level sync conflict resolution for concurrent edit/delete cases, not only model tests;
- prove sign-out, local reset and cloud deletion remain three distinct operations. **Done: PR #40.**

**Exit:** interruption, concurrency or malformed local state cannot silently discard a completed session.

## H4 — PWA and device lifecycle

Automated PWA coverage remains necessary but is not enough for installed mobile behaviour.

- Prove update UI is never actionable during a live session or cue-practice session.
- Test old-build/new-service-worker transitions on preview without forcing a live-session reload.
- Complete installed-iPhone Airplane Mode relaunch and offline save.
- Replace the looping silent-audio/Media Session workaround with standards-based Web Push for the main return point. **Implemented on PR #41; deploys auto-provision stable per-environment VAPID keys, with physical-device evidence still required.**
- Complete iOS notification permission/denial, background delivery/cancellation and duplicate-chime checks.
- Confirm the installed PWA no longer exposes fake media-player controls in Lock Screen / Control Centre.
- Complete the Android installed-PWA matrix.
- Run desktop sanity checks for first run, session, history, backup/restore and track switching.
- Record device, OS, browser/PWA mode, commit and result in `DEVICE-TEST-MATRIX.md`.

**Exit:** the real-device matrix contains evidence for iOS and Android, with any OS limitation explicitly documented rather than assumed away.

## H5 — Account and sync activation hardening

Accounts stay disabled until this phase is proven in preview.

- Configure verified email delivery and isolated preview credentials.
- Run configuration preflight before any migration/deploy.
- Verify real OTP delivery, expiry, wrong/expired codes and resend/rate-limit behaviour.
- Verify real two-device initial import, incremental sync, offline save/reconnect and conflict recovery.
- Verify stale-tab account checks on sync/export/delete.
- Verify cloud export completeness.
- Verify account deletion requires recent auth and typed confirmation while leaving local copies untouched.
- Confirm provider retention/backups and privacy wording before production activation.

**Exit:** preview accounts survive real two-device use without losing, duplicating or leaking training data. Production remains disabled until this evidence is recorded.

## H6 — Security and privacy verification

The Worker already has a strong baseline: same-origin checks, secure cookies, request-size limits, route allowlists, database-backed auth limits, an edge rate limiter, private/no-store API responses, CSP/HSTS and no request-body logging.

Hardening work:

- add regression assertions for security headers on public, app and API responses;
- test rejected origin/method/content-type/oversized requests;
- test that user-provided/imported HTML-like text is rendered as text and cannot execute;
- confirm preview/app/API noindex behaviour;
- keep workflow permissions minimal and secrets out of logs/generated config;
- review dependencies and keep lockfile-driven installs reproducible;
- confirm analytics never receives dog names, notes, outcomes, durations or training history;
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

1. ~~Finish and merge PR #34 (E2E typecheck).~~ Done.
2. ~~Finish PR #35: reproducible builds with pinned Node + `npm ci`.~~ Done.
3. ~~Land targeted browser-CI gating so expensive browser/PWA checks only run when justified.~~ Done: PR #36.
4. ~~Split E2E specs to reduce conflict risk.~~ Done: PR #37.
5. ~~Add the missing critical-flow browser journeys from H2.~~ Core tranche done: PR #38; only smaller error-boundary/navigation edge cases remain.
6. ~~Run the repository storage/concurrency pass from H3.~~ Done: PR #40; multi-tab policy and user-facing degraded-storage messaging remain.
7. Complete PWA/device lifecycle gates, including preview Web Push deployment and real iPhone return-alert evidence.
8. Activate accounts on **preview only** and run the real two-device/security checks.
9. Clear qualified behaviour-professional review and public-beta essentials.
10. Activate production accounts only after the preview/release evidence is recorded.

## Public-beta release gate

A beta candidate is not ready merely because CI is green. It should also satisfy:

- no known path that silently loses training data;
- no known path that resets or duplicates an active/completed session;
- deterministic dependency install and pinned build runtime;
- current Chromium + WebKit automated journeys green;
- production service-worker/offline gate green;
- real installed iOS and Android checks recorded;
- account preview checks recorded if accounts are being enabled;
- privacy/account copy matches actual behaviour;
- qualified behaviour-professional review recorded;
- rollback/export/recovery paths are understood.
