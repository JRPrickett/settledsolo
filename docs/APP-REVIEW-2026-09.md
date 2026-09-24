# App review: UX, competitors and owner needs (23 September 2026)

A review of the live SettledSolo app against three goals:

1. improve the UX/UI and the features;
2. compare it with the apps owners actually use (the Be Right Back app, Separation Buddy and Calm
   My Dog), and make sure SettledSolo does what they fail to do;
3. check it against what owners ask, complain about and plead for help with in public
   separation-anxiety communities.

It builds on `PRODUCT-RESEARCH-2026-09.md` (18 September) and does not repeat it. Items marked
**fixed** are on this branch. Everything else is a proposal for the owner to decide on.

## Method and limits

- **App walkthrough.** Every first-run route, a full session (warm-up, practice check-in, settle
  break, main departure, review and discard), Progress, History, More and cue practice. Run in
  Chromium at 320 px and 375 px wide, with seeded histories for regression, high-risk and steady
  progress.
- **Competitors.** App Store listings, full review text and version histories, the vendors' own
  sites and pricing pages. Google Play review text is still not reachable from this environment.
  The BRB app is only available inside a paid programme, so it was reviewed from its public pages,
  not hands-on.
- **Owner voices.** Around 50 threads from the past year, read in full through a Redlib mirror:
  r/Separation_Anxiety (top of the year, all time, and the current front page), the fortnightly
  r/Dogtraining Separation Anxiety Support Group threads (July–September 2026), and relevant
  threads in r/puppy101, r/reactivedogs, r/dogs and r/DogAdvice. Also Mumsnet "The Doghouse" and
  UK Pet Forums threads.
- **Facebook groups are private** and were not read directly. They appear only as owners describe
  them on Reddit: "can be quite militant", sitter-swap groups, "Do No Harm". Treat that theme as
  second-hand.
- App Store samples are tiny (4–7 ratings per app). Treat competitor complaints as qualitative
  signals, not measurements.

## Executive summary

1. **The foundations are ahead of the field.** SettledSolo is the only product here that is all of:
   free with no subscription; on iPhone and Android; keeps time from timestamps while the owner
   watches a camera app; never increases the plan after a difficult session; and escalates to a
   vet on high-risk signs. Each competitor fails at least one of these, and those failures are the
   substance of their bad reviews.
2. **The walkthrough found a real welfare bug, now fixed.** The plan never went below the starting
   duration entered at setup. After a regression below it, the app offered that longer duration
   straight after distress, labelled "Easier today". Regression after moves, illness, grooming or a
   new baby is one of the most common Reddit stories, so this path would have been hit.
3. **Four smaller UX bugs are fixed:** landing mid-page after setup, a button label breaking
   mid-word, toggle state hidden from screen readers, and a paused plan still showing a departure
   time.
4. **The biggest unmet need is not a timer feature. It is the life around training.** Owners
   describe being "trapped", "a prisoner", unable to attend medical appointments, facing noise
   complaints and eviction, and running out of money for sitters. SettledSolo tells them to
   "cover real absences" but gives no help for owners who can't. This is the largest gap against
   what people are crying out for.
5. **Owners need a record that others can read.** Trainers "ghost" them and vets need history. The
   app itself tells owners to bring the record to an appointment, but only offers CSV/JSON. A
   printable "share with a professional" summary is the best value-for-effort feature.
6. **Methods are shifting.** A food-based protocol (FRIDA, using a remote treat feeder) is the
   fastest-growing topic on r/Separation_Anxiety. SettledSolo should let owners *log* what they
   use (food, feeder, medication changes, noise) without endorsing methods beyond its evidence base.
7. **Do not copy the competitors' engagement features.** Separation Buddy's mid-session "+30 s /
   +1 min" timer extensions and streaks work against SettledSolo's "ceiling, not a quota" rule.
   That difference is worth saying out loud in marketing.

## Part 1. Fixed on this branch

