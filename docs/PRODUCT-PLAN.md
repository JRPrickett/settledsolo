# Production product plan

## Product intent

Build a genuinely useful, free web app for people working through dog separation anxiety.
The product should earn real repeat usage before paid features are considered.

The production product name and repository are now **SettledSolo**. Legacy storage/import identifiers remain stable where changing them would risk user-data migration.

## Core promise

Open the app, see a sensible next training plan, run the session, record what happened,
and understand progress over time.

The app should reduce guesswork without pretending to diagnose or replace a qualified
trainer, veterinary behaviourist or vet.

## Product principles

1. **Useful before signup.** A new user can begin locally without creating an account.
2. **Local first.** Training continues to work when connectivity is poor or absent.
3. **Accounts protect progress.** The account message is:
   "Your progress is currently saved on this device. Create a free account to back it up
   and use SettledSolo on your other devices."
4. **Private by default.** Training data is not product telemetry; registered-account totals are the canonical user metric.
5. **No hostage data.** Users can export their own training history and delete their account.
6. **Calm, not gamified pressure.** Milestones may encourage people, but streaks or targets
   must never encourage a user to push a distressed dog.
7. **Web first.** The installable PWA remains the primary product. Native wrappers are a
   later distribution decision, not a prerequisite.
8. **Free core.** The core training plan, timer, history and basic progress view should
   remain genuinely useful for free.


## Current delivery status (22 September 2026)

The modern app, production Cloudflare Worker, guided onboarding, hardening work and optional
accounts/local-first sync are live. Account activation is complete in both preview and production:
isolated D1 databases, Better Auth email OTP, verified Resend delivery, sync, cloud export/deletion
and deployment verification are configured.

Recent hardening through PR #56 also covers storage-failure recovery, stale-tab export identity,
single-window write ownership and retirement of the legacy product-event analytics pipeline.
Registered Better Auth account totals are the canonical user-count metric.

The phase lists below describe product scope rather than implying every bullet is still open.
The active development focus is **release hardening and small-beta readiness**, while physical-device
and beta-essentials gates remain open. SettledSolo does not claim professional review or endorsement.
Use `HANDOVER.md`,
`HARDENING-ROADMAP.md` and `NEXT-PHASE.md` for the current sequence.

## Production phases

### Phase 0 — foundation

- CI on every pull request.
- Bring privacy documentation and implementation back into sync.
- Retire custom app-open/session/device analytics and use registered-account totals for user counts.
- Document account/sync architecture.
- Apply the SettledSolo brand system while keeping data/database identifiers brand-neutral.
- Keep the proven training/progression engine stable while infrastructure changes.

### Phase 1 — production hosting

- Move the public app to the South West Websites Cloudflare deployment pattern.
- Production and preview environments.
- Security headers and CSP appropriate for a PWA.
- Real production domain/subdomain after the brand decision.
- Error logging that does not capture training content.

### Phase 1.5 — release candidate and modern-app cutover

- Finish the remaining iOS matrix: offline relaunch, notification-denial path and update safety.
- Complete the Android installed-PWA matrix.
- Run desktop sanity checks.
- Maintain the evidence/heuristic boundary and publish owned guidance for users.
- Complete formal name/trademark checks and domain connection.
- Finish public-site beta essentials: feedback route, real product screenshots, social image and final privacy/terms wording.
- The modern PWA is already merged; clear and record remaining release gates before broad public beta.
- Deploy the modern app as `settledsolo`; the legacy analytics/events Worker is retired.


### Phase 2 — free accounts and sync ✅ baseline complete

- Guest/local mode remains the default first-run experience. **Done.**
- Optional passwordless account creation/sign-in. **Done.**
- Import existing local history into the account after explicit confirmation. **Done.**
- Cross-device sync architecture and incremental sync. **Done.**
- Account export and deletion. **Done.**
- Recovery/conflict flow. **Done in implementation; real multi-device evidence remains a release gate.**
- Offline writes queued and reconciled safely. **Done in implementation; real-device validation remains.**

Passkeys are intentionally deferred and are not required to call the baseline account phase complete.


### Phase 3 — public beta ← next product phase

Already present: landing page, app route, help, privacy and terms.

Next work:
- finish remaining installed-device lifecycle and recovery/security gates;
- add a clear feedback/contact route;
- publish the owned resources/FAQ/cheatsheet pages and complete the SEO pass;
- complete accessibility and final privacy/provider wording;
- use real product screenshots and final social-share metadata;
- run a small invited beta cohort before widening access;
- use registered-account totals for adoption and add further product metrics only by explicit privacy/product decision.

### Phase 4 — useful collaboration

Candidate free/paid boundary to test only after real usage exists:

Free:
- one dog
- adaptive training sessions
- complete history
- basic charts/milestones
- local use and cloud backup/sync
- export

Possible paid additions:
- multiple dogs
- trainer/client workspace
- read-only trainer sharing
- richer reports and longitudinal insights
- household collaboration
- advanced reminders or integrations

Never charge a user to retrieve their existing history.

## Success measures

Before monetisation is discussed, look for:

- people completing onboarding without assistance;
- people returning for later sessions;
- saved sessions over multiple weeks;
- account creation after meaningful local use;
- cross-device sync being used successfully;
- qualitative feedback that the app reduces planning/logging friction.

Revenue is not a Phase 1 success metric.

## South West Websites role

This is a South West Websites product and case study. It should demonstrate:

- product strategy;
- PWA/offline engineering;
- authentication;
- cloud data and sync;
- privacy-by-design;
- automated tests and CI;
- responsive consumer UX;
- analytics and iteration;
- production Cloudflare/GitHub delivery.
