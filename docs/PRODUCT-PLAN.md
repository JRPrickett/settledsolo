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
4. **Private by default.** Product analytics are aggregate and separate from account data.
5. **No hostage data.** Users can export their own training history and delete their account.
6. **Calm, not gamified pressure.** Milestones may encourage people, but streaks or targets
   must never encourage a user to push a distressed dog.
7. **Web first.** The installable PWA remains the primary product. Native wrappers are a
   later distribution decision, not a prerequisite.
8. **Free core.** The core training plan, timer, history and basic progress view should
   remain genuinely useful for free.

## Current delivery status (19 September 2026)

The modern app, Cloudflare Worker configuration, guided onboarding and the first automated
release-hardening pass are merged through PR #26, and optional accounts and local-first sync
through PR #28. The phase lists below describe the product scope, not a claim that each entry
is still unimplemented. Use `HANDOVER.md` and `NEXT-PHASE.md` for the current sequence.
Accounts are merged but not activated: no verified email sender is configured yet.
Physical-device and qualified behavioural-review gates remain open.

## Production phases

### Phase 0 — foundation

- CI on every pull request.
- Bring privacy documentation and implementation back into sync.
- Remove dog/training details from aggregate analytics.
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
- Get qualified behaviour-professional review of training wording/heuristics.
- Complete formal name/trademark checks and domain connection.
- Finish public-site beta essentials: feedback route, real product screenshots, social image and final privacy/terms wording.
- The modern PWA is already merged; clear and record remaining release gates before broad public beta.
- Deploy the modern app as `settledsolo-web` without overwriting the separate analytics/events Worker.

### Phase 2 — free accounts and sync

- Guest/local mode remains the default first-run experience.
- Optional account creation.
- Import existing local history into the account after explicit confirmation.
- Cross-device sync.
- Account export and deletion.
- Recovery flow.
- Offline writes queued and reconciled safely.

### Phase 3 — public beta

- New landing page separate from the training interface.
- Help, privacy and terms pages.
- Feedback route.
- Small invited beta cohort followed by public access.
- Measure activation, repeat use and session completion using aggregate analytics.

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
