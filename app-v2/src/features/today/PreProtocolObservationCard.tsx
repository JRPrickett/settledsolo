import { useState } from "react";
import {
  PRE_PROTOCOL_FINDINGS,
  findingLabel,
  observationNotes,
  type PreProtocolFinding
} from "../../domain/preProtocolObservation";

/**
 * A one-time observation before duration training starts. Watching an already
 * safe absence once helps separate confinement anxiety, noise sensitivity and
 * incomplete housetraining from separation-related distress, which otherwise
 * look alike.
 *
 * A camera is helpful but never required, and the step is always skippable.
 */
export function PreProtocolObservationCard({
  dogName,
  onRecord,
  onSkip
}: {
  dogName: string;
  onRecord: (findings: PreProtocolFinding[]) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState<"intro" | "findings" | "notes">("intro");
  const [findings, setFindings] = useState<PreProtocolFinding[]>([]);

  function toggle(finding: PreProtocolFinding) {
    setFindings((current) =>
      current.includes(finding)
        ? current.filter((item) => item !== finding)
        : [...current, finding]
    );
  }

  if (step === "notes") {
    return (
      <section className="today-card pre-protocol-card">
        <p className="kicker">Before you start</p>
        <h1>What that tells you</h1>
        <ul className="pre-protocol-notes">
          {observationNotes(findings).map((note) => (
            <li key={note.finding}>
              <strong>{findingLabel(note.finding)}</strong>
              <span>{note.note}</span>
            </li>
          ))}
        </ul>
        <p className="ceiling-note">
          SettledSolo does not diagnose. If anything here concerns you, a vet or an
          appropriately qualified behaviour professional is the right next step.
        </p>
        <button
          className="primary-button start-button"
          onClick={() => onRecord(findings)}
        >
          Save and start training
        </button>
      </section>
    );
  }

  if (step === "findings") {
    return (
      <section className="today-card pre-protocol-card">
        <p className="kicker">Before you start</p>
        <h1>What did you notice?</h1>
        <p className="starting-route-copy">
          Choose anything that matched. There are no wrong answers, and you can
          pick more than one.
        </p>

        <div
          className="setup-options"
          role="group"
          aria-label="What you noticed while your dog was alone"
        >
          {PRE_PROTOCOL_FINDINGS.map((finding) => (
            <button
              key={finding}
              type="button"
              className={`setup-choice${findings.includes(finding) ? " selected" : ""}`}
              aria-pressed={findings.includes(finding)}
              onClick={() => toggle(finding)}
            >
              <strong>{findingLabel(finding)}</strong>
            </button>
          ))}
        </div>

        <div className="setup-actions">
          <button
            className="setup-back"
            type="button"
            onClick={() => setStep("intro")}
          >
            Back
          </button>
          <button
            className="primary-button"
            disabled={findings.length === 0}
            onClick={() => setStep("notes")}
          >
            Continue
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="today-card pre-protocol-card">
      <p className="kicker">Before you start</p>
      <div className="starting-route-heading">
        <div>
          <h1>Observe one known-safe absence</h1>
          <p>A one-time step, then it is done.</p>
        </div>
        <span className="direction direction-repeat">Optional</span>
      </div>

      <p className="starting-route-copy">
        Watching {dogName} alone once can show whether confinement, noises outside or
        incomplete housetraining are part of the picture. It is not a test of how long{" "}
        {dogName} can cope, and not a diagnosis.
      </p>

      <div className="starting-observation-note">
        <strong>Only use an absence you already know is safe.</strong>
        <p>Never extend it to find a limit.</p>
        <details className="observation-how">
          <summary>How to do it</summary>
          <p>
            Watch on a camera or spare phone. No camera? Step outside the door or into
            another room for the same already-safe time. If you do not know a safe
            absence yet, skip this step and start with the cautious plan instead.
          </p>
        </details>
      </div>

      <button
        className="primary-button start-button"
        onClick={() => setStep("findings")}
      >
        I&apos;ve watched them alone
      </button>
      <button className="text-link-button observation-skip" type="button" onClick={onSkip}>
        Skip this step
      </button>
    </section>
  );
}
