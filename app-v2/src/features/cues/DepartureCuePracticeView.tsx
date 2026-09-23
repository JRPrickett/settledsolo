import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData, DepartureCueSession } from "../../domain/types";
import { activeScenario } from "../../data/appData";
import {
  CUE_REPETITIONS,
  DEPARTURE_CUES,
  cueOutcome,
  recommendCueLevel
} from "../../domain/departureCues";
import { createOpaqueId } from "../../domain/ids";
import {
  clearCueCheckpoint,
  saveCueCheckpoint,
  type CueCheckpoint
} from "../../session/cueCheckpoint";

export function DepartureCuePracticeView({
  data,
  onClose,
  onSaved,
  resume
}: {
  data: AppData;
  /** An unfinished set from before a reload or app switch, for this track and cue. */
  resume?: CueCheckpoint;
  onClose: () => void;
  onSaved: (session: DepartureCueSession, nextLevel: number) => Promise<void>;
}) {
  const scenario = activeScenario(data);
  const recommendation = useMemo(
    () => recommendCueLevel(scenario.cuePractice),
    [scenario.cuePractice]
  );
  const resumable =
    resume?.scenarioId === scenario.id && resume.cueIndex === recommendation.cueIndex
      ? resume
      : undefined;
  const [rep, setRep] = useState(resumable?.rep ?? 0);
  const [relaxedReps, setRelaxedReps] = useState(resumable?.relaxedReps ?? 0);
  const [concernReps, setConcernReps] = useState(resumable?.concernReps ?? 0);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const complete = rep >= CUE_REPETITIONS;
  const recorded = relaxedReps + concernReps > 0;

  // Keep the set resumable if the app is reloaded, suspended or switched away from.
  useEffect(() => {
    if (!recorded) return;
    saveCueCheckpoint({
      scenarioId: scenario.id,
      cueIndex: recommendation.cueIndex,
      rep,
      relaxedReps,
      concernReps,
      savedAt: Date.now()
    });
  }, [recorded, scenario.id, recommendation.cueIndex, rep, relaxedReps, concernReps]);

  function requestClose() {
    if (recorded) setConfirmingDiscard(true);
    else onClose();
  }

  function discard() {
    clearCueCheckpoint();
    onClose();
  }

  function record(relaxed: boolean) {
    if (complete) return;
    // A concern ends the set immediately. The owner should not have to complete
    // the remaining repetitions after the dog has told them the cue is too hard.
    setRep((value) => relaxed ? value + 1 : CUE_REPETITIONS);
    if (relaxed) setRelaxedReps((value) => value + 1);
    else setConcernReps((value) => value + 1);
  }

  async function save() {
    // A fast double tap must not record the same set twice.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const outcome = cueOutcome(relaxedReps, concernReps);
    const session: DepartureCueSession = {
      id: createOpaqueId("c"),
      at: Date.now(),
      cueIndex: recommendation.cueIndex,
      relaxedReps,
      concernReps,
      outcome
    };

    const previewPractice = {
      level: recommendation.cueIndex,
      sessions: [...(scenario.cuePractice?.sessions ?? []), session]
    };
    const next = recommendCueLevel(previewPractice);
    try {
      await onSaved(session, next.cueIndex);
      clearCueCheckpoint();
    } catch {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (confirmingDiscard) {
    return (
      <div className="cue-shell">
        <main
          className="cue-content discard-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cue-discard-heading"
          aria-describedby="cue-discard-detail"
          onKeyDown={(event) => {
            if (event.key === "Escape") setConfirmingDiscard(false);
          }}
        >
          <p className="kicker">End without saving?</p>
          <h1 id="cue-discard-heading">Discard this cue set?</h1>
          <p id="cue-discard-detail" className="cue-reason">
            The repetitions you recorded will not be saved, so they will not count
            towards moving on to the next cue.
          </p>
          <button
            className="primary-button"
            autoFocus
            onClick={() => setConfirmingDiscard(false)}
          >
            {complete ? "Back to the summary" : "Keep practising"}
          </button>
          <button className="secondary-button cue-discard" onClick={discard}>
            Discard set
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="cue-shell">
      <header className="live-header cue-header">
        <button className="text-button" onClick={requestClose}>Close</button>
        <span>Departure cue practice</span>
        <span />
      </header>

      <main className="cue-content">
        <p className="kicker">Current cue</p>
        <h1>{DEPARTURE_CUES[recommendation.cueIndex]}</h1>
        <p className="cue-reason">{recommendation.reason}</p>

        {recommendation.supportFlag && (
          <div className="support-card">
            The last set was too difficult. Stop if your dog is already distressed and
            consider getting professional behavioural support before making the cue harder.
          </div>
        )}

        {!complete ? (
          <>
            <div className="rep-counter">
              <span>Rep {rep + 1} of {CUE_REPETITIONS}</span>
              <div>
                {Array.from({ length: CUE_REPETITIONS }, (_, index) => (
                  <i key={index} className={index < rep ? "done" : ""} />
                ))}
              </div>
            </div>

            <p className="cue-instruction">
              Present the cue once, then return to normal. Do not leave. Give your dog time
              to settle before the next repetition. If concern appears, end this set
              immediately rather than completing the remaining repetitions.
            </p>

            <div className="cue-actions">
              <button onClick={() => record(true)}>
                <strong>Relaxed</strong>
                <span>No meaningful worry</span>
              </button>
              <button onClick={() => record(false)}>
                <strong>Concerned</strong>
                <span>Pause and make it easier</span>
              </button>
            </div>
          </>
        ) : (
          <section className="cue-summary">
            <p className="kicker">Set complete</p>
            <h2>
              {concernReps === 0
                ? "All three repetitions stayed calm."
                : concernReps === 1
                  ? "There was some concern."
                  : "This cue was too difficult today."}
            </h2>
            <p>
              {concernReps === 0
                ? "Save the set. The app will only move on after repeated calm practice."
                : "Save the set and keep the next practice easier. There is no benefit in pushing through worry."}
            </p>
            <button
              className="primary-button"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save cue practice"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
