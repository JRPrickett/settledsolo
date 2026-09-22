# Product research: user demand and competitor landscape (September 2026)

Research pass covering two questions: what do real separation-anxiety dog owners say they need
(Reddit), and where do existing separation-anxiety apps fail their users (app store/forum
reviews). Findings are grounded in actual thread/review text, not paraphrase from memory or
general knowledge — see the sourcing note at the end of each section.

This complements `docs/EVIDENCE-BASE.md` (what the science and practitioner community support)
and `docs/ACCOUNT-SYNC.md` (backend architecture). None of the product implications below have
been implemented — this is the research record; implementation choices should be made
separately.

## Reddit research

**Method note:** reddit.com, old.reddit.com and api.reddit.com are network-blocked from this
environment. Worked around it via a Redlib mirror (safereddit.com): 11 searches across
r/reactivedogs, r/DogTrainingTips, r/OpenDogTraining, r/DogAdvice, r/puppy101, r/dogtraining,
and a dedicated r/Separation_Anxiety subreddit, then pulled full post+comment text from 15
threads.

r/dogtraining runs a recurring weekly "Separation Anxiety Support Group" megathread — evidence
of sustained, high-volume demand. r/Separation_Anxiety exists almost entirely as discussion of
one commercial separation-training programme — the single most concentrated pocket of the target
user.

### Findings, prioritized

1. **People are already asking for this exact product, unprompted.** A r/dogtraining user
   explicitly requested an easy start/stop timer that resets per session, the ability to track
   multiple behaviors/dogs separately, and per-session (not just cumulative) data they could
   visualize or export — close to a literal spec for SettledSolo's session log. Single thread,
   but a direct unmet-need statement.

2. **"What counts as a setback / under threshold" is a recurring, unresolved confusion** —
   repeated across r/dogtraining, r/puppy101, and r/Separation_Anxiety. Owners don't agree on
   whether the end-session trigger should be the first sign of anxiety (pacing, staring at the
   door) or the target behavior (whining/barking), and report wildly different numbers (1 minute
   vs. 15 minutes) depending on which they pick.
   **Implication:** the app needs an opinionated, teachable definition of "threshold reached"
   built into the session-rating UI, not just a free-text log.

3. **Guilt, burnout, and "world-shrinking" framing are pervasive**, not occasional. Direct
   quotes: "I cry almost every day," "It is definitely shrinking my world," "I've gained 15
   pounds because I never leave the house." A recurring self-deprecating joke pattern ("she has
   separation anxiety" / "not the dog, you") about owners' *own* anxiety about leaving.
   **Implication:** copy/tone should validate the owner's emotional burden explicitly, not just
   track the dog's progress.

4. **Cameras are a double-edged sword.** Valued for verifying barking (often tied to eviction/
   noise-complaint fear), but a trainer-authored comment (with agreement in replies) warns
   two-way talk/voice features usually backfire and spike arousal. One owner admitted obsessive
   camera-refreshing fed her own anxiety.
   **Implication:** if camera/monitoring features are ever built, frame them as "verify and
   log," not "talk to your dog," and consider a check-frequency limiter as an anti-obsession
   feature.

5. **A leading commercial programme is the dominant competitor and has real, repeated complaints**:
   cohort-gated access that closes and reopens unpredictably, rising subscription cost ($25/mo
   → $13/mo app-only after the 3-month program), and reputational hesitancy tied to the trainer
   personally (alleged support for aversive tools, causing at least one user to actively avoid a
   different app for similar reasons). Repeated across roughly six threads in
   r/Separation_Anxiety.
   **Implication:** clear, always-open self-serve pricing and an explicit positive-
   reinforcement-only stance are a credible differentiator, not just nice-to-have.

6. **Vet/behaviorist access is a strong recurring bottleneck**: waitlists up to a year, costs
   quoted at £1000/$1000+, some vets refusing to prescribe. This pushes owners to Reddit and
   DIY apps as the only accessible option.
   **Implication:** room for an in-app path to medication-adjacent guidance or a referral
   nudge, since people are being turned away by traditional care.

7. **Minor/single-thread signals**, not yet patterns: a barking-specific tracking app
   ("Barksense") praised for isolating "how long does he actually complain" data; one user
   floated a device for interactive engagement during absences, framed against "most products
   are passive."

## Competitor app teardown

Reviewed via App Store, Trustpilot, and ProductReview.com.au listings (fetched directly where
available); Google Play review bodies were not reachable through available tooling.

**A leading commercial separation-training programme** — web-only, bundled inside a 3-month program; no App
Store/Play listing. No independent third-party reviews found anywhere (Reddit, Trustpilot, app
stores). The gating itself is notable: no standalone trial, so you can't try the product before
buying the full program. Pricing from a secondary, unverified source only (~$127/3 months or
~$49/mo).

**Calm My Dog** — App Store, 4.0★/7 ratings (small sample).
Complaints: tedious manual data entry (placeholder text had to be deleted every log entry); no
way to restart a session once started; timer kept running in the background after closing the
app with no way to stop it short of deleting the app; the app sometimes *increased* recommended
duration even after a bad/failed session.

