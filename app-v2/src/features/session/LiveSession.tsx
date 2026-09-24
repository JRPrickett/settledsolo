import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  ObservedSignal,
  Outcome,
  SessionTag,
  TrainingSession
} from "../../domain/types";
import {
  hasHighRiskSignals,
  observedSignalOptions
} from "../../domain/observedSignals";
import { SESSION_TAG_OPTIONS } from "../../domain/sessionTags";
import { ProgressRing } from "../../components/ProgressRing";
import {
  buildPracticeDepartures,
  formatDuration
} from "../../domain/trainingEngine";
import {
  makePersistedLiveSession,
  type PersistedLiveSession
} from "../../session/sessionPersistence";
import { createOpaqueId } from "../../domain/ids";
import {
  alertCapabilities,
  cancelBackgroundReturnAlert,
  createReturnAlertToken,
  installWakeLockRecovery,
  playHeadBackSoonChime,
  playTargetReachedChime,
  prepareBackgroundReturnAlerts,
  prepareSessionAudio,
  requestNotificationPermission,
  scheduleBackgroundReturnAlert,
  stopSessionAlerts,
  type NotificationPermissionState
} from "../../session/sessionAlerts";
import { isIOS, isStandalone } from "../../pwa/installStatus";
import {
  effectiveWalkBackSeconds,
  headBackAt,
  loadWalkBackSeconds,
  returnedEarly
} from "../../session/walkBack";
import {
  elapsedSeconds,
  hasRealDeparture,
  initialLiveSession,
  liveSessionReducer,
  type SessionStep
} from "../../session/sessionMachine";

interface PendingReturnAlert {
  token: string;
  /** Set when the departure ends before scheduling finishes. */
  cancelled: boolean;
  scheduled: Promise<boolean>;
}

function cancelPendingReturnAlert(pending: PendingReturnAlert) {
  pending.cancelled = true;
  void pending.scheduled.finally(() => cancelBackgroundReturnAlert(pending.token));
}

