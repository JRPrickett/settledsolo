import type { StorageMode } from "../../data/repository";
import { contactEmail, feedbackMailto } from "../../public/contact";
import { isStandalone } from "../../pwa/installStatus";

export function HelpFeedbackCard({ storageMode }: { storageMode: StorageMode }) {
  const feedbackHref = contactEmail
    ? feedbackMailto(contactEmail, {
        installed: isStandalone(),
        storage: storageMode === "memory" ? "limited" : "device"
      })
    : null;

  return (
    <section className="quiet-card vertical help-feedback-card" aria-labelledby="help-feedback-heading">
      <p className="kicker">Help &amp; feedback</p>
      <h2 id="help-feedback-heading">Stuck, unsure or something broke?</h2>
      <p>
        Practical guidance, printable checklists and the evidence behind the plan are
        on the public site.
        {feedbackHref
          ? " Feedback opens your email app with a short template you can edit; it never includes your dog's name or training record."
          : " A direct feedback inbox is not open yet."}
      </p>
      <div className="help-feedback-links">
        <a href="/help">Training help</a>
        <a href="/resources">Resources &amp; FAQ</a>
        <a href="/evidence">Evidence</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/contact">Contact</a>
      </div>
      {feedbackHref && (
        <a className="secondary-button help-feedback-send" href={feedbackHref}>
          Send feedback
        </a>
      )}
    </section>
  );
}
