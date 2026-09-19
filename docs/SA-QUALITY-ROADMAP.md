# Making SettledSolo the best separation-anxiety app around

Date: 18 September 2026

## Where this comes from

`docs/PRODUCT-RESEARCH-2026-09.md` (real Reddit threads + competitor app reviews) and
`docs/EVIDENCE-BASE.md` (peer-reviewed research + CSAT/practitioner practice) identified
concrete gaps between what SettledSolo does today and what would make it genuinely the best
tool in this space, not just a safe one. This doc turns those findings into an ordered work
list. Each item names the source finding it answers.

Architecture readiness for scale is already covered separately in `docs/ACCOUNT-SYNC.md` and
isn't repeated here.

## Status

Items 1-4 are shipped on `claude/sa-quality-improvements`. Item 5's three sub-items are not
started.

## Priority order and why

### 1. Teachable "threshold reached" definition in the session-rating UI — done

**Source:** Reddit — recurring, unresolved confusion across r/dogtraining, r/puppy101, and
r/Separation_Anxiety about whether the end-session trigger is the first sign of anxiety
(pacing, staring at the door) or the target behavior (whining/barking); owners report numbers
as far apart as 1 minute vs. 15 minutes depending on which they pick.

Highest-leverage item: it's a real, repeated point of confusion driving people to ask
strangers on Reddit, and it's a UI/copy change to logic the app already has (session outcome
rating), not new domain logic.

### 2. Real-absence coverage guidance during active training — done

**Source:** CSAT practice — suspending all real absences (not just training reps) during an
active training block is treated as a core tenet; the app currently has no content, UI, or
guidance addressing it at all.

A coverage-plan checklist/reminder surfaced during an active scenario, not a new subsystem.

### 3. Confinement/crate differential in setup — done

**Source:** CSAT/practitioner practice — a crated dog that panics can look like a failing SA
case when the crate itself is the trigger; the setup flow and signal list have no crate/pen/
free-roam field today.

Shipped as two new session context tags ("Crated / confined" / "Free-roam") plus a one-line
note suggesting a free-roam comparison session, rather than a Setup-time field — confinement
can change session to session, so it's per-session context, not a one-time setup choice.

### 4. Transparent, no-dark-patterns billing stance stated explicitly — done

**Source:** Competitor teardown — deceptive/opaque billing is the #1 recurring complaint
across PawChamp, Zigzag, EveryDoggy, and Calm My Dog (silent trial-to-paid conversion, no
renewal warnings, near-unusable cancellation/refunds). SettledSolo's local-first,
no-subscription-by-default model already avoids this by construction — this item is about
saying so plainly in product copy (landing/terms), not new billing engineering.

### 5. Smaller, lower-urgency additions

**Source:** CSAT practitioner practice.

- Food/treat refusal as a 7th optional observed signal (distinct from the existing six).
- ~~A one-time "record the dog alone" pre-protocol step before starting duration training
  (Bain 2025), to help rule out confinement anxiety/noise phobia/incomplete housetraining
  being mistaken for separation anxiety.~~ **Done.** Offered on Today before the first timed
  departure of a track, never twice, and never while a cue-first plan has no departure in it.
  A camera is suggested but explicitly optional, the step never blocks training, and the
  guidance names alternative explanations without diagnosing or prescribing. A confinement
  observation points at the free-roam comparison tags from item 3.
- A non-prescriptive medication-referral nudge ("ask your vet or a DACVB about medication as
  an adjunct") after repeated stalled/distressed sessions — mirrors real referral norms
  without prescribing anything.

## Explicitly not doing right now

- Camera/monitoring features (Reddit shows real demand, but also a documented obsession/
  arousal-spike risk — needs its own design pass, not a quick add).
- An in-app vet/behaviourist booking flow (real bottleneck per Reddit, but a distinct scope
  from training-log improvements).
- Multi-dog UI (already designed for in `docs/ACCOUNT-SYNC.md`'s data model; building the UI
  is account/sync-phase work, not this roadmap).

## Delivery order

Work items 1-4 roughly in the order above; each is independently shippable and testable.
Item 5's three sub-items can be picked up in any order once 1-4 land, since none of them
depend on each other or on 1-4.
