import { useMemo, useState } from "react";
import type { AppData, DepartureCueSession } from "../../domain/types";
import { activeScenario } from "../../data/appData";
import {
  CUE_REPETITIONS,
  DEPARTURE_CUES,
  cueOutcome,
  recommendCueLevel
} from "../../domain/departureCues";
import { createOpaqueId } from "../../domain/ids";

export function DepartureCuePracticeView({
  data,
  onClose,
  onSaved
}: {
  data: AppData;
  onClose: () => void;
  onSaved: (session: DepartureCueSession, nextLevel: number) => Promise<void>;
}) {
  const scenario = activeScenario(data);
  const recommendation = useMemo(
    () => recommendCueLevel(scenario.cuePractice),
    [scenario.cuePractice]
  );
  const [rep, setRep] = useState(0);
  const [relaxedReps, setRelaxedReps] = useState(0);
  const [concernReps, setConcernReps] = useState(0);
  const complete = rep >= CUE_REPETITIONS;

  function record(relaxed: boolean) {
    if (complete) return;
    setRep((value) => value + 1);
    if (relaxed) setRelaxedReps((value) => value + 1);
    else setConcernReps((value) => value + 1);
  }

  async function save() {
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
    await onSaved(session, next.cueIndex);
  }

  return (
    <div className="cue-shell">
      <header className="live-header cue-header">
        <button className="text-button" onClick={onClose}>Close</button>
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
              to settle before the next repetition.
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
            <button className="primary-button" onClick={() => void save()}>
              Save cue practice
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