| # | Finding | Severity | Fix | Evidence |
|---|---|---|---|---|
| 1 | **The starting duration was a floor for every easier plan.** Start 2:00, distress at 0:40, next plan 2:00 "Easier today", with the reason "stays below the point where difficulty was observed". The same happened after concern, after distress at the start duration itself, after a relaxed early return and after a long break. | High (welfare and trust) | The configured start is a floor only while no concern or distress has been logged at or below it. After that the plan follows the observed sessions, never below 1 second. The fix only removes a floor, so it can only make plans easier. | `trainingEngine.ts` (`reductionFloor`), 7 new unit tests including an exhaustive property ("never at or above where difficulty was observed"), browser test in `behavior-guidance.spec.ts`, `EVIDENCE-BASE.md` product rule |
| 2 | **New users landed half-way down Today** after tapping "Use this starting plan", missing the plan itself. Each onboarding step also kept the previous step's scroll position. | Medium (first impression) | Scroll to the top on every setup step and when setup completes. | `onboarding.spec.ts` › "each setup step and the first Today screen open at the top on a small phone" |
| 3 | **"Account & backup" rendered as "Accoun / t & / backup"** on every Today screen. The long-name fix (`overflow-wrap: anywhere` on the app shells) let flex rows squeeze button labels mid-word. | Medium (polish, every visit) | Buttons, which never contain owner-entered text, use normal wrapping. | `onboarding.spec.ts` › "button labels never break mid-word" (a generic range-based check of every visible button) |
| 4 | **Review outcome buttons and the sign/context chips had no `aria-pressed`.** Screen reader users could not tell what was selected, and selection was shown mainly by colour. | Medium (accessibility, AGENTS.md §7) | `aria-pressed` on the live review and the History editor toggles. | `accessibility.spec.ts` |
| 5 | **A high-risk pause still headlined a departure** ("2:00 main departure · Easier today") above "Pause timed departures". | Medium (safety messaging) | While paused, the plan reads "Paused · no timed departures for now". The target, the next-target strip and "Why this plan?" are hidden. | `behavior-guidance.spec.ts` |

## Part 2. Competitors

### At a glance

| | **SettledSolo** | **Be Right Back app** (Julie Naismith) | **Separation Buddy** | **Calm My Dog** |
|---|---|---|---|---|
| Price | Free core; optional Ko-fi support | Only inside the 3-month programme: $127 upfront or $49/month × 3; 7-day refund | Free download; subscriptions $2.99/week, $8.99–9.99/month | 1-week trial, then $5.99/month, $39.99/year or $99.99 lifetime |
| Platforms | Any browser; installable PWA on iPhone, Android and desktop | Web app inside the programme, not in app stores | iPhone/iPad only | iPhone only |
| Guidance | Evidence-labelled plan with a reason for every target | "Smart Percy" AI coach; certified trainers, video reviews and community in the programme | Adaptive timer, exercises, insights | Daily plan from a "baseline" |
| After a bad session | Always easier; rest day; support and vet tiers; pause on high-risk signs | Not documented publicly | "Scales back" | Reviewer: "the app still increases your time for the next session" after a bad one (developer says since changed) |
| Timer while using a camera app | Timestamp-based; survives app switches, lock and reload; optional background return alert | Not documented | Reviewer: "doesn't accurately keep time when you open another app… can't check my dog camera" | Reviewer: timer "continues to run… even after I have swiped up and closed the app" |
| Observation logging | 3 outcomes, 10 signs incl. food refusal and high-risk signs, context tags, notes | Logged steps ("no more spreadsheets") | Rating and notes | Rating, placeholder text had to be deleted each entry (review) |
| Share with a trainer/vet | CSV, JSON backup | Trainer sees plan and progress | PDF and CSV export, "share progress reports with your trainer or vet" | None found |
| Household and multiple dogs | Tracks per routine; account sync across devices; one dog | Family membership | Multiple profiles (dogs, people, routines) since v2.5 | Reviewer asked to share progress with a partner |
| Engagement | Milestones follow the capped target; no streaks | Badges, "30 minute club", streaks | Streaks, calendar, check-in reminders, mid-session +30 s / +1 min extensions | Awards |
| Privacy | Local-first, no product analytics | Not documented | App Store privacy label lists collected data, including identifiers and usage data | "Data Not Collected" |

