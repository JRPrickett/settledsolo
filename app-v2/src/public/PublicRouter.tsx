import type { ReactNode } from "react";
import { RESOURCE_FAQS } from "./faqs";
import { PublicSite } from "./PublicSite";
import { BrandWordmark } from "../brand/BrandMark";
import { OptionalSupportCard } from "./PublicSupport";
import { contactEmail, feedbackMailto } from "./contact";
import { supportProvider } from "./support";
import { GUIDE_PATH, isPublicPagePath, normalisePublicPath, type PublicPagePath } from "./routes";
import { CANONICAL_ORIGIN, formatReviewDate, PAGE_META } from "./pageMeta";

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function setRobots(content: string) {
  setMeta("name", "robots", content);
}

/**
 * Keeps the tab title and tags right during client-side use. Crawlers get the
 * same values from the Worker, which writes them into the served HTML.
 */
function setPublicMetadata(path: PublicPagePath) {
  const meta = PAGE_META[path];
  const url = `${CANONICAL_ORIGIN}${path}`;
  const image = `${CANONICAL_ORIGIN}${meta.image}`;
  document.title = meta.title;
  setRobots("index,follow");
  setMeta("name", "description", meta.description);
  setMeta("property", "og:title", meta.title);
  setMeta("property", "og:description", meta.description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:image", image);
  setMeta("property", "og:image:alt", meta.imageAlt);
  setMeta("name", "twitter:title", meta.title);
  setMeta("name", "twitter:description", meta.description);
  setMeta("name", "twitter:image", image);
  setMeta("name", "twitter:image:alt", meta.imageAlt);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

function PublicNavigation() {
  return (
    <nav aria-label="Public site">
      <div className="marketing-desktop-links">
        <a href="/">Home</a>
        <a href={GUIDE_PATH}>Guide</a>
        <a href="/help">Help</a>
        <a href="/resources">Resources</a>
        <a href="/evidence">Evidence</a>
      </div>
      <details className="marketing-mobile-menu">
        <summary>Explore</summary>
        <div>
          <a href="/">Home</a>
          <a href={GUIDE_PATH}>Guide</a>
          <a href="/help">Help</a>
          <a href="/resources">Resources</a>
          <a href="/evidence">Evidence</a>
        </div>
      </details>
      <a href="/app/" className="marketing-nav-cta">Open app</a>
    </nav>
  );
}

function InfoPage({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="marketing-shell">
      <header className="marketing-header">
        <a className="marketing-brand" href="/" aria-label="SettledSolo home">
          <BrandWordmark compact light />
        </a>
        <PublicNavigation />
      </header>
      <main className="info-page">
        <h1>{title}</h1>
        <div className="info-page-copy">{children}</div>
      </main>
      <footer className="marketing-footer">
        <BrandWordmark compact light />
        <div>
          <span className="marketing-footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
            <a href={GUIDE_PATH}>Training guide</a>
            <a href="/help">Help</a>
            <a href="/resources">Resources</a>
            <a href="/evidence">Evidence</a>
          </span>
          <span>SettledSolo is built and maintained by Jason Prickett, an individual trading as Southwest Websites.</span>
          <span>SettledSolo is a training and record-keeping aid, not a diagnosis.</span>
        </div>
      </footer>
    </div>
  );
}

function PrivacyPage() {
  return (
    <InfoPage title="Your training record belongs to you.">
      <h2>Local-first by default</h2>
      <p>
        SettledSolo stores your dog name, training tracks, session history, notes and
        observed signals on your device. You can use the core app without creating an
        account.
      </p>
      <h2>Reminders and analytics</h2>
      <p>
        If you enable reminders, we use the reminder time to send them. Reminders do not
        include your dog&apos;s name or training notes. We may count general website visits,
        but we do not use your training history for analytics or advertising.
      </p>
      <h2>Using the app and sending feedback</h2>
      <p>
        Without an account, your training record stays on your device until you delete
        it. If you choose to send feedback, it may include basic device or browser
        details, but never your dog&apos;s name or training history.
      </p>
      <h2>Backups and exports</h2>
      <p>
        You can export a JSON backup and CSV history from the app. Those files are
        created on your device and are yours to store or delete.
      </p>
      <h2>Accounts are optional</h2>
      <p>
        You can create an account with your email address. Signing in does not upload
        your training history. The app shows what will be connected and asks you first.
      </p>
      <h2>Account and training information</h2>
      <p>
        If you connect an account, your email is used to sign you in and your dog&apos;s
        name, tracks, observations, notes and settings are saved so you can back up or
        use your history across devices. We use basic sign-in details to protect
        accounts.
      </p>
      <p>
        Account &amp; backup lets you export your account data, sign out or delete your
        account. Deleting the account removes its cloud training history. It does not
        delete copies saved on your devices; reset each device separately if you want
        to remove those.
      </p>
      <h2>Optional support payments</h2>
      <p>
        If you choose to make an optional contribution, {supportProvider} and its payment
        processors handle the payment under their own privacy policies. SettledSolo never
        receives your card or bank details. We may see the name, email address and message
        you give {supportProvider}, which we use only to acknowledge your support and keep
        financial records. A contribution is never linked to your training record.
      </p>
      <h2>How long we keep information</h2>
      <p>
        Information on your device stays there until you delete it. Information
        connected to your account stays until you delete the account. We keep other
        information only as long as needed to provide and protect SettledSolo or meet
        legal obligations.
      </p>
      <h2>Your privacy choices and rights</h2>
      <p>
        You can export or delete your data in the app. You may also have the right to
        access, correct, erase or restrict your information, object to some uses, or
        request a copy. For a privacy request, email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. You can also complain
        to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">Information Commissioner&apos;s Office</a>.
      </p>
    </InfoPage>
  );
}

function TermsPage() {
  return (
    <InfoPage title="A training aid, not a diagnosis.">
      <h2>What SettledSolo does</h2>
      <p>
        SettledSolo helps you plan gradual separation-training sessions, time them,
        record observations and review progress.
      </p>
      <h2>Pricing and billing</h2>
      <p>
        Core training is free. Any paid feature will show what it includes, its price,
        whether payment is one-off or recurring, and how to cancel before you pay. No
        recurring charge starts without your clear agreement. Your consumer rights
        remain unchanged.
      </p>
      <p>
        Any optional contribution is one-off and does not unlock app features. Checkout
        will show the amount and payment terms before you confirm.
      </p>
      <h2>What it does not do</h2>
      <p>
        It does not diagnose separation anxiety, provide veterinary care or guarantee a
        behavioural outcome, and it is not a substitute for an accredited separation
        anxiety specialist or a veterinary behaviourist. Generated targets are planning
        suggestions and can be made easier at any time.
      </p>
      <h2>Use observation first</h2>
      <p>
        Return early when your dog shows meaningful concern. Do not use a timer target as
        a reason to continue an absence that is becoming difficult.
      </p>
      <h2>Professional support</h2>
      <p>
        Seek support from an accredited separation anxiety specialist or a veterinary
        behaviourist for severe, escalating or persistent distress, self-injury risk,
        destructive escape behaviour or whenever you are unsure how to proceed safely. A
        veterinarian or veterinary behaviourist is the right contact if medication may
        help.
      </p>
    </InfoPage>
  );
}

function EvidencePage() {
  return (
    <InfoPage title="Principles first. False precision never.">
      <p>
        SettledSolo is built around gradual systematic desensitisation: begin with an
        absence mild enough not to evoke meaningful distress, observe the dog, and adapt
        difficulty to the individual rather than forcing a fixed timetable.
      </p>
      <h2>Systematic desensitisation</h2>
      <p>
        Butler, Sargisson and Elliffe (2011) reported reductions in separation-related
        behaviour during an owner-applied systematic-desensitisation programme. The
        study was small, so SettledSolo treats the behavioural principle as useful
        evidence without pretending it establishes a universal progression formula.
      </p>
      <p>
        <a href="https://doi.org/10.1016/j.applanim.2010.11.001" target="_blank" rel="noreferrer">
          Butler et al., Applied Animal Behaviour Science (2011)
        </a>
      </p>
      <h2>Observe, do not just time</h2>
      <p>
        Video-observation research has documented behaviours such as vocalisation,
        panting, environmental orientation and destructive behaviour during separation.
        That is why SettledSolo encourages direct observation and records behavioural
        signs alongside duration.
      </p>
      <p>
        <a href="https://doi.org/10.1016/j.applanim.2010.01.014" target="_blank" rel="noreferrer">
          Palestrini et al., Applied Animal Behaviour Science (2010)
        </a>
      </p>
      <h2>Signs can be easy to miss</h2>
      <p>
        Stress is not always loud. Pacing, panting, repeated lip-licking or yawning,
        freezing, refusing a normally welcome treat, watching the exit or following you
        closely before departure can all be useful observations. None of these signs is
        diagnostic on its own; context and direct observation matter.
      </p>
      <h2>Management is part of the plan</h2>
      <p>
        Where practical, avoid absences that are longer than your dog can currently
        manage while you are building comfort. A sitter, daycare, friend, schedule change
        or work-from-home day can protect the gaps between planned sessions. Calm comfort
        after a return is fine; there is no need to make reunions cold or dramatic.
      </p>
      <h2>Medical questions stay with a vet</h2>
      <p>
        SettledSolo cannot decide whether medication, confinement changes, illness or a
        procedure such as spaying or neutering is relevant to an individual dog. The
        evidence is not strong enough for a general app rule, so those decisions belong
        in a conversation with your veterinarian.
      </p>
      <h2>What the app adds</h2>
      <p>
        The exact software increments, repetition rules and support flags are cautious
        rules of thumb chosen by SettledSolo. They are deliberately explainable and are not described as a
        clinically validated dose of training.
      </p>
      <h2>How big each step is</h2>
      <p>
        Each change is about a tenth of the current time, never more than two minutes.
        Dogs judge durations by ratio, and in a small timing study they needed a difference
        of roughly 44% or more to tell two durations apart, so a 10% step should be barely
        noticeable. The step only moves up after clean relaxed sessions, holds when you note
        stress signs, and starts a step easier after a week or more away. The pace also
        follows recent sessions: about 5% after any recent difficulty, 10% normally, and
        15% after a sustained calm run.
      </p>
      <p>
        <a href="https://doi.org/10.3390/ani9100801" target="_blank" rel="noreferrer">
          Cliff et al., Animals (2019)
        </a>
      </p>
      <h2>Frequency and warm-up variation</h2>
      <p>
        There is no published universal number of timed departures to perform each day.
        SettledSolo uses two timed sessions as its default daily ceiling and three as its
        absolute maximum; a session that stops during a warm-up still uses one allowance.
        Departure-cue practice does not count because the owner never leaves. This is a
        conservative product boundary, not a clinical prescription.
      </p>
      <p>
        SettledSolo&apos;s practical guidance also favours short, realistic practice,
        enough recovery between repetitions, management that avoids rehearsing panic and
        regular easier days. Those are an independent synthesis for this product, not a
        universal dosage or guarantee.
      </p>
      <h2>High-risk signs</h2>
      <p>
        Self-injury, escape attempts or damaging doors, windows or barriers are not a
        reason to collect more app data. Pause timed departures and contact your vet or a
        qualified behaviour professional.
      </p>
      <p>
        The peer-reviewed sources and product boundary notes are collected in the
        <a href="/resources">SettledSolo resources</a>, including printable checklists
        and an observation log.
      </p>
    </InfoPage>
  );
}

function GuidePage() {
  return (
    <InfoPage title="How to train a dog with separation anxiety">
      <p className="info-lede">
        Separation anxiety training for dogs means building alone time gradually from a
        duration your dog already handles calmly, staying below the point where they become
        worried, and increasing only in small steps after calm sessions. Watch what actually happens, go back a step after any sign of
        concern, and avoid longer absences in between. This approach is called systematic
        desensitisation.
      </p>
      <p className="info-note">
        Written by SettledSolo&apos;s maker from the published research listed at the end.
        Last reviewed {formatReviewDate(PAGE_META[GUIDE_PATH].updated)}. General information, not a diagnosis
        or individual veterinary or behavioural advice.
      </p>

      <h2>What is separation anxiety in dogs?</h2>
      <p>
        Separation anxiety, often called separation-related distress, is when a dog
        becomes worried or panicked when left alone or apart from a particular person. It
        is a welfare problem, not disobedience or spite. Boredom, noise fears, confinement
        stress, illness or incomplete house training can look similar, so only a vet or
        qualified behaviour professional can assess an individual dog.
      </p>

      <h2>What are the signs of separation anxiety?</h2>
      <p>Signs usually appear while the dog is alone or as you get ready to leave:</p>
      <ul>
        <li>barking, whining or howling;</li>
        <li>pacing, panting or being unable to settle;</li>
        <li>scratching or chewing at doors, windows or barriers;</li>
        <li>toilet accidents in a dog that is otherwise house trained;</li>
        <li>drooling, trembling, or refusing food or a favourite chew;</li>
        <li>watching the exit, or following you closely as you prepare to leave.</li>
      </ul>
      <p>
        Many signs are quiet, so a video of an absence is often the clearest way to see
        what really happens. Researchers use video for the same reason (Palestrini et al.,
        2010).
      </p>

      <h2>How do you train a dog to be left alone?</h2>
      <ol>
        <li>
          <strong>Start from something already calm.</strong> Choose a duration you have
          seen your dog handle without concern, even a few seconds. Never leave until they
          become distressed just to find their limit.
        </li>
        <li>
          <strong>Keep departures ordinary.</strong> Leave and return calmly, without a
          big goodbye or a dramatic reunion.
        </li>
        <li>
          <strong>Watch if you can.</strong> A camera or baby monitor shows the first small
          signs of worry. It helps, but it is not essential.
        </li>
        <li>
          <strong>Come back before concern builds.</strong> A target is a ceiling, not a
          quota. A shorter, relaxed absence is still useful practice.
        </li>
        <li>
          <strong>Increase in small steps, only after calm sessions.</strong> Repeat a
          duration until it is easy before making it longer.
        </li>
        <li>
          <strong>Make it easier after a difficult session.</strong> Go back to a step your
          dog found easy rather than pushing on.
        </li>
        <li>
          <strong>Manage the gaps.</strong> While you train, avoid leaving your dog alone
          for longer than they can currently manage.
        </li>
      </ol>
      <p>
        An owner-led programme of this kind reduced separation-related behaviour in a small
        study (Butler et al., 2011). The study was small, so treat it as support for the
        principle rather than a fixed recipe.
      </p>

      <h2>How much should I increase the time each session?</h2>
      <p>
        In small steps. No increment has been clinically validated. SettledSolo uses about
        10% of the current duration, never more than two minutes, as its own rule of
        thumb. In a small timing study, dogs needed a difference of roughly 44% or more
        to tell two durations apart (Cliff et al., 2019), so a 10% step should be barely
        noticeable. Hold the duration or go back after any sign of concern.
      </p>

      <h2>How long does separation anxiety training take?</h2>
      <p>
        There is no reliable universal timeline. Progress depends on the dog, where they
        start and how well other absences can be managed. Expect uneven progress, with
        plateaus and easier days. A run of calm sessions matters more than speed.
      </p>

      <h2>How long can I leave a dog with separation anxiety alone?</h2>
      <p>
        Only as long as they can currently stay calm, which may be seconds or minutes at
        first. Plan other absences around that: a sitter, daycare, a friend or neighbour,
        taking your dog with you, or a changed routine. Absences that tip your dog into
        panic can undo progress.
      </p>

      <h2>Should I crate a dog with separation anxiety?</h2>
      <p>
        Not automatically. Some dogs are more distressed when confined. Practise in a setup
        your dog already finds safe, and treat distress that appears only with confinement
        as important information rather than assuming it is purely about being alone.
      </p>

      <h2>Should I punish or ignore my dog?</h2>
      <p>
        Do not punish anything you find when you come home: it cannot teach calm and may add
        fear. You do not need to ignore your dog either. Keep departures and returns calm
        and ordinary, and comfort them if they need it.
      </p>

      <h2>When should I get professional help?</h2>
      <p>
        Pause timed practice and contact your vet or a qualified behaviour professional if
        you see self-injury, escape attempts, damage to doors or windows, rapidly escalating
        distress, or repeated sessions that cannot stay calm. A vet is the right person to
        discuss whether a health problem or medication is relevant.
      </p>

      <h2>How SettledSolo helps</h2>
      <p>
        SettledSolo is a free separation anxiety training app for this process. It suggests a small next step from your
        recent sessions, times each departure reliably, records what you observed and
        explains every suggestion. It works without an account and keeps your training
        record on your device.
      </p>

      <h2>Sources</h2>
      <ul>
        <li>
          <a href="https://doi.org/10.1016/j.applanim.2010.11.001" target="_blank" rel="noreferrer">
            Butler, Sargisson and Elliffe (2011), Applied Animal Behaviour Science
          </a>
        </li>
        <li>
          <a href="https://doi.org/10.1016/j.applanim.2010.01.014" target="_blank" rel="noreferrer">
            Palestrini et al. (2010), Applied Animal Behaviour Science
          </a>
        </li>
        <li>
          <a href="https://doi.org/10.3390/ani9100801" target="_blank" rel="noreferrer">
            Cliff et al. (2019), Animals
          </a>
        </li>
      </ul>
      <p>
        More detail on how the app uses this research is on the{" "}
        <a href="/evidence">evidence page</a>.
      </p>
      <a className="marketing-primary info-cta" href="/app/">Start training free</a>
      <a className="marketing-secondary info-cta" href="/help">Read the training help</a>
    </InfoPage>
  );
}

function HelpPage() {
  return (
    <InfoPage title="Keep the next step calm and manageable.">
      <h2>Start with something already comfortable</h2>
      <p>
        Do not deliberately leave until your dog becomes distressed to discover a
        maximum. Start from a duration you have already observed them cope with calmly.
      </p>
      <h2>Manage the gaps</h2>
      <p>
        During early training, use a sitter, daycare, schedule change or another safe
        arrangement when possible so your dog is not repeatedly practising panic between
        planned sessions.
      </p>
      <h2>Use a camera when you can</h2>
      <p>
        Direct observation is more useful than guessing what happened while you were out
        of sight, but a camera is optional. Do not keep monitoring if it increases your
        own anxiety or changes how you interact with your dog.
      </p>
      <h2>Returning early is okay</h2>
      <p>
        The target is a ceiling, not a quota. A shorter relaxed session is useful
        training information. If concern appears, end the absence and make the next
        session easier.
      </p>
      <h2>Comfort is not a reward you need to withhold</h2>
      <p>
        Keep departures and returns ordinary, but there is no training benefit in making
        your dog wait for comfort after you come home. The important boundary is avoiding
        repeated absences that push them into panic.
      </p>
      <h2>What if the trigger is not the absence?</h2>
      <p>
        Noise, confinement, illness, incomplete housetraining or a changed routine can
        look similar from a distance. Record what you observe and ask a vet or qualified
        behaviour professional when the picture is unclear.
      </p>
      <h2>Know when to pause</h2>
      <p>
        Repeated difficult sessions, escalating distress, self-injury or destructive
        escape behaviour are reasons to pause timed departures and consider professional
        support, not to push the plan harder.
      </p>
      <h2 id="when-progress-stalls">When progress stalls</h2>
      <p>
        Plateaus are common and are not a sign that you have failed. If the plan has not
        moved on for a couple of weeks, check whether getting-ready cues still worry your
        dog, whether some times of day or setups go better than others, and whether real
        absences outside training are covered. A vet can check for anything medical and
        talk through whether medication alongside training would help, and a qualified
        separation-anxiety professional can review your sessions with you.
      </p>
      <h2 id="looking-after-yourself">Looking after yourself too</h2>
      <p>
        Living with separation anxiety can mean cancelled plans, missed appointments,
        worry about neighbours and a lot of money spent on cover. Many owners describe
        feeling trapped, exhausted, guilty and sometimes resentful of a dog they love.
        Those feelings are common, and they do not make you a bad owner.
      </p>
      <ul>
        <li>
          A rest day is part of the plan. Skipping training when you or your dog are not
          up to it will not undo your progress.
        </li>
        <li>
          Cover does not have to be perfect or expensive. Swapping sitting with another
          owner, a friend who works from home or a short daycare session all count.
        </li>
        <li>
          Watching the camera for a whole absence can raise your own anxiety. Once sessions
          are going well, try checking briefly instead of watching throughout.
        </li>
        <li>
          Talk to someone. A vet or a qualified behaviour professional can share the load,
          and if you are struggling with your own mental health, your doctor or a support
          line can help you too.
        </li>
      </ul>
      <a className="marketing-primary info-cta" href="/resources">Read the practical resources</a>
      <a className="marketing-secondary info-cta" href="/app/">Open SettledSolo</a>
    </InfoPage>
  );
}

function ResourcesPage() {
  return (
    <InfoPage title="Dog separation anxiety resources you can use.">
      <p>
        These are SettledSolo&apos;s own plain-language notes for planning calm alone-time
        practice. They combine the evidence listed on the <a href="/evidence">evidence
        page</a> with cautious rules of thumb of our own. They are not a diagnosis, a
        replacement for veterinary care or a promise of a particular result.
      </p>
      <section className="resource-downloads" aria-labelledby="downloads-heading">
        <div>
          <p className="marketing-eyebrow">Free downloads</p>
          <h2 id="downloads-heading">Keep the useful reminders close by.</h2>
          <p>
            These are SettledSolo&apos;s own printable pages for the fridge, notebook or
            training bag. They are designed to support observation without turning every
            departure into a performance review.
          </p>
        </div>
        <div className="resource-download-grid">
          <a className="resource-download" href="/resources/settledsolo-session-cheatsheet.pdf" download>
            <span>PDF download</span>
            <strong>One-session cheat sheet</strong>
            <p>Five reminders for choosing, observing and closing a manageable session.</p>
            <b>Download the cheat sheet <span aria-hidden="true">↗</span></b>
          </a>
          <a className="resource-download" href="/resources/settledsolo-setback-checklist.pdf" download>
            <span>PDF download</span>
            <strong>Setback checklist</strong>
            <p>A calm sequence for reviewing a difficult session and choosing a smaller next step.</p>
            <b>Download the checklist <span aria-hidden="true">↗</span></b>
          </a>
          <a className="resource-download" href="/resources/settledsolo-observation-log.pdf" download>
            <span>PDF download</span>
            <strong>Observation log</strong>
            <p>A printable five-session log for duration, context, first signs and recovery.</p>
            <b>Download the log <span aria-hidden="true">↗</span></b>
          </a>
        </div>
      </section>
      <h2>One-session cheat sheet</h2>
      <ol>
        <li>Choose a duration your dog has already handled comfortably.</li>
        <li>Keep the departure ordinary and use observation if available.</li>
        <li>Return early if meaningful concern appears; the target is never a quota.</li>
        <li>Let your dog settle before deciding whether to repeat or make it easier.</li>
        <li>Record what you saw, not only how long the absence lasted.</li>
      </ol>
      <h2>If a session goes badly</h2>
      <ul>
        <li>End the absence and help your dog return to a calm state.</li>
        <li>Make the next planned step shorter and simpler.</li>
        <li>Check for context such as illness, noise, confinement or a changed routine.</li>
        <li>Pause timed departures and seek help if distress is escalating, persistent or unsafe.</li>
      </ul>
      <h2>What is useful to record</h2>
      <p>
        Note the duration, the first observable change, what happened between repetitions,
        the environment and whether your dog recovered normally. A camera can help, but
        constant monitoring is not required.
      </p>
      <h2>Common questions</h2>
      <div className="faq-list">
        {RESOURCE_FAQS.map(({ question, answer }) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <OptionalSupportCard compact />
      <a className="marketing-primary info-cta" href="/app/">Open SettledSolo</a>
    </InfoPage>
  );
}

function ContactPage() {
  return (
    <InfoPage title="Tell us what would make training calmer.">
      <p>
        SettledSolo is in a small beta. Reports of anything confusing, broken or
        stressful to use help decide what to fix first.
      </p>
      {contactEmail ? (
        <>
          <h2>Send feedback</h2>
          <p>
            Email <a href={feedbackMailto(contactEmail)}>{contactEmail}</a>. It is
            most useful to know what you were trying to do, what happened and which
            device you were using.
          </p>
          <a className="marketing-primary info-cta" href={feedbackMailto(contactEmail)}>
            Email feedback
          </a>
        </>
      ) : (
        <>
          <h2>Feedback</h2>
          <p>
            A direct feedback inbox is not open yet. The self-service controls below
            cover your data, and the help pages cover training questions.
          </p>
        </>
      )}
      <h2>Please do not send training records</h2>
      <p>
        You never need to include your dog&apos;s name, notes or session history to
        report a problem. If a screenshot helps, check it first for anything you would
        rather keep private.
      </p>
      <h2>Your data, without asking</h2>
      <p>
        In the app, <strong>More → Your data</strong> downloads a complete backup or a
        CSV history at any time. <strong>More → Account &amp; backup</strong> provides
        cloud export, sign-out and account deletion. Local reset on each device removes
        the copy stored there. See the <a href="/privacy">privacy notice</a> for what is
        stored where.
      </p>
      <h2>If your dog is struggling now</h2>
      <p>
        SettledSolo cannot give individual advice. For self-injury, escape attempts or
        distress that keeps escalating, pause timed departures and contact your vet or
        a qualified behaviour professional.
      </p>
      <a className="marketing-secondary info-cta" href="/help">Read the training help</a>
    </InfoPage>
  );
}

function NotFoundPage() {
  return (
    <InfoPage title="This page is not here.">
      <p>
        The address may be mistyped, or the page may have moved. Your training record is
        unaffected; it lives in the app on your device.
      </p>
      <a className="marketing-primary info-cta" href="/app/">Open SettledSolo</a>
      <a className="marketing-secondary info-cta" href="/">Go to the home page</a>
    </InfoPage>
  );
}

/**
 * The page for a path, without touching the document. The build pre-renders
 * this into static HTML for crawlers; `PublicRouter` renders it in the browser.
 */
export function PublicPage({ path }: { path: string }) {
  switch (normalisePublicPath(path)) {
    case "/": return <PublicSite />;
    case "/privacy": return <PrivacyPage />;
    case "/terms": return <TermsPage />;
    case "/help": return <HelpPage />;
    case "/resources": return <ResourcesPage />;
    case "/contact": return <ContactPage />;
    case "/evidence": return <EvidencePage />;
    case GUIDE_PATH: return <GuidePage />;
    default: return <NotFoundPage />;
  }
}

export function PublicRouter() {
  const path = normalisePublicPath(window.location.pathname);

  if (isPublicPagePath(path)) {
    setPublicMetadata(path);
  } else {
    document.title = "Page not found — SettledSolo";
    setRobots("noindex,follow");
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }
  return <PublicPage path={path} />;
}
