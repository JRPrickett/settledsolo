import { useState, type FormEvent } from "react";
import type { ObservedSignal, Outcome, SessionTag, TrainingSession } from "../../domain/types";
import {
  hasHighRiskSignals,
  observedSignalOptions
} from "../../domain/observedSignals";
import { SESSION_TAG_OPTIONS } from "../../domain/sessionTags";
import { createOpaqueId } from "../../domain/ids";

function toLocalDateTimeValue(ms: number): string {
  const offset = new Date(ms).getTimezoneOffset() * 60000;
  return new Date(ms - offset).toISOString().slice(0, 16);
}

function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function makeSessionId(): string {
  return createOpaqueId("p");
}

export function SessionForm({
  initial,
  onSave,
  onDelete,
  onCancel
}: {
  initial?: TrainingSession;
  onSave: (session: TrainingSession) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [when, setWhen] = useState(() => toLocalDateTimeValue(initial?.at ?? Date.now()));
  const [targetSeconds, setTargetSeconds] = useState(initial?.targetSeconds ?? 30);
  const [actualSeconds, setActualSeconds] = useState(initial?.actualSeconds ?? 30);
  const [outcome, setOutcome] = useState<Outcome>(initial?.outcome ?? "relaxed");
  const [signals, setSignals] = useState<ObservedSignal[]>(initial?.signals ?? []);
  const [tags, setTags] = useState<SessionTag[]>(initial?.tags ?? []);
  const [stopReason, setStopReason] = useState(initial?.stopReason ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const stoppedEarly = actualSeconds < targetSeconds;

  function submit(event: FormEvent) {
    event.preventDefault();
    const at = new Date(when).getTime();
    if (!Number.isFinite(at)) return;

    onSave({
      id: initial?.id ?? makeSessionId(),
      at,
      targetSeconds: Math.max(1, Math.round(targetSeconds)),
      actualSeconds: Math.max(1, Math.round(actualSeconds)),
      outcome,
      stoppedEarly,
      signals,
      tags,
      stopReason: stoppedEarly ? stopReason.trim().slice(0, 80) : "",
      note: note.trim().slice(0, 280)
    });
  }

  return (
    <form className="session-form" onSubmit={submit}>
      <label>
        Date and time
        <input
          type="datetime-local"
          value={when}
          required
          onChange={(event) => setWhen(event.target.value)}
        />
      </label>

      <div className="session-form-row">
        <label>
          Target
          <div className="duration-input">
            <input
              type="number"
              min={1}
              max={14400}
              value={targetSeconds}
              onChange={(event) => setTargetSeconds(Number(event.target.value))}
            />
            <span>seconds</span>
          </div>
        </label>
        <label>
          Actual
          <div className="duration-input">
            <input
              type="number"
              min={1}
              max={14400}
              value={actualSeconds}
              onChange={(event) => setActualSeconds(Number(event.target.value))}
            />
            <span>seconds</span>
          </div>
        </label>
      </div>

      <label>
        Outcome
        <select
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as Outcome)}
        >
          <option value="relaxed">Relaxed — settled quickly, no meaningful signs</option>
          <option value="concern">Some concern — signs appeared but eased or were mild</option>
          <option value="distressed">Distressed — sustained signs, or why you returned early</option>
        </select>
      </label>
      <p className="outcome-help">
        Rate what you actually saw, not whether the timer target was reached.
      </p>

      {stoppedEarly && (
        <label>
          Why did they come back early? <small>Optional</small>
          <input
            type="text"
            value={stopReason}
            maxLength={80}
            placeholder="Dog showed concern, interruption, needed a break…"
            onChange={(event) => setStopReason(event.target.value)}
          />
        </label>
      )}

      <div className="signals-section">
        <span>What did you notice? <small>Optional</small></span>
        <div className="signal-grid">
          {observedSignalOptions.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              className={signals.includes(value) ? "selected" : ""}
              aria-pressed={signals.includes(value)}
              onClick={() => setSignals(toggled(signals, value))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {hasHighRiskSignals(signals) && (
        <div className="support-card referral-card" role="alert">
          <strong>Pause timed departures.</strong>
          <p>
            This record includes a high-risk sign. Do not use it to justify another
            timed absence; contact your vet or a qualified behaviour professional.
          </p>
        </div>
      )}

      <div className="signals-section">
        <span>Context <small>Optional</small></span>
        <p className="context-help">
          If signs only show up while crated or confined, that can point to confinement
          anxiety rather than separation anxiety — worth trying a free-roam session to compare.
        </p>
        <div className="signal-grid">
          {SESSION_TAG_OPTIONS.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              className={tags.includes(value) ? "selected" : ""}
              aria-pressed={tags.includes(value)}
              onClick={() => setTags(toggled(tags, value))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="note-field">
        Note <small>Optional</small>
        <textarea
          value={note}
          maxLength={280}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="session-form-actions">
        <button type="submit" className="secondary-button">Save</button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            className="text-button session-delete"
            onClick={onDelete}
          >
            Delete session
          </button>
        )}
      </div>
    </form>
  );
}
