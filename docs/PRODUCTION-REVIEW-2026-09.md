# Production review — September 2026

## Executive summary

The current app is a strong prototype with genuinely useful product ideas: local-first use,
adaptive targets, warm-ups, interruption recovery, scenarios, history, progress views,
notifications and exports.

It should not be extended into the production account/sync product in its current UI
architecture. The core training calculations should be preserved and characterised with
tests, while the application shell is modernised.

The production opportunity is not "another separation timer". It is a calm, transparent,
cross-platform training companion that is unusually reliable, keeps the useful core free,
and gives owners control of their data.

## Competitor patterns

Current products largely converge on:

- baseline/starting assessment;
- generated or adaptive session durations;
- warm-up/departure-cue exercises;
- post-session rating and notes;
- progress charts/history;
- achievements or streaks;
- reminders;
- exports/sharing;
- premium subscriptions.

The strongest opportunity for differentiation is reliability + clarity + low-friction
tracking rather than a larger feature count.

## Product advantages to protect

### Local-first guest use

No account wall before the user has received value.

### Transparent target reasoning

Keep the existing "why this target?" concept. The recommendation should never feel like an
opaque algorithm telling somebody to push their dog.

### Scenario-specific progression

Different routines, people or times of day can legitimately need separate training tracks.
Keep this concept but make the UI simpler.

### Interruption recovery

The active session should survive reloads, app switching and connectivity changes. This is
a core product promise and needs browser/device-level tests.

### Free, useful core

The core training plan, unlimited history, progress view and data export should remain
useful without a subscription.

## Product changes before public beta

### 1. Replace the long-page UI with an app shell

Proposed primary navigation:

- Today
- Progress
- History
- More

The active training session becomes an intentional full-screen mode.

Settings, data export, install help and account controls move out of the main training page.

### 2. Improve onboarding

Do not ask the user to test the maximum duration their dog can tolerate.

Ask for a duration they have already observed to be comfortable, explain camera use and
show the three response levels with behavioural examples.

Signup remains optional.

### 3. Improve session ratings

Use calm behavioural language consistently:

- Relaxed
- Some concern
- Distressed

Allow optional observed-signal chips such as pacing, panting, watching the exit, whining,
barking/howling and inability to settle.

Keep this optional so logging remains quick.

### 4. Treat duration as only one dimension of progress

Surface:

- longest comfortable absence;
- recent comfort quality;
- frequency of concern/distress;
- trend by context when enough data exists;
- recovery/setback periods without presenting them as failure.

Do not imply that correlation in context tags proves causation.

### 5. Replace streak pressure with supportive consistency

A missed day should not look like failure. Show a calendar/history and gentle optional
reminders, but avoid a streak mechanic that encourages somebody to train when their dog is
not ready.

### 6. Trainer/household sharing later

A high-value later feature is a read-only progress view for a trainer or another household
member, with date-range PDF/CSV export.

## Training-engine audit

The current engine contains product-defined rules such as fixed percentage increases and
decreases, a default daily cap and periodic deliberately shorter sessions.

Those rules are sensible hypotheses but should not be presented as clinically validated
rules without evidence.

Before public beta:

1. document every progression rule in plain English;
2. identify which rules are safety/product heuristics versus evidence-backed principles;
3. keep the evidence/heuristic boundary explicit in the product and public documentation;
4. keep manual override easy;
5. use conservative defaults;
6. explain why a target moved;
7. flag repeated difficult sessions as a reason to reduce difficulty / seek professional
   support rather than continuing to optimise a number.

## Technical architecture recommendation

### Frontend

- React + TypeScript
- Vite
- custom design system/CSS tokens (no generic component-library visual identity)
- IndexedDB for local training data, with a small typed repository layer
- explicit reducer/state-machine model for the live session lifecycle
- vite-plugin-pwa / Workbox for generated versioned service-worker assets

Why: the current 1,950-line DOM controller is already difficult to reason about and account
sync will multiply its states.

### Domain layer

Preserve the useful logic as framework-independent TypeScript modules:

- progression
- session planning
- session review
- achievements
- reporting
- schema/migrations

Domain tests should not import React or the browser.

### Backend

- Cloudflare Worker
- Hono
- D1
- Better Auth
- typed request/response schemas
- separate analytics and private account databases/boundaries

### Testing

- Vitest for domain/unit tests
- React Testing Library for UI interaction
- Playwright for complete user journeys
- migration fixtures from old SettledSolo localStorage versions
- offline/reload recovery tests
- manual real-device matrix for installed iOS and Android PWAs

Critical journeys that must be covered:

1. first run -> start session -> finish -> rate -> next target;
2. end a session early;
3. switch away / reload during a running timer and recover;
4. restore from old local data;
5. browser goes offline during a session;
6. guest creates account and imports history once;
7. same account opens on second device and receives history;
8. delete/edit conflicts do not duplicate or lose sessions.

## PWA reliability requirements

- no manual cache-version bump;
- atomic deploy assets;
- old app versions fail safely against newer APIs;
- active session timestamps, not interval ticks, determine elapsed time;
- network loss never blocks a session;
- notification permission is optional;
- app remains usable in the browser without installation;
- updates must not silently discard a running session.

## Brand/product stance

The current SettledSolo name and icon are provisional.

The finished visual system should feel calm, confident and consumer-grade rather than
clinical or cartoonish. The active session should be extremely legible at a glance while
the rest of the app stays quiet.

## Recommended build order

1. production foundation + green CI;
2. characterisation tests around current training behaviour;
3. TypeScript/domain migration;
4. new app shell and live-session state machine;
5. IndexedDB storage + legacy-data migration;
6. PWA/service-worker rebuild;
7. account/auth;
8. sync;
9. public beta site;
10. trainer/household features after usage evidence.
