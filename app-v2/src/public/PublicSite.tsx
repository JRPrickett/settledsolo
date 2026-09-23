import { BrandMark, BrandWordmark } from "../brand/BrandMark";
import { HOME_FAQS } from "./faqs";
import { PublicInstallAction } from "./PublicInstall";
import { OptionalSupportCard } from "./PublicSupport";
import { GUIDE_PATH } from "./routes";

/** What the app does today. Keep each item true of the shipped product. */
const APP_FEATURES = [
  {
    title: "A plan that adapts",
    body: "Each suggested duration starts from what your dog already manages, moves in small steps after calm sessions and never gets harder after a difficult one. The reason is always shown."
  },
  {
    title: "A reliable departure timer",
    body: "Keeps accurate time while you watch your camera app, lock your phone or switch apps, with an optional reminder to head back before the target."
  },
  {
    title: "Warm-ups and cue practice",
    body: "Short practice departures before the main one, and at-home practice for keys, shoes and other departure cues."
  },
  {
    title: "A record you can share",
    body: "Log how your dog was, the signs you noticed and any notes, then print a readable summary for your vet or trainer."
  },
  {
    title: "Progress you can read",
    body: "Charts and milestones that follow steady progress rather than streaks or pressure."
  },
  {
    title: "Private and offline",
    body: "Training stays on your device and works without a connection. Backup, CSV export and optional account sync are built in."
  }
];

// Captured from the real app by `npm run product:screens`.
const PRODUCT_SCREENS = [
  {
    src: "/screens/today.jpg",
    alt: "Today screen: a 1:05 plan for Biscuit, a small step up from the last 1:02 session, with four short warm-up departures."
  },
  {
    src: "/screens/live.jpg",
    alt: "Live session: 0:41 remaining of a 1:05 target, with a large I'm back button."
  },
  {
    src: "/screens/review.jpg",
    alt: "Session review: came back at 1:04, asking how Biscuit was while you were away — relaxed, some concern or distressed."
  }
];

function ArrowIcon() {
  return (
    <svg className="marketing-link-arrow" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" />
    </svg>
  );
}

