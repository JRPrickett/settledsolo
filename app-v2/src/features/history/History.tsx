import { useState } from "react";
import type { AppData, TrainingSession } from "../../domain/types";
import { activeScenario } from "../../data/appData";
import { formatDuration } from "../../domain/trainingEngine";
import { SESSION_TAG_OPTIONS } from "../../domain/sessionTags";
import { observedSignalOptions } from "../../domain/observedSignals";
import { SessionForm } from "./SessionForm";

const tagLabel = new Map(SESSION_TAG_OPTIONS.map(({ value, label }) => [value, label]));
const signalLabel = new Map(observedSignalOptions.map(({ value, label }) => [value, label]));

function scenarioHasHistory(data: AppData): boolean {
  return data.scenarios.some(
    (scenario) => scenario.sessions.length > 0 || (scenario.cuePractice?.sessions.length ?? 0) > 0
  );
}

export function History({
  data,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onOpenSummary
}: {
  data: AppData;
  onOpenSummary?: () => void;
  onAddSession: (scenarioId: string, session: TrainingSession) => Promise<void>;
  onUpdateSession: (scenarioId: string, session: TrainingSession) => Promise<void>;
  onDeleteSession: (scenarioId: string, sessionId: string) => Promise<void>;
}) {
  const scenario = activeScenario(data);
  const sessions = [...scenario.sessions].reverse();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function deleteSession(session: TrainingSession) {
    const date = new Date(session.at).toLocaleDateString();
    if (
      !window.confirm(
        `Delete the ${formatDuration(session.actualSeconds)} session from ${date}? This cannot be undone.`
      )
    ) {
      return;
    }

    await onDeleteSession(scenario.id, session.id);
    setEditingId((current) => (current === session.id ? null : current));
  }

  return (
    <div className="screen-stack">
      <section className="page-heading">
        <p className="kicker">History</p>
        <h1>Your training record.</h1>
        <p>Stored locally on this device. If you connect an account, your training data can also sync between your devices.</p>
        {onOpenSummary && scenarioHasHistory(data) && (
          <button type="button" className="text-link-button" onClick={onOpenSummary}>
            Open a summary to share with your vet or trainer
          </button>
        )}
      </section>

      {adding ? (
        <section className="settings-card">
          <div>
            <p className="kicker">Log a past session</p>
            <h2>Add an absence completed without the timer running.</h2>
          </div>
          <SessionForm
            onCancel={() => setAdding(false)}
            onSave={async (session) => {
              await onAddSession(scenario.id, session);
              setAdding(false);
            }}
          />
        </section>
      ) : (
        <button className="secondary-button" onClick={() => setAdding(true)}>
          Log a past session
        </button>
      )}

      <section className="history-list">
        {sessions.length === 0 ? (
          <div className="empty-state">Your first completed session will appear here.</div>
        ) : (
          sessions.map((session) =>
            editingId === session.id ? (
              <article className="history-row history-row-editing" key={session.id}>
                <SessionForm
                  initial={session}
                  onCancel={() => setEditingId(null)}
                  onSave={async (updated) => {
                    await onUpdateSession(scenario.id, updated);
                    setEditingId(null);
                  }}
                  onDelete={() => void deleteSession(session)}
                />
              </article>
            ) : (
              <article className="history-row" key={session.id}>
                <div className={`outcome-dot outcome-${session.outcome}`} />
                <div className="history-main">
                  <strong>{formatDuration(session.actualSeconds)}</strong>
                  <span>
                    {session.outcome === "relaxed"
                      ? "Relaxed"
                      : session.outcome === "concern"
                        ? "Some concern"
                        : "Distressed"}
                  </span>
                  {(session.tags.length > 0 ||
                    session.signals.length > 0 ||
                    session.stopReason ||
                    session.note) && (
                    <div className="history-detail">
                      {session.tags.map((tag) => (
                        <span className="history-chip" key={tag}>
                          {tagLabel.get(tag) ?? tag}
                        </span>
                      ))}
                      {session.signals.map((signal) => (
                        <span className="history-chip" key={signal}>
                          {signalLabel.get(signal) ?? signal}
                        </span>
                      ))}
                      {session.stopReason && (
                        <span className="history-chip history-chip-stop">
                          Stopped: {session.stopReason}
                        </span>
                      )}
                      {session.note && <span className="history-note">{session.note}</span>}
                    </div>
                  )}
                </div>
                <div className="history-meta">
                  <span>{new Date(session.at).toLocaleDateString()}</span>
                  <small>target {formatDuration(session.targetSeconds)}</small>
                  <div className="history-actions">
                    <button
                      type="button"
                      className="history-edit"
                      onClick={() => setEditingId(session.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="history-delete"
                      onClick={() => void deleteSession(session)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            )
          )
        )}
      </section>
    </div>
  );
}
