import { supportProvider, supportUrl } from "../../public/support";

/** Optional, low-key support link. Kept at the end of More, away from training. */
export function SupportCard() {
  return (
    <section className="quiet-card vertical help-feedback-card" aria-labelledby="support-heading">
      <p className="kicker">Optional support</p>
      <h2 id="support-heading">Help keep SettledSolo free.</h2>
      <p>
        The plan, timer, history and backups stay free. A one-off contribution is
        entirely optional and does not unlock features. Payments are handled by{" "}
        {supportProvider}; SettledSolo never receives your card details.
      </p>
      <a
        className="secondary-button help-feedback-send"
        href={supportUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Support SettledSolo
      </a>
    </section>
  );
}