Also seen: **PawCalm** (free web beta: departure-cue practice only, AI coach, calm/noticed/anxious
logging) and **Solo Serenity** (web app plus coaching membership, $27–97/month). Both confirm that
"web app, no app store" is a normal delivery model owners accept.

### What competitors fail at, and SettledSolo already does

1. **Keeping time while the owner watches the camera.** This is the single most concrete complaint
   (the only written review of Separation Buddy on the US App Store; a similar timer complaint
   for Calm My Dog). SettledSolo's timestamp clock and background return alert are built for
   this. **Say it in marketing.**
2. **Respecting a bad session.** Calm My Dog increased time after a failed session. SettledSolo
   never does, and after fix 1 it also can't bounce back up to an out-of-date starting duration.
3. **Cost and lock-in.** BRB is programme-gated. Separation Buddy's cheapest plan is weekly.
   Reddit owners quote "$125 a week" for trainers and "almost 10k total". A free core with no
   trial conversion is a real differentiator.
4. **Android.** Both App Store competitors are iPhone-only, and BRB is web inside a paid
   programme. For Android owners SettledSolo is close to the only dedicated tool.
5. **Safety escalation.** None of the three documents a high-risk pause or a vet referral path.
   Calm My Dog's site offers no vet or behaviourist referral guidance.
6. **Editing and restarting.** Calm My Dog reviewers could not edit a completed session or restart
   one. SettledSolo has History editing, discard confirmation and manual logging.

### Where competitors are ahead

| Gap | Who has it | Recommendation |
|---|---|---|
| Shareable report for a trainer/vet | Separation Buddy (PDF), BRB (trainer view) | **Next:** print-friendly "Share with a professional" summary (N1) |
| Household sharing and multiple dogs or people | Separation Buddy profiles; Calm My Dog reviewer request | Later: household sharing; multi-dog is already in the data model (`ACCOUNT-SYNC.md`) |
| Lock-screen timer (Live Activity) | Separation Buddy, Calm My Dog | Not possible in an iOS PWA. Keep the return alert and say plainly what it does |
| Human support and community | BRB programme | Out of scope. Keep pointing to qualified professionals |
| Q&A ("why is my dog stuck?") | BRB's Smart Percy | Answer common questions in owned content instead of a chatbot (see "Not doing") |

### Deliberately not copying

- **Mid-session "+30 s / +1 min" extensions** (Separation Buddy). They turn the target into
  something to beat, the opposite of the ceiling rule.
- **Streaks and "keep your streak" reminders.** Owners on Reddit describe dreading sessions and
  burning out. A streak adds guilt on rest days, which SettledSolo explicitly recommends.
- **An AI chat coach.** Owner feedback on AI coaching elsewhere is "generic" or contradicts vets
  (see the 18 September research). One Reddit owner followed "what an AI recommended" for
  alternate-day training. A rule-based, cited explanation is the safer differentiator.

## Part 3. What owners need, and what SettledSolo covers

Frequency is a rough read across the ~50 threads, not a count.

