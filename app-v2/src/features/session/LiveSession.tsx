import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  ObservedSignal,
  Outcome,
  SessionTag,
  TrainingSession
} from "../../domain/types";
import { observedSignalOptions } from "../../domain/observedSignals";
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
  elapsedSeconds,
  initialLiveSession,
  liveSessionReducer,
  type SessionStep
} from "../../session/sessionMachine";

export function LiveSession({
  scenarioId,
  scenarioLabel,
  targetSeconds,
  dogName,
  initialState,
  variabilitySeed = 0,
  warmupCount,
  shuffleWarmups,
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
  shuffleWarmups?: boolean;
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
        shuffleWarmups
      ),
    [targetSeconds, variabilitySeed, warmupCount, shuffleWarmups]
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
  const pushScheduleRef = useRef<{
    token: string;
    scheduled: Promise<boolean>;
  } | null>(null);
  const runningStandalone = isStandalone();
  const iosDevice = isIOS();

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
      if (pendingPush) {
        void pendingPush.scheduled.finally(() =>
          cancelBackgroundReturnAlert(pendingPush.token)
        );
      }
      stopSessionAlerts();
      return;
    }

    const removeWakeRecovery = installWakeLockRecovery();
    const timer = window.setInterval(() => setNow(Date.now()), 250);

    return () => {
      window.clearInterval(timer);
      removeWakeRecovery();
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

  useEffect(() => {
    if (state.phase !== "running") return;

    const shouldWarn =
      step.kind === "main" &&
      step.targetSeconds >= 10 &&
      remaining > 0 &&
      remaining <= 5 &&
      !state.warningIssued;

    if (shouldWarn) {
      playHeadBackSoonChime();
      dispatch({ type: "MARK_WARNING_ISSUED" });
    }

    if (elapsed >= step.targetSeconds && !state.targetIssued) {
      playTargetReachedChime();
      dispatch({ type: "MARK_TARGET_ISSUED" });
    }
  }, [
    elapsed,
    remaining,
    state.phase,
    state.targetIssued,
    state.warningIssued,
    step.kind,
    step.targetSeconds
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

  const stoppedEarly =
    state.mainActualSeconds !== null && state.mainActualSeconds < targetSeconds;

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
        id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
        targetSeconds,
        actualSeconds: state.mainActualSeconds,
        outcome,
        stoppedEarly,
        signals,
        tags,
        stopReason: stoppedEarly ? stopReason.trim().slice(0, 80) : "",
        note: note.trim()
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

  async function startDeparture() {
    // Permission may still need the user's direct tap. Network/subscription
    // work must not delay the timestamp-derived training timer.
    let permission = notificationPermission;
    if (
      permission === "default" &&
      (!iosDevice || runningStandalone)
    ) {
      permission = await requestNotificationPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") setBackgroundAlertsReady(false);
    }

    const started = Date.now();
    prepareSessionAudio();
    setNow(started);
    dispatch({ type: "START_STEP", now: started });

    if (step.kind === "main" && permission === "granted") {
      const token = createReturnAlertToken();
      const scheduled = (async () => {
        const ready =
          backgroundAlertsReady === true
            ? true
            : await prepareBackgroundReturnAlerts();
        setBackgroundAlertsReady(ready);
        if (!ready) return false;

        return scheduleBackgroundReturnAlert(
          started + step.targetSeconds * 1000,
          token
        );
      })();

      pushScheduleRef.current = { token, scheduled };
      void scheduled.then((ok) => {
        if (!ok && pushScheduleRef.current?.token === token) {
          setBackgroundAlertsReady(false);
        }
      });
    }
  }

  const restElapsed = restStartedAt
    ? Math.max(0, Math.floor((now - restStartedAt) / 1000))
    : 0;
  const restSuggestionMet = restSeconds > 0 && restElapsed >= restSeconds;

  if (state.phase === "review") {
    return (
      <div className="live-shell review-shell">
        <header className="live-header">
          <button className="text-button" onClick={() => void onClose()}>Close</button>
          <span>Session review</span>
          <span />
        </header>
        <main className="review-content">
          <p className="kicker light">You came back at</p>
          <div className="review-time">{formatDuration(state.mainActualSeconds ?? 0)}</div>
          <h1>How was {dogName} while you were away?</h1>
          <p className="outcome-help">
            Rate what you actually saw, not whether you reached the timer target. Coming back
            at the first meaningful sign of concern is a good outcome, not a failure.
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
                    key={value}
                    onClick={() => toggleSignal(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
    return (
      <div className="live-shell">
        <header className="live-header">
          <button className="text-button" onClick={() => void onClose()}>End session</button>
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
        <button className="text-button" onClick={() => void onClose()}>End session</button>
        <span>
          {step.kind === "practice"
            ? `Practice ${state.stepIndex + 1} of ${practice.length}`
            : "Main departure"}
        </span>
        <span />
      </header>

      <main className="live-centre">
        {state.phase === "idle" ? (
          <>
            <p className="kicker light">
              {step.kind === "practice" ? "Short practice departure" : "Today's main departure"}
            </p>
            <div className="live-target">{formatDuration(step.targetSeconds)}</div>
            <p className="live-copy">
              Watch {dogName} on your camera. Come back at the first meaningful sign
              of concern — you never need to finish the clock.
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
              onClick={() => void startDeparture()}
            >
              I'm leaving now
            </button>
          </>
        ) : (
          <>
            <p className="kicker light">{over ? "Target reached" : "Time remaining"}</p>
            <ProgressRing
              elapsed={elapsed}
              targetSeconds={step.targetSeconds}
              over={over}
            />
            <p className="live-elapsed">
              {formatDuration(elapsed)} away · target {formatDuration(step.targetSeconds)}
            </p>
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
