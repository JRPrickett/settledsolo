import { supportUrl } from "./support";

export function OptionalSupportCard({ compact = false }: { compact?: boolean }) {
  if (!supportUrl) return null;

  return (
    <section className={`public-support-card${compact ? " compact" : ""}`}>
      <div>
        <p className="marketing-eyebrow">Optional support</p>
        <h2>Help keep SettledSolo calm, private and useful.</h2>
        <p>
          The training plan, timer, history and downloads stay available without payment.
          If SettledSolo helps your household, you can make a one-off contribution.
        </p>
      </div>
      <a
        className="marketing-primary"
        href={supportUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Support SettledSolo
      </a>
    </section>
  );
}
