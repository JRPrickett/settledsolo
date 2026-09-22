import type { ReactNode } from "react";
import { PublicSite } from "./PublicSite";
import { BrandWordmark } from "../brand/BrandMark";
import { OptionalSupportCard } from "./PublicSupport";
import { contactEmail, feedbackMailto } from "./contact";
import { isPublicPagePath, normalisePublicPath } from "./routes";

const CANONICAL_ORIGIN = "https://settledsolo.com";
const DEFAULT_DESCRIPTION =
  "Free dog separation anxiety training tool for gradual, observable alone-time practice, with a reliable timer, private history and evidence-informed guidance.";

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

function setPublicMetadata(title: string, description: string, path: string) {
  document.title = title;
  setRobots("index,follow");
  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", `${CANONICAL_ORIGIN}${path}`);
  setMeta("property", "og:site_name", "SettledSolo");
  setMeta("property", "og:image", `${CANONICAL_ORIGIN}/photos/hero-settled-at-home-v2.webp`);
  setMeta("property", "og:image:alt", "A relaxed dog resting comfortably at home.");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", `${CANONICAL_ORIGIN}/photos/hero-settled-at-home-v2.webp`);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = `${CANONICAL_ORIGIN}${path}`;
}

function PublicNavigation() {
  return (
    <nav aria-label="Public site">
      <div className="marketing-desktop-links">
        <a href="/">Home</a>
        <a href="/help">Help</a>
        <a href="/resources">Resources</a>
        <a href="/evidence">Evidence</a>
      </div>
      <details className="marketing-mobile-menu">
        <summary>Explore</summary>
        <div>
          <a href="/">Home</a>
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
            <a href="/help">Help</a>
            <a href="/resources">Resources</a>
            <a href="/evidence">Evidence</a>
          </span>
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
      <h2>Background return alerts</h2>
      <p>
        If you enable background return alerts, the installed app creates a browser push
        subscription. For each main departure, SettledSolo sends Cloudflare the push
        endpoint for that installed copy, an anonymous installation ID, an opaque session
        token and the scheduled return time. Dog names, notes, outcomes and training
        history are not included. Pending alert data is cleared after delivery or when
        the app successfully cancels the alert.
      </p>
      <h2>Product analytics are separate</h2>
      <p>
        SettledSolo does not send app-open, session or device-level product events to a
        separate analytics database. Registered-account totals are the canonical user
        metric; aggregate web traffic may still be measured separately by Cloudflare Web
        Analytics.
      </p>
      <h2>Backups and exports</h2>
      <p>
        You can export a JSON backup and CSV history from the app. Those files are
        created on your device and are yours to store or delete.
      </p>
      <h2>Accounts are optional</h2>
      <p>
        Where accounts are enabled, you can sign in using an email code. Cloudflare
        hosts the account service and its separate private database. Resend delivers
        sign-in codes to your email address; it does not receive your training log.
        Signing in alone does not upload existing local history. The app shows an import
        summary and asks before connecting your log.
      </p>
      <h2>Sync and account controls</h2>
      <p>
        After you connect, dog names, tracks, session observations, notes and settings
        are stored with your account for backup and cross-device sync. Essential secure
        cookies keep you signed in. Account/session records may contain IP address and
        browser information for authentication and abuse protection. Deleted training
        records remain as sync deletion markers and may appear in change history until
        the account is deleted.
      </p>
      <p>
        More → Account &amp; backup provides cloud export, sign-out and account deletion.
        Deleting an account removes its active account and cloud training records; it
        does not erase logs already downloaded on your devices. Use the separate local
        reset on each device if you want to remove those too. Resolved conflict versions
        remain on the device and can be exported or cleared with local reset.
      </p>
      <h2>Questions about your data</h2>
      <p>
        Export, restore, local reset and account deletion are self-service in the app,
        so you never need to ask permission to take or remove your record. For anything
        else about this notice, see <a href="/contact">contact and feedback</a>.
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
        Core training is free, with no signup wall. There is no trial that silently
        converts to a paid subscription. If optional paid features are introduced,
        enrolment will require clear, explicit opt-in and cancellation will not require
        contacting support.
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
        The exact software increments, repetition rules and support flags are conservative
        product heuristics. They are deliberately explainable and are not described as a
        clinically validated dose of training.
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
        page</a> with cautious product heuristics. They are not a diagnosis, a
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
        <details>
          <summary>How many sessions should I do?</summary>
          <p>
            SettledSolo uses a conservative daily ceiling, not a required quota. A
            shorter session or a rest day can be the right choice when your dog or
            circumstances need it.
          </p>
        </details>
        <details>
          <summary>Is a crate always the right place to practise?</summary>
          <p>
            No. If distress appears only with confinement, treat that as important
            information and avoid assuming it is purely separation-related. Use a setup
            your dog can already manage safely and ask for support if unsure.
          </p>
        </details>
        <details>
          <summary>What if my dog looks worried before I leave?</summary>
          <p>
            Practise one small departure cue while staying home: pick up keys, put on
            shoes or touch the door, then return to ordinary activity before concern
            builds. Keep cue practice brief and separate from timed absences.
          </p>
        </details>
        <details>
          <summary>Is separation anxiety just boredom or stubbornness?</summary>
          <p>
            Not necessarily. Separation-related distress can include subtle changes such
            as pacing, panting, exit-watching or refusing food. A camera or careful
            observation can help distinguish it from boredom, frustration, confinement or
            another problem.
          </p>
        </details>
        <details>
          <summary>Should I ignore my dog when I get home?</summary>
          <p>
            No special coldness is required. Keep the return calm and ordinary, and focus
            on avoiding absences that are too difficult. Comfort after a hard moment is
            not something you need to withhold.
          </p>
        </details>
        <details>
          <summary>Will spaying, neutering or medication fix this?</summary>
          <p>
            There is no one-size-fits-all answer that the app can safely give. Medical
            decisions and medication belong with your veterinarian, who can consider the
            whole dog, the home setup and any other health factors.
          </p>
        </details>
        <details>
          <summary>What if I miss a day?</summary>
          <p>
            Nothing needs catching up. Resume with an easy, familiar step rather than
            increasing difficulty to compensate.
          </p>
        </details>
        <details>
          <summary>When should I stop and ask for help?</summary>
          <p>
            Pause timed practice for self-injury, destructive escape attempts, rapidly
            escalating distress or repeated sessions that cannot stay manageable. A vet
            or qualified behaviour professional can help you work out the safest next
            step.
          </p>
        </details>
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

export function PublicRouter() {
  const path = normalisePublicPath(window.location.pathname);

  if (!isPublicPagePath(path)) {
    document.title = "Page not found — SettledSolo";
    setRobots("noindex,follow");
    document.head.querySelector('link[rel="canonical"]')?.remove();
    return <NotFoundPage />;
  }

  if (path === "/privacy") {
    setPublicMetadata("Privacy — SettledSolo", "How SettledSolo handles local training records, optional accounts and sync.", path);
    return <PrivacyPage />;
  }
  if (path === "/terms") {
    setPublicMetadata("Terms — SettledSolo", "The scope, limits and free-core principles for SettledSolo.", path);
    return <TermsPage />;
  }
  if (path === "/help") {
    setPublicMetadata("Help — dog separation anxiety training | SettledSolo", "Practical help for calm, gradual dog separation anxiety training with SettledSolo.", path);
    return <HelpPage />;
  }
  if (path === "/resources") {
    setPublicMetadata("Dog separation anxiety resources | SettledSolo", "Owned FAQs, printable checklists and observation tools for gradual dog separation anxiety training.", path);
    return <ResourcesPage />;
  }
  if (path === "/contact") {
    setPublicMetadata("Contact and feedback — SettledSolo", "How to send beta feedback and manage your SettledSolo data yourself.", path);
    return <ContactPage />;
  }
  if (path === "/evidence") {
    setPublicMetadata("Evidence-informed dog separation training | SettledSolo", "The research, safety boundaries and product heuristics behind SettledSolo.", path);
    return <EvidencePage />;
  }

  setPublicMetadata("Free dog separation anxiety training tool | SettledSolo", DEFAULT_DESCRIPTION, "/");
  return <PublicSite />;
}