export function PublicSite() {
  return (
    <div className="marketing-shell">
      <header className="marketing-header">
        <a className="marketing-brand" href="/" aria-label="SettledSolo home">
          <BrandWordmark compact light />
        </a>
        <nav aria-label="Public site">
          <div className="marketing-desktop-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href={GUIDE_PATH}>Guide</a>
            <a href="/evidence">Evidence</a>
            <a href="/resources">Resources</a>
          </div>
          <details className="marketing-mobile-menu">
            <summary>Explore</summary>
            <div>
              <a href="#how-it-works">How it works</a>
              <a href="#features">Features</a>
              <a href={GUIDE_PATH}>Training guide</a>
              <a href="/evidence">Evidence</a>
              <a href="/help">Help</a>
              <a href="/resources">Resources</a>
            </div>
          </details>
          <a href="/app/" className="marketing-nav-cta">Start free</a>
        </nav>
      </header>

      <main>
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <h1>
              <span className="marketing-eyebrow marketing-hero-kicker">
                Free separation anxiety training app for dogs
              </span>{" "}
              Calm starts with small steps.
            </h1>
            <p className="marketing-lead">
              SettledSolo is a free dog separation training app. It helps you build
              comfortable alone time one observable, manageable departure at a time:
              plan each session, time it reliably and record what your dog actually did.
            </p>
            <div className="marketing-actions">
              <PublicInstallAction />
              <a className="marketing-secondary" href="#how-it-works">See how it works</a>
            </div>
            <ul className="marketing-hero-assurances" aria-label="What to expect">
              <li>No account or subscription</li>
              <li>No streaks or pressure</li>
              <li>Your training stays on your device</li>
            </ul>
          </div>

          <figure className="marketing-hero-art">
            <img
              src="/photos/hero-settled-at-home-v2.webp?v=2"
              alt="A relaxed dog sleeping comfortably in a warm, softly lit living room."
              width="1122"
              height="1402"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <figcaption className="marketing-scene-copy">
              <span>Observe comfort, not just the clock.</span>
              <strong>Leave gently. Watch closely. Return early.</strong>
            </figcaption>
          </figure>
        </section>

        <section className="marketing-trust-strip" aria-label="Product principles">
          <div><strong>Start below worry</strong><span>Begin with something your dog can already manage.</span></div>
          <div><strong>Watch the dog</strong><span>The target is a ceiling, never a reason to push on.</span></div>
          <div><strong>Adapt without judgement</strong><span>A difficult session simply makes the next one easier.</span></div>
        </section>

        <section className="marketing-section" id="how-it-works">
          <div className="marketing-section-heading">
            <h2>A small loop you can trust.</h2>
            <p>
              SettledSolo turns separation anxiety training, a complicated and
              emotional process, into one calm decision at a time. There is always
              permission to make it easier.
            </p>
          </div>

          <ol className="marketing-steps">
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <h3>Plan something manageable.</h3>
                <p>Start from a duration you have already seen your dog handle comfortably.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <h3>Leave, watch and listen.</h3>
                <p>Use a camera when you can. If concern appears, returning early is the right call.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <h3>Record what really happened.</h3>
                <p>The next suggestion responds to your observation, with the reason shown in plain English.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="marketing-section marketing-features" id="features">
          <div className="marketing-section-heading">
            <h2>Everything a separation training app needs, free.</h2>
            <p>
              The core of SettledSolo costs nothing and needs no account. It runs in your
              browser and installs to your home screen on iPhone and Android.
            </p>
          </div>
          <ul className="marketing-feature-list">
            {APP_FEATURES.map(({ title, body }) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="marketing-session" id="the-session">
          <div className="marketing-preview-copy">
            <h2>A quiet guide for the moment you actually leave.</h2>
            <p>
              Before you go, you get a gentle plan. While you are away, the screen
              pares back to what matters. When you return, a few quick observations
              shape the next step.
            </p>
            <ul className="marketing-outcomes">
              <li><strong>Know why</strong><span>Every suggested duration comes with a clear reason.</span></li>
              <li><strong>Stay in control</strong><span>Come back early, pause, or make the next session easier.</span></li>
              <li><strong>Keep the useful details</strong><span>See patterns without turning training into a diary.</span></li>
            </ul>
            <a className="marketing-text-link" href="/app/">Explore the app <ArrowIcon /></a>
          </div>

          <figure className="marketing-session-visual">
            <div className="product-screens">
              {PRODUCT_SCREENS.map((screen) => (
                <div className="product-screen" key={screen.src}>
                  <img src={screen.src} alt={screen.alt} width={390} height={700} loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
            <figcaption>Plan <span>/</span> observe <span>/</span> adapt</figcaption>
          </figure>
        </section>

        <section className="marketing-reassurance">
          <BrandMark compact light />
          <div>
            <h2>You do not need to prove anything today.</h2>
            <p>
              One calm repetition is useful. If your dog looks worried, come back.
              Progress is not how long you stay away—it is how safe the experience feels.
            </p>
          </div>
        </section>

        <section className="marketing-section marketing-evidence">
          <div className="marketing-section-heading">
            <h2>Evidence-aware. Honest about the gaps.</h2>
            <p>
              Good guidance should make its foundations clear without pretending
              that every dog follows the same formula.
            </p>
          </div>
          <div className="marketing-proof-list">
            <article>
              <span>What guides the app</span>
              <h3>Gradual exposure and direct observation.</h3>
              <p>The method starts below meaningful worry and changes according to what you observe.</p>
            </article>
            <article>
              <span>What the app will not claim</span>
              <h3>A perfect formula or a clinical prescription.</h3>
              <p>Step sizes are conservative planning suggestions. You can always make them easier.</p>
            </article>
            <article>
              <span>Where the product stands</span>
              <h3>Independent, transparent and honest about its limits.</h3>
              <p>SettledSolo explains which ideas come from evidence and which are its own conservative planning heuristics.</p>
            </article>
          </div>
          <a className="marketing-text-link" href="/evidence">Read the evidence notes <ArrowIcon /></a>
        </section>

        <section className="marketing-section marketing-faq" id="faq">
          <div className="marketing-section-heading">
            <h2>Questions worth asking before you begin.</h2>
          </div>
          <div className="faq-list">
            {HOME_FAQS.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
          <a className="marketing-text-link" href={GUIDE_PATH}>
            Read the step-by-step separation anxiety training guide <ArrowIcon />
          </a>
        </section>

        <section className="marketing-final-cta">
          <BrandMark />
          <h2>Build comfortable alone time, gradually.</h2>
          <p>Your first plan takes less than a minute to set up. No account required.</p>
          <a className="marketing-primary" href="/app/">Begin your first plan</a>
        </section>

        <OptionalSupportCard />
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
          <span>SettledSolo is a training and record-keeping aid, not a diagnosis.</span>
          <a className="marketing-builder-link" href="https://southwestwebsites.co.uk">Built by South West Websites.</a>
        </div>
      </footer>
    </div>
  );
}