**PawChamp** — 250k+ users claimed; reviews on ProductReview.com.au and App Store.
Complaints (multiple 1-3★): deceptive enrollment (charged without clear disclosure, often in
USD, after what users thought was a one-time trial); cancellation described as functionally
impossible even via support; no renewal reminders/invoices; "money-back guarantee" requires
proof of use even after the dog died or app access was lost; support is chatbot-only.

**Zigzag Puppy Training** — App Store 4.8★/3.9K ratings vs. Trustpilot 2.5★/18 reviews (a real
disconnect worth noting). Complaints: content seen as generic/overpriced ("nothing you can't
find online for free"); inconsistent trainer advice contradicting vets (one user told her puppy
"may not be able to be alone until 10 months old"); no monthly plan, only quarterly/annual;
billing without promised pre-charge notification; AI chat occasionally repeats the same
response to different questions.

**EveryDoggy** — App Store 4.5★/3.8K ratings. Complaints: "no way to cancel" despite promised
easy cancellation; many advertised courses marked "coming soon"; no multi-dog account support
(explicitly requested); separation anxiety is one module bolted onto a general obedience app,
not a dedicated program.

**Other SA-specific apps found, lower confidence:** Separation Buddy (one technical complaint —
timer doesn't track accurately when switching to another app, e.g. to check a dog camera —
directly relevant to SettledSolo's core timing mechanic); PawCalm and Solo Serenity (no
independent reviews found, flagged as speculative).

### Cross-app patterns worth exploiting

1. **Deceptive/opaque subscription billing is the #1 recurring complaint** — silent
   trial-to-paid conversion, no renewal warnings, near-impossible cancellation, unusable refund
   policies (PawChamp, Zigzag, EveryDoggy, Calm My Dog). A transparent, easy-to-cancel — or
   local-first/no-subscription — model is a direct, credible differentiator.
2. **The algorithm doesn't respect the dog's real pace** (Calm My Dog: duration increased even
   after a failed session) — exactly the failure mode SettledSolo's rating-based duration engine
   needs to keep guarding against.
3. **AI/chat coaching reads as generic or occasionally wrong** (Zigzag), sometimes contradicting
   vets. An opportunity to be transparently rule-based rather than lean on a chatty LLM persona.
4. **Logging friction kills adherence** — tedious manual entry, un-restartable sessions,
   stuck background timers (Calm My Dog); mis-tracking on app-switch (Separation Buddy). A fast,
   forgiving, offline-friendly logger is a tangible win SettledSolo already has the
   architecture for.
5. **No multi-dog support** flagged explicitly (EveryDoggy) — the data model in
   `docs/ACCOUNT-SYNC.md` already designs for multiple dogs per account.
6. **SA-specific training is often bolted onto general obedience apps**, leaving content thin.
   A tool built solely around desensitization protocol can credibly claim depth generalist
   apps lack.

## Gaps vs. CSAT/practitioner practice

Credential terminology and clinical-guidance citations from this pass now live in
`docs/EVIDENCE-BASE.md`. The product-relevant gaps found against actual CSAT (Certified
Separation Anxiety Trainer) practice are recorded here instead, since they're implementation
candidates rather than evidence claims. Confirmed via a grep of the current codebase and docs —
none of the following exist in the app today.

1. **Real-absence management is unaddressed.** CSAT practice treats "suspending real absences"
   during active training as a core tenet: the dog should stay below threshold for *every*
   absence during a training block, not just training reps, using daycare, in-home sitters,
   schedule-swapping, or bringing the dog to work. The app currently has zero content, UI, or
   guidance on this. Possible addition: a "coverage plan" checklist/reminder during active
   training weeks.
2. **Confinement/crate anxiety vs. separation anxiety has no differential.** Practitioners
   distinguish the two — a crated dog that panics can look like a failing SA case when the
   crate itself is the trigger. Setup has no crate/pen/free-roam field.
3. **Food/treat refusal as a distress signal.** Commonly used by CSATs as a real-time proxy
   during camera monitoring (a dog that won't take a stuffed Kong is an early red flag).
   Distinct from the app's existing six signals (exit-watching, pacing, panting, whining,
   barking/howling, unable-to-settle). Flagged as practitioner-common pattern, not a single
   citable source — candidate for a seventh optional signal.
4. **No pre-protocol differential-assessment step.** Bain 2025 (see EVIDENCE-BASE) recommends
   video-recording the dog alone once before starting a structured protocol, specifically to
   rule out confinement anxiety, noise phobia, or incomplete housetraining. The app currently
   goes straight into duration training.
5. **No medication-adjacent nudge.** CSATs/CDBCs can't prescribe and refer out to a vet/DACVB;
   vets treat medication as a co-equal pillar. A safe, non-clinical addition: after repeated
   stalled/distressed sessions, suggest the user "ask your vet or a DACVB about medication as an
   adjunct" — mirrors real referral norms without prescribing anything.
6. **Intake depth.** CSAT initial consultations commonly run a ~90-minute structured
   assessment (history, attachment behavior, pre/post-departure behavior, goals) — deeper than
   the app's current setup flow. Worth considering a short structured intake, not full clinical
   replication.

Regression-after-a-bad-session practitioner guidance was checked against the app's existing
logic and found **consistent, no conflict**: regression is expected, usually traceable to an
identifiable trigger, and should resolve within 1-2 sessions once the trigger passes — this
matches the app's existing "repeated concern/distress → recommend professional support"
principle (EVIDENCE-BASE principle 7).