export function LiveSession({
  scenarioId,
  scenarioLabel,
  targetSeconds,
  dogName,
  initialState,
  variabilitySeed = 0,
  warmupCount,
  restSeconds = 60,
  onClose,
  onSaved,
  onPersist
}: {
  scenarioId: string;
  scenarioLabel: string;
  targetSeconds: number;
  dogName: string;
  initialState?: PersistedLiveSession["state"];
  variabilitySeed?: number;
  warmupCount?: number;
  restSeconds?: number;
  onClose: () => Promise<void>;
  onSaved: (session: TrainingSession) => Promise<void>;
  onPersist: (snapshot: PersistedLiveSession) => Promise<void>;
}) {
  const practice = useMemo(
    () =>
      buildPracticeDepartures(
        targetSeconds,
        variabilitySeed,
        warmupCount,
        true
      ),
    [targetSeconds, variabilitySeed, warmupCount]
  );
  const steps = useMemo<SessionStep[]>(
    () => [
      ...practice.map((target) => ({ kind: "practice" as const, targetSeconds: target })),
      { kind: "main" as const, targetSeconds }
    ],
    [practice, targetSeconds]
  );
  const [state, dispatch] = useReducer(
    liveSessionReducer,
    initialState ?? steps,
    (seed) =>
      Array.isArray(seed)
        ? initialLiveSession(seed as SessionStep[])
        : seed as PersistedLiveSession["state"]
  );
  const [now, setNow] = useState(Date.now());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Remind the owner early enough to walk back and arrive around the target.
  const [walkBackSeconds] = useState(loadWalkBackSeconds);
  const mainLeadSeconds = effectiveWalkBackSeconds(targetSeconds, walkBackSeconds);
  const [signals, setSignals] = useState<ObservedSignal[]>([]);
  const [tags, setTags] = useState<SessionTag[]>([]);
  const [stopReason, setStopReason] = useState("");
  const [note, setNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const saveInFlight = useRef(false);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(
      () => alertCapabilities().notifications
    );
  const [backgroundAlertsReady, setBackgroundAlertsReady] = useState<boolean | null>(
    () => (alertCapabilities().push ? null : false)
  );
  const pushScheduleRef = useRef<PendingReturnAlert | null>(null);
  const runningStandalone = isStandalone();
  const iosDevice = isIOS();
  const reviewIsPractice = (state.reviewKind ?? "main") === "practice";

  useEffect(() => {
    if (state.phase === "review" && state.reviewOutcome) {
      setOutcome(state.reviewOutcome);
    }
  }, [state.phase, state.reviewOutcome]);

  useEffect(() => {
    const theme =
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ??
      document.head.appendChild(document.createElement("meta"));
    theme.name = "theme-color";
    theme.content = state.phase === "review" ? "#F1E7D6" : "#15242C";

    return () => {
      theme.content = "#F1E7D6";
    };
  }, [state.phase]);

  useEffect(() => {
    void onPersist(makePersistedLiveSession(scenarioId, targetSeconds, state));
  }, [onPersist, scenarioId, state, targetSeconds]);

  useEffect(() => {
    if (state.phase !== "running") {
      const pendingPush = pushScheduleRef.current;
      pushScheduleRef.current = null;
      if (pendingPush) cancelPendingReturnAlert(pendingPush);
      stopSessionAlerts();
      return;
    }

    const removeWakeRecovery = installWakeLockRecovery();
    const timer = window.setInterval(() => setNow(Date.now()), 250);

    return () => {
      window.clearInterval(timer);
      removeWakeRecovery();
      const pendingPush = pushScheduleRef.current;
      pushScheduleRef.current = null;
      if (pendingPush) cancelPendingReturnAlert(pendingPush);
      stopSessionAlerts();
    };
  }, [state.phase]);

  useEffect(() => {
    setRestStartedAt(state.phase === "between" ? Date.now() : null);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "between") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  const step = state.steps[state.stepIndex];
  const elapsed = elapsedSeconds(state, now);
  const remaining = Math.max(0, step.targetSeconds - elapsed);
  const over = elapsed > step.targetSeconds;
  const stepLeadSeconds = step.kind === "main" ? mainLeadSeconds : 0;
  const headingBack = remaining > 0 && remaining <= stepLeadSeconds;

  useEffect(() => {
    if (state.phase !== "running") return;

    const shouldWarn =
      step.kind === "main" &&
      step.targetSeconds >= 10 &&
      remaining > 0 &&
      remaining <= Math.max(5, stepLeadSeconds) &&
      !state.warningIssued;

    if (shouldWarn) {
      if (document.visibilityState === "visible") playHeadBackSoonChime();
      dispatch({ type: "MARK_WARNING_ISSUED" });
    }

    if (elapsed >= step.targetSeconds && !state.targetIssued) {
      if (document.visibilityState === "visible") playTargetReachedChime();
      dispatch({ type: "MARK_TARGET_ISSUED" });
    }
  }, [
    elapsed,
    remaining,
    state.phase,
    state.targetIssued,
    state.warningIssued,
    step.kind,
    step.targetSeconds,
    stepLeadSeconds
  ]);

  function toggleSignal(signal: ObservedSignal) {
    setSignals((current) =>
      current.includes(signal)
        ? current.filter((value) => value !== signal)
        : [...current, signal]
    );
  }

  function toggleTag(tag: SessionTag) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag]
    );
  }

  // How far past the target the timer ran before "I'm back" was tapped.
  const measuredMainSeconds =
    state.phase === "review" && !reviewIsPractice && state.returnedAt !== null
      ? elapsedSeconds(state, state.returnedAt)
      : 0;
  const overrunSeconds = measuredMainSeconds - targetSeconds;
  const showOverrunNote =
    overrunSeconds >= Math.max(30, Math.round(targetSeconds * 0.25));
  const overrunCorrected =
    showOverrunNote && state.mainActualSeconds === targetSeconds;

  // A main return inside the walk-back window is on target, not an early stop.
  const stoppedEarly =
    state.mainActualSeconds !== null &&
    (reviewIsPractice
      ? state.mainActualSeconds < targetSeconds
      : returnedEarly(state.mainActualSeconds, targetSeconds, mainLeadSeconds));

  async function saveReview() {
    if (
      !outcome ||
      state.mainActualSeconds === null ||
      saveInFlight.current
    ) {
      return;
    }

    saveInFlight.current = true;
    setSavingReview(true);

    try {
      await onSaved({
        id: createOpaqueId("p"),
        at: Date.now(),
        targetSeconds,
        actualSeconds: state.mainActualSeconds,
        outcome,
        stoppedEarly,
        signals,
        tags,
        stopReason: stoppedEarly
          ? stopReason.trim().slice(0, 80) ||
            (reviewIsPractice
              ? "A warm-up showed concern, so the session stopped before the main departure."
              : "")
          : "",
        note: note.trim(),
        practiceReviews:
          state.practiceReviews && state.practiceReviews.length > 0
            ? state.practiceReviews
            : undefined,
        firstSignSeconds:
          !reviewIsPractice && state.firstSignSeconds != null
            ? Math.min(state.firstSignSeconds, state.mainActualSeconds)
            : undefined
      });
    } catch {
      saveInFlight.current = false;
      setSavingReview(false);
    }
  }

  async function enableReturnAlerts(): Promise<boolean> {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);

    if (permission !== "granted") {
      setBackgroundAlertsReady(false);
      return false;
    }

    const ready = await prepareBackgroundReturnAlerts();
    setBackgroundAlertsReady(ready);
    return ready;
  }

  function startDeparture() {
    // Start the timestamp-derived timer on the tap itself. An owner may walk out
    // while a permission prompt is still open, so neither the prompt nor any
    // network/subscription work may delay or block the departure.
    const started = Date.now();
    prepareSessionAudio();
    setNow(started);
    dispatch({ type: "START_STEP", now: started });

    // Ask within the same tap so browsers still treat it as user-initiated.
    const permissionRequest =
      notificationPermission === "default" && (!iosDevice || runningStandalone)
        ? requestNotificationPermission().then((result) => {
            setNotificationPermission(result);
            if (result !== "granted") setBackgroundAlertsReady(false);
            return result;
          })
        : null;

    if (step.kind !== "main") return;
    if (!permissionRequest && notificationPermission !== "granted") return;

    const pending: PendingReturnAlert = {
      token: createReturnAlertToken(),
      cancelled: false,
      scheduled: Promise.resolve(false)
    };
    pending.scheduled = (async () => {
      const permission = permissionRequest
        ? await permissionRequest
        : notificationPermission;
      // The owner may already be back before a late permission answer arrives.
      if (permission !== "granted" || pending.cancelled) return false;

      const ready =
        backgroundAlertsReady === true
          ? true
          : await prepareBackgroundReturnAlerts();
      setBackgroundAlertsReady(ready);
      if (!ready || pending.cancelled) return false;

      return scheduleBackgroundReturnAlert(
        headBackAt(started, step.targetSeconds, mainLeadSeconds),
        pending.token
      );
    })();

    pushScheduleRef.current = pending;
  }

  const restElapsed = restStartedAt
    ? Math.max(0, Math.floor((now - restStartedAt) / 1000))
    : 0;
  const restSuggestionMet = restSeconds > 0 && restElapsed >= restSeconds;

  function requestClose() {
    // An accidental start can be abandoned in one tap; real departures cannot.
    if (hasRealDeparture(state)) setConfirmingDiscard(true);
    else void onClose();
  }

  if (confirmingDiscard) {
    return (
      <div className="live-shell">
        <main
          className="live-centre discard-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-heading"
          aria-describedby="discard-detail"
          onKeyDown={(event) => {
            if (event.key === "Escape") setConfirmingDiscard(false);
          }}
        >
          <p className="kicker light">End without saving?</p>
          <h1 id="discard-heading">
            {dogName} has already been left during this session.
          </h1>
          <p id="discard-detail" className="live-copy">
            {state.phase === "review"
              ? "Saving keeps what you observed, even if it was a hard session. Discarding removes it from your history and progress."
              : "Discarding removes this session from your history and progress. To keep it, go back, tap I'm back when you return and save the review."}
          </p>
          <button
            className="live-primary"
            autoFocus
            onClick={() => setConfirmingDiscard(false)}
          >
            {state.phase === "review" ? "Back to the review" : "Keep this session"}
          </button>
          <button className="live-discard" onClick={() => void onClose()}>
            Discard session
          </button>
        </main>
      </div>
    );
  }

  if (state.phase === "review") {
    return (
      <div className="live-shell review-shell">
        <header className="live-header">
          <button className="text-button" onClick={requestClose}>Close</button>
          <span>Session review</span>
          <span />
        </header>
        <main className="review-content">
          <p className="kicker light">
            {reviewIsPractice ? "Session stopped after" : "You came back at"}
          </p>
          <div className="review-time">{formatDuration(state.mainActualSeconds ?? 0)}</div>
          {showOverrunNote && (
            <div className="overrun-note" role="note">
              {overrunCorrected ? (
                <>
                  <p>
                    Recorded as the {formatDuration(targetSeconds)} target. You can
                    fine-tune it later in History.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "CORRECT_MAIN_RETURN", seconds: measuredMainSeconds })
                    }
                  >
                    Keep the timer&apos;s {formatDuration(measuredMainSeconds)} instead
                  </button>
                </>
              ) : (
                <>
                  <p>
                    The timer ran {formatDuration(overrunSeconds)} past the{" "}
                    {formatDuration(targetSeconds)} target. If you were back with{" "}
                    {dogName} sooner and only tapped late, record the target time so
                    your history stays accurate.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "CORRECT_MAIN_RETURN", seconds: targetSeconds })
                    }
                  >
                    I was back on time
                  </button>
                </>
              )}
            </div>
          )}
          {!reviewIsPractice && state.firstSignSeconds != null && (
            <p className="first-sign-note review-first-sign">
              First sign of concern marked at {formatDuration(state.firstSignSeconds)}. The next
              plan stays below it.{" "}
              <button type="button" onClick={() => dispatch({ type: "CLEAR_FIRST_SIGN" })}>
                Remove
              </button>
            </p>
          )}
          <h1>
            {reviewIsPractice
              ? `That warm-up was enough for today.`
              : `How was ${dogName} while you were away?`}
          </h1>
          <p className="outcome-help">
            {reviewIsPractice
              ? `A practice departure showed concern, so the main departure was not attempted. Rate what you actually saw, then save this shorter observation — stopping early is the safe outcome.`
              : "Rate what you actually saw, not whether you reached the timer target. Coming back at the first meaningful sign of concern is a good outcome, not a failure."}
          </p>
          <div className="outcome-grid">
            {([
              [
                "relaxed",
                "Relaxed",
                "Settled quickly. No pacing, whining, or watching the exit for more than a few seconds."
              ],
              [
                "concern",
                "Some concern",
                "Pacing, whining, or watching the exit — but it eased on its own, or you returned and it was mild."
              ],
              [
                "distressed",
                "Distressed",
                "Sustained barking/howling, couldn't settle at all, or that's why you came back early."
              ]
            ] as const).map(([value, label, detail]) => (
              <button
                key={value}
                className={`outcome-button ${outcome === value ? "selected" : ""}`}
                aria-pressed={outcome === value}
                onClick={() => setOutcome(value)}
              >
                <strong>{label}</strong>
                <span>{detail}</span>
              </button>
            ))}
          </div>

          {outcome && outcome !== "relaxed" && (
            <div className="signals-section">
              <span>What did you notice? <small>Optional</small></span>
              <div className="signal-grid">
                {observedSignalOptions.map(({ value, label }) => (
                  <button
                    className={signals.includes(value) ? "selected" : ""}
                    aria-pressed={signals.includes(value)}
                    key={value}
                    onClick={() => toggleSignal(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasHighRiskSignals(signals) && (
            <div className="support-card referral-card" role="alert">
              <strong>Pause timed departures.</strong>
              <p>
                Self-injury, escape attempts or damaging barriers need prompt advice
                from your vet or a qualified behaviour professional. Do not run another
                timed absence just to gather more app data.
              </p>
            </div>
          )}

          {stoppedEarly && (
            <label className="note-field">
              Why did you come back early? <small>Optional</small>
              <input
                type="text"
                value={stopReason}
                onChange={(event) => setStopReason(event.target.value)}
                maxLength={80}
                placeholder="Dog showed concern, interruption, needed a break…"
              />
            </label>
          )}

          <div className="signals-section">
            <span>Context <small>Optional</small></span>
            <p className="context-help">
              If signs only show up while crated or confined, that can point to confinement
              anxiety rather than separation anxiety — worth trying a free-roam session to
              compare.
            </p>
            <div className="signal-grid">
              {SESSION_TAG_OPTIONS.map(({ value, label }) => (
                <button
                  className={tags.includes(value) ? "selected" : ""}
                  aria-pressed={tags.includes(value)}
                  key={value}
                  onClick={() => toggleTag(value)}
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
              onChange={(event) => setNote(event.target.value)}
              maxLength={280}
              placeholder="Anything worth remembering about today?"
            />
          </label>

          <button
            className="primary-button live-save"
            disabled={!outcome || savingReview}
            onClick={() => void saveReview()}
          >
            {savingReview ? "Saving…" : "Save session"}
          </button>
        </main>
      </div>
    );
  }

  if (state.phase === "between") {
    const practiceReturned =
      step.kind === "practice" && state.returnedAt !== null;
    const practiceOutcomeRecorded = state.practiceOutcome != null;

    if (practiceReturned && !practiceOutcomeRecorded) {
      return (
        <div className="live-shell">
          <header className="live-header">
            <button className="text-button" onClick={requestClose}>End session</button>
            <span>Practice check-in</span>
            <span />
          </header>
          <main className="live-centre practice-checkin">
            <p className="kicker light">You came back at</p>
            <div className="live-target">
              {formatDuration(state.currentActualSeconds ?? elapsedSeconds(state, state.returnedAt ?? Date.now()))}
            </div>
            <h1>How did {dogName} stay?</h1>
            <p className="live-copy">
              Record each short departure before deciding whether to continue. If there
              was concern, SettledSolo will stop the session before the main departure.
            </p>
            <div className="outcome-grid practice-outcome-grid">
              {([
                [
                  "relaxed",
                  "Relaxed",
                  "Settled quickly, with no meaningful worry."
                ],
                [
                  "concern",
                  "Some concern",
                  "There were mild or early signs of worry. Stop and make the next plan easier."
                ],
                [
                  "distressed",
                  "Distressed",
                  "Sustained or escalating signs. Stop timed departures and seek support if needed."
                ]
              ] as const).map(([value, label, detail]) => (
                <button
                  key={value}
                  className="outcome-button"
                  onClick={() =>
                    dispatch({ type: "RECORD_PRACTICE_OUTCOME", outcome: value })
                  }
                >
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </button>
              ))}
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="live-shell">
        <header className="live-header">
          <button className="text-button" onClick={requestClose}>End session</button>
          <span>Settle break</span>
          <span />
        </header>
        <main className="live-centre">
          <p className="kicker light">Back together</p>
          <h1 className="settle-title">Let things feel ordinary again.</h1>
          <p className="live-copy">
            There is no countdown here. Continue only when {dogName} is comfortably settled.
          </p>
          {restSeconds > 0 && (
            <p className="live-elapsed">
              {restSuggestionMet
                ? `Settled for ${formatDuration(restElapsed)} — past the suggested ${formatDuration(restSeconds)}.`
                : `Settled for ${formatDuration(restElapsed)} · suggested ${formatDuration(restSeconds)}`}
            </p>
          )}
          <p className="ceiling-note">
            This departure was marked relaxed. Continue only if {dogName} is comfortably
            settled again.
          </p>
          <button
            className="live-primary"
            onClick={() => dispatch({ type: "NEXT_STEP" })}
          >
            Ready for the next departure
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="live-shell">
      <header className="live-header">
        <button className="text-button" onClick={requestClose}>End session</button>
        <span>
          {step.kind === "practice"
            ? `Practice ${state.stepIndex + 1} of ${practice.length}`
            : "Main departure"}
        </span>
        <span />
      </header>

      <main className={`live-centre ${state.phase === "running" ? "live-running" : ""}`}>
        {state.phase === "idle" ? (
          <>
            <p className="kicker light">
              {step.kind === "practice" ? "Short practice departure" : "Today's main departure"}
            </p>
            <div className="live-target">{formatDuration(step.targetSeconds)}</div>
            <p className="live-copy">
              Observe {dogName} if that is useful — a camera is optional. Come back at
              the first meaningful sign of concern; you never need to finish the clock.
            </p>
            {step.kind === "main" && (
              <div className="return-alert" role="status" aria-live="polite">
                {notificationPermission === "granted" && backgroundAlertsReady === true ? (
                  <span>Background return alert ready. You can switch to your camera app.</span>
                ) : notificationPermission === "unsupported" ||
                  !alertCapabilities().push ||
                  (iosDevice && !runningStandalone) ? (
                  <span>
                    Add SettledSolo to your Home Screen for background return alerts.
                    The in-app timer still works while SettledSolo stays active.
                  </span>
                ) : notificationPermission === "denied" ? (
                  <span>
                    Return alerts are blocked. Turn notifications on in your browser
                    or iPhone Settings if you want a background reminder.
                  </span>
                ) : (
                  <>
                    <span>
                      Watching the camera in another app? Enable a native return alert
                      for the main departure.
                    </span>
                    <button type="button" onClick={() => void enableReturnAlerts()}>
                      {notificationPermission === "granted"
                        ? "Set up return alerts"
                        : "Enable return alerts"}
                    </button>
                  </>
                )}
              </div>
            )}
            <button
              className="live-primary"
              onClick={startDeparture}
            >
              I'm leaving now
            </button>
          </>
        ) : (
          <>
            <p className="kicker light">
              {over ? "Target reached" : headingBack ? "Time to head back" : "Time remaining"}
            </p>
            <ProgressRing
              elapsed={elapsed}
              targetSeconds={step.targetSeconds}
              over={over}
              startedAt={state.startedAt}
            />
            <p className="live-elapsed">
              {formatDuration(elapsed)} away · target {formatDuration(step.targetSeconds)}
            </p>
            {step.kind === "main" &&
              (state.firstSignSeconds == null ? (
                <button
                  type="button"
                  className="first-sign-button"
                  onClick={() => dispatch({ type: "MARK_FIRST_SIGN", now: Date.now() })}
                >
                  Mark first sign of concern
                </button>
              ) : (
                <p className="first-sign-note" role="status">
                  First sign marked at {formatDuration(state.firstSignSeconds)}.{" "}
                  <button type="button" onClick={() => dispatch({ type: "CLEAR_FIRST_SIGN" })}>
                    Undo
                  </button>
                </p>
              ))}
            <button
              className="return-button"
              onClick={() => dispatch({ type: "RETURN", now: Date.now() })}
            >
              I'm back
            </button>
          </>
        )}
      </main>
    </div>
  );
}
