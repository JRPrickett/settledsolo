import type { ReactNode } from "react";
import { PublicSite } from "./PublicSite";
import { BrandWordmark } from "../brand/BrandMark";

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
        <nav aria-label="Public site">
          <a href="/">Home</a>
          <a href="/app/" className="marketing-nav-cta">Open app</a>
        </nav>
      </header>
      <main className="info-page">
        <h1>{title}</h1>
        <div className="info-page-copy">{children}</div>
      </main>
    </div>
  );
}

function PrivacyPage() {
  return (
    <InfoPage title="Your training record belongs to you.">
      <h2>Local-first by default</h2>
      <p>
        SettledSolo currently stores your dog name, training tracks, session history,
        notes and observed signals on your device. You can use the core app without
        creating an account.
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
        Limited aggregate analytics may count events such as app opens and whether a
        session was started or saved, together with basic browser/device information.
        Private training details such as dog names, notes, ratings, durations and
        training history are not sent as product analytics.
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
        Signing in alone does not upload existing local history. The app shows an
        import summary and asks before connecting your log.
      </p>
      <h2>Sync and account controls</h2>
      <p>
        After you connect, dog names, tracks, session observations, notes and settings
        are stored with your account for backup and cross-device sync. Essential
        secure cookies keep you signed in. Account/session records may contain IP
        address and browser information for authentication and abuse protection.
        Deleted training records remain as sync deletion markers and may appear in
        change history until the account is deleted.
      </p>
      <p>
        More → Account &amp; backup provides cloud export, sign-out and account deletion.
        Deleting an account removes its active account and cloud training records;
        it does not erase logs already downloaded on your devices. Use the separate
        local reset on each device if you want to remove those too. Resolved conflict
        versions remain on the device and can be exported or cleared with local reset.
      </p>
      <p className="info-note">
        This privacy summary is part of the public beta preparation and will receive a
        final legal review before general launch.
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
        Core training is free, with no signup wall. There is no trial that silently converts
        to a paid subscription. If optional paid features are introduced, enrolment will
        require clear, explicit opt-in and cancellation will not require contacting support.
      </p>
      <h2>What it does not do</h2>
      <p>
        It does not diagnose separation anxiety, provide veterinary care or guarantee
        a behavioural outcome, and it is not a substitute for an accredited separation
        anxiety specialist (such as a Certified Separation Anxiety Trainer) or a
        veterinary behaviourist. Generated targets are planning suggestions and can be
        made easier at any time.
      </p>
      <h2>Use observation first</h2>
      <p>
        Return early when your dog shows meaningful concern. Do not use a timer target
        as a reason to continue an absence that is becoming difficult.
      </p>
      <h2>Professional support</h2>
      <p>
        Seek support from an accredited separation anxiety specialist (such as a
        Certified Separation Anxiety Trainer) or a veterinary behaviourist for severe,
        escalating or persistent distress, self-injury risk, destructive escape
        behaviour or whenever you are unsure how to proceed safely. A veterinarian or
        veterinary behaviourist is the right contact if medication may help.
      </p>
      <p className="info-note">
        Full launch terms will be finalised before public beta accounts or paid
        features are introduced.
      </p>
    </InfoPage>
  );
}


function EvidencePage() {
  return (
    <InfoPage title="Principles first. False precision never.">
      <p>
        SettledSolo is built around gradual systematic desensitisation: begin with an
        absence mild enough not to evoke meaningful distress, observe the dog, and
        adapt difficulty to the individual rather than forcing a fixed timetable.
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
      <h2>Professional review</h2>
      <p>
        The training wording and heuristics are scheduled for review by an appropriately
        qualified canine behaviour professional before general public launch.
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
      <h2>Use a camera when you can</h2>
      <p>
        Direct observation is more useful than guessing what happened while you were
        out of sight.
      </p>
      <h2>Returning early is okay</h2>
      <p>
        The target is a ceiling, not a quota. A shorter relaxed session is useful
        training information.
      </p>
      <h2>If concern appears</h2>
      <p>
        End the absence and make the next session easier. Repeated difficult sessions
        are a reason to reduce difficulty and consider professional support, not to
        push the plan harder.
      </p>
      <a className="marketing-primary info-cta" href="/app/">Open SettledSolo</a>
    </InfoPage>
  );
}

export function PublicRouter() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/privacy") {
    document.title = "Privacy — SettledSolo";
    return <PrivacyPage />;
  }
  if (path === "/terms") {
    document.title = "Terms — SettledSolo";
    return <TermsPage />;
  }
  if (path === "/help") {
    document.title = "Help — SettledSolo";
    return <HelpPage />;
  }
  if (path === "/evidence") {
    document.title = "Evidence — SettledSolo";
    return <EvidencePage />;
  }

  document.title = "SettledSolo — dog separation training";
  return <PublicSite />;
}