| # | What owners say | How often | What SettledSolo does today | Gap | Recommendation |
|---|---|---|---|---|---|
| 1 | **Trapped and burnt out.** "I feel like a prisoner", "I just want my life back", "I'm starting to resent my dog", can't attend medical appointments, dating and friendships lost, crying in the car | Very high | Rest-day copy; "setbacks are normal"; the coverage card | Nothing addresses the owner. The coverage card assumes the owner *can* avoid absences | L6 owner-wellbeing guidance; L4 coverage planner; progress framed as "time you've got back" |
| 2 | **Can't avoid real absences.** Office days, no family, can't afford sitters, noise complaints, "terminated our lease", noise ordinances | Very high | "Try not to leave them alone longer than today's plan"; four coverage ideas | No path for owners who must leave. Unavoidable absences are invisible to the plan | L2 log an unavoidable absence (not training) so the plan softens after an over-threshold one; content on sitter swaps, taking the dog to work, and asking the vet about planned absences |
| 3 | **Slow progress, plateaus, regressions.** "Week 7 and his benchmark is 6 minutes", "is my trainer too conservative?", regressions after moving, grooming, a new baby or illness | Very high | Adaptive plan, now correct after regression; support and referral tiers | Nothing explains a plateau that isn't distress. Regressions have no context on the timeline | L3 life-event markers on Progress; L5 plateau guidance separate from the distress referral |
| 4 | **"What counts as over threshold?"** Frustration vs panic; "is some whining OK?"; lying by the door but calm; "he still won't eat but seems fine" | High | Clear outcome definitions; signs; food-refusal signal | No record of *when* the first sign appeared. "Calm but watching the door" has no guidance | L1 "mark first sign" during a departure; a review hint that resting near the door with a loose body is not distress |
| 5 | **Medication.** Prozac/Reconcile, clomipramine, trazodone, clonidine, gabapentin; 4–8 weeks to take effect; "people are so weird about meds" | Very high | Vet/behaviourist referral tier; never prescribes | Owners can't mark when a vet-prescribed medication started or changed, so its effect is invisible | L3 life-event marker "Vet medication started or changed" (owner-entered, never advice or dosing) |
| 6 | **Camera anxiety and camera use.** Checking the camera between departures; obsessive checking; "an earbud to listen"; bark-alert cameras | High | Timer survives app switching; return alert; camera optional; "listening from another room" offered | No tip for the owner's own camera-checking | N5 marketing claim; a short "watching without spiralling" tip in help content |
| 7 | **Two-person households.** "Only ever works when ONE of us leaves", "hyper-attached to me", can't be left even with the partner | Medium | Separate training tracks | Not suggested as a use for tracks. No "who left" context | N2 context tag "Someone else was home"; track templates such as "Both of us leave" |
| 8 | **Crate vs free roam.** Crate panic, confinement anxiety | Medium | Crated/free-roam tags, confinement guidance, pre-protocol observation | Covered | None |
| 9 | **New rescues and puppies.** "Is this SA or decompression?", 3-3-3 rule, first weeks | Medium | Pre-protocol observation; gentle start | Setup never asks how long the dog has lived there | N3 setup note: early behaviour may be adjustment, still train gently |
| 10 | **Food, Kongs and treat feeders (FRIDA).** Several of the year's top posts; owners switching from gradual departures after stalling | High and rising | Food-refusal signal only | Can't record that food, a chew or a remote feeder was used, so progress with and without it can't be compared | N2 tags "Food or chew left" and "Remote feeder used"; `EVIDENCE-BASE.md` note on FRIDA as an unreviewed practitioner protocol |
| 11 | **Sudden onset, older dogs, medical.** A calm dog suddenly destructive at 8; dementia; IVDD, GI or seizure histories | Medium | Safety check covers injury and escape | Nothing prompts a vet check for sudden onset, age or illness | N3 add to setup's safety check: sudden onset, a senior dog or recent illness means see the vet first |
| 12 | **Noise and other triggers.** Lifts, neighbours, fireworks, cat fights; time of day | Medium | Time-of-day tags | No noise tag | N2 tag "Noise or disturbance" |
| 13 | **Aversive advice in the comments.** Bark collars, "just let him cry it out", "leave him for six hours" | Recurring | Positive stance; guide and evidence pages | Not answered head-on in the app or FAQ | FAQ: why bark collars and crying it out make SA worse, with sources |
| 14 | **Wanting hope and timelines.** "How long did it take you?"; success stories treasured | High | No population timelines (correct, per the evidence) | Personal trend is not summarised | L7 personal trend insight ("longest relaxed this month vs last"), never a forecast |
| 15 | **Trainer ghosted us, or the vet needs history.** "Our trainer basically stopped responding"; CSATs reviewing sessions | Medium | CSV and JSON export; referral copy says to bring the record | No readable summary | **N1 share-with-a-professional summary** |
| 16 | **Frequency and "sets".** "We should have trained more often"; multiple departures in a row made one dog worse | Medium | Daily ceiling (default 2, max 3); warm-ups configurable to 0 | Covered | None |
| 17 | **Rehoming and behavioural euthanasia crises** | Present | Referral tiers; not-your-fault copy | Out of scope beyond professional referral | Keep the copy compassionate; no new feature |

