import type { ReactNode } from "react";
import { PublicSite } from "./PublicSite";
import { BrandWordmark } from "../brand/BrandMark";

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

function setPublicMetadata(title: string, description: string, path: string) {
  document.title = title;
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
        <a href="/resources">SettledSolo resources</a> and the project&apos;s
        <a href="https://github.com/JRPrickett/settledsolo/blob/main/docs/EVIDENCE-BASE.md" target="_blank" rel="noreferrer">
          evidence-base notes
        </a>.
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
      <a className="marketing-primary info-cta" href="/app/">Open SettledSolo</a>
    </InfoPage>
  );
}

export function PublicRouter() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

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
    setPublicMetadata("Dog separation anxiety resources | SettledSolo", "Owned checklists, FAQs and practical resources for gradual dog separation anxiety training.", path);
    return <ResourcesPage />;
  }
  if (path === "/evidence") {
    setPublicMetadata("Evidence-informed dog separation training | SettledSolo", "The research, safety boundaries and product heuristics behind SettledSolo.", path);
    return <EvidencePage />;
  }

  setPublicMetadata("Free dog separation anxiety training tool | SettledSolo", DEFAULT_DESCRIPTION, "/");
  return <PublicSite />;
}