## Part 4. UX and UI audit (not yet fixed)

**Today**

- **First-run Today is long and puts the primary action below the fold.** On the micro-departure
  route a new user sees, in order: the one-time observation card, the plan, a starting note, the
  reason, the track card, the storage notice, the coverage card and the cue card. The first
  visible button is "I've watched them alone", not the plan. *Proposal (N4):* plan first; the
  observation card collapsed under the plan; static guidance (coverage, cue practice) collapsed
  into one "Guidance" section after the first week.
- **"Skip this step"** uses the setup Back button style inside a Today card. It renders as a small
  bordered chip hugging the card edge. Use a proper secondary or text button.
- The same four static cards appear on every visit. Repeated guidance becomes wallpaper.
  Collapsing or rotating it would give the plan and any support message more weight.

**Onboarding**

- No step indicator ("Step 2 of 4"). The steps are short, but an anxious owner benefits from
  knowing how many remain.
- Focus is not moved to the new step's heading. Scroll is now reset (fix 2); moving focus would
  complete it for keyboard and screen reader users.

**Live session**

- Past the target, the clock shows "+0:03" in orange under "Target reached". The ceiling framing
  would read better as "Time to head back". The walk-back window already uses that label, so
  keep the post-target state consistent with it.
- There is no way to note *when* the first sign appeared (see L1). This is the single most
  useful data point practitioners ask for.
- The header title is visually off-centre (grid column balance).

**Review**

- It is a long form: outcome, signs, stop reason, context, note, then Save, which is off-screen
  on phones. Consider collapsing "Context" and "Note" under "Add details" so Save sits close to
  the outcome.

**Progress, History and More**

- With one or two sessions the chart is one or two giant bars. Add an empty state until there are
  about 3 sessions.
- A consistency view (a calendar of training days, no streak counter) would answer "are we
  training often enough?" without pressure.
- More is a single long page mixing account, training settings, ceiling, alerts, data, danger
  zone, help and support. Group it into clearly headed sections, or split training settings from
  account and data.

**Accessibility**

- Fix 4 closes the toggle-state gap. The outstanding manual VoiceOver/TalkBack pass is
  `HARDENING-ROADMAP.md` F3.

## Part 5. Prioritised roadmap

**Now (this branch):** fixes 1–5 above.

**Next: small, fits the current hardening and beta phase**

- **N1. Share with a professional.** A print-friendly summary built from local data: plan
  history, outcomes, signs, context and notes, with the evidence and heuristic disclaimer. It
  prints to PDF from the browser, with no server and no new data leaving the device. It closes
  the loop the referral copy already opens.
- **N2. Context tags** for "Food or chew left", "Remote feeder used", "Noise or disturbance" and
  "Someone else was home". The tag allowlists in backup and sync derive from
  `SESSION_TAG_OPTIONS`, so this is mostly additive. Add a round-trip test anyway.
- **N3. Setup safety and context:** sudden onset, a senior dog or recent illness means see the vet
  first; a new-dog adjustment note. Copy only, no routing change.
- **N4. Declutter Today** (Part 4).
- **N5. Positioning copy** that names the failures SettledSolo avoids without naming competitors:
  "keeps time while you watch your camera app", "never makes the next session harder after a
  difficult one", "free, no subscription, iPhone and Android".

**Later: needs design, and evidence review where noted**

> Status, 24 September 2026: L1–L7 are implemented on `claude/settledsolo-later-items` (see
> `HANDOVER.md` and the product rules in `EVIDENCE-BASE.md`). Household sharing and multi-dog
> stay deferred until account sync is proven on real devices.

- **L1. Mark the first sign during a departure.** Records the latency to the first sign, which
  could become the plan's anchor instead of the return time. Engine change, so evidence review
  and tests are needed.
- **L2. Log an unavoidable absence** separately from training, so the record is honest and the
  plan can soften after an over-threshold real absence.
- **L3. Life-event and medication-change markers** on the Progress timeline (moved house,
  illness, new baby, vet medication started or changed). Owner-entered context only.
- **L4. Coverage planner:** the week's real absences and who covers each one.
- **L5. Plateau guidance** after many sessions without an increase, separate from the distress
  referral (a plateau is not failure; options include checking cues, time of day and medication
  with the vet).
- **L6. Owner-wellbeing content:** burnout, guilt, resentment and "you're allowed a rest day".
- **L7. Personal trend insight** (this month vs last), never a population timeline.
- **Household sharing and multi-dog** once account sync is proven on real devices.

**Not doing**, and why: timer extensions and streaks (pressure against the ceiling rule), an AI
chat coach (generic or wrong advice, no evidence base), two-way camera talk (a trainer and owners
on Reddit report it can raise arousal; see the 18 September research), population timelines or
efficacy claims (no evidence base), and any medication dosing or drug information (vets only).

## Sources

Competitors

- [Be Right Back app](https://julienaismith.com/app/) and
  [programme pricing](https://julienaismith.com/heroes/);
  [trainer page on the BRB app](https://www.separationanxietydogpro.com/be-right-back-sa-pro-trainer-app-for-dog-separation-anxiety/)
- [Separation Buddy on the App Store](https://apps.apple.com/us/app/separation-buddy-dog-training/id6747004196)
  and [website](https://separationbuddy.com/)
- [Calm My Dog on the App Store](https://apps.apple.com/us/app/training-help-calm-my-dog/id1629500193)
  and [website](https://calmmydog.app/)
- [PawCalm](https://www.pawcalm.ai/);
  [Solo Serenity](https://learn.anjibartondogtraining.com/separationanxietyapp)

Owner communities (via a Redlib mirror; reddit.com is blocked from this environment)

- r/Separation_Anxiety: "What has worked for my dog" (1ob4wai), "At my wits end" (1qj8crv),
  "Desperately need advice" (1wdko50), "I just want my life back" (1tq64dr), "Separation anxiety
  is the worst thing I've ever had to deal with" (1tpwngg), "No improvement" (1k9ajly), "Need
  advice on slow progress" (1wndmnv), "i'm starting to resent my dog" (1wn89g7), "How to manage MY
  anxiety" (1qs4ws3), "I'm exhausted and depressed" (1szttvi), "We reached 90 minutes!" (1vn64ua),
  "People are SO WEIRD about putting dogs on medication" (1k6d7qq), the FRIDA threads (1og91r2,
  1vk4y33, 1vpgbiv, 1wok7c8)
- r/Dogtraining Separation Anxiety Support Group, 28 July – 22 September 2026; "Severe separation
  anxiety dog + apartment + no support system" (1q7eisw); "Phone app suggestions for tracking
  duration training" (f8zdny)
- r/reactivedogs "Is BE my only option?" (1q67t1e); r/dogs "Has anyone bought a second dog…"
  (1r7wqqt); r/DogAdvice "My dog all of a sudden has had EXTREME separation anxiety" (1oelidf);
  r/puppy101 "My Ultimate 'Home Alone' Training Guide" (1rw3xzz)
- Mumsnet: [Close to despair re separation anxiety](https://www.mumsnet.com/talk/the_doghouse/4646344-close-to-despair-re-separation-anxiety),
  [Do your dogs struggle when left alone?](https://www.mumsnet.com/talk/pets/5342652-do-your-dogs-struggle-when-left-alone-how-do-you-handle-it)
- FRIDA (Nadine Hehli and Simone Fasel; popularised by
  [Shaped by Dog episode 200](https://dogsthat.com/podcast/200/)). No peer-reviewed evaluation
  was found.
