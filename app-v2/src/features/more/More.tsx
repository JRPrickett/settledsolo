import { useRef, useState } from "react";
import type { AppData } from "../../domain/types";
import { activeScenario } from "../../data/appData";
import {
  downloadBackup,
  downloadSessionsCsv
} from "../../data/export";
import {
  backupSummary,
  parseBackupText
} from "../../data/backup";
import {
  defaultWarmupCount,
  formatDuration
} from "../../domain/trainingEngine";
import { effectiveDailyCap, MAX_DAILY_CAP } from "../../domain/dailyCap";
import {
  alertCapabilities,
  prepareBackgroundReturnAlerts,
  requestNotificationPermission,
  type NotificationPermissionState
} from "../../session/sessionAlerts";

import type { StorageMode } from "../../data/repository";
import { HelpFeedbackCard } from "./HelpFeedbackCard";
import { SupportCard } from "./SupportCard";
import {
  WALK_BACK_OPTIONS,
  loadWalkBackSeconds,
  saveWalkBackSeconds
} from "../../session/walkBack";

const DEFAULT_REST_SECONDS = 60;

export function More({
  data,
  onSelectScenario,
  onCreateScenario,
  onUpdateScenario,
  onUpdateDailyCap,
  onRestoreBackup,
  onResetApp,
  accountPanel,
  storageMode = "indexeddb"
}: {
  data: AppData;
  storageMode?: StorageMode;
  accountPanel?: import("react").ReactNode;
  onSelectScenario: (id: string) => Promise<void>;
  onCreateScenario: (label: string, startSeconds: number) => Promise<void>;
  onUpdateScenario: (
    id: string,
    label: string,
    startSeconds: number,
    warmupCount: number,
    restSeconds: number
  ) => Promise<void>;
  onUpdateDailyCap: (cap: number) => Promise<void>;
  onRestoreBackup: (data: AppData) => Promise<void>;
  onResetApp: () => Promise<void>;
}) {
  const scenario = activeScenario(data);
  const fileInput = useRef<HTMLInputElement>(null);
  const [walkBackSeconds, setWalkBackSeconds] = useState(loadWalkBackSeconds);
  const [pendingRestore, setPendingRestore] = useState<AppData | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [trackLabel, setTrackLabel] = useState(scenario.label);
  const [trackStart, setTrackStart] = useState(scenario.startSeconds);
  const [warmupCount, setWarmupCount] = useState(
    scenario.warmupCount ?? defaultWarmupCount(scenario.startSeconds)
  );
  const [restSeconds, setRestSeconds] = useState(
    scenario.restSeconds ?? DEFAULT_REST_SECONDS
  );
  const [newTrackLabel, setNewTrackLabel] = useState("");
  const [newTrackStart, setNewTrackStart] = useState(scenario.startSeconds);
  const [dailyCap, setDailyCap] = useState(effectiveDailyCap(data));
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(
      () => alertCapabilities().notifications
    );
  const [backgroundAlertsReady, setBackgroundAlertsReady] = useState<boolean | null>(
    () => (alertCapabilities().push ? null : false)
  );

  async function enableReturnAlerts() {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") {
      setBackgroundAlertsReady(false);
      return;
    }

    setBackgroundAlertsReady(await prepareBackgroundReturnAlerts());
  }

  async function chooseBackup(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      setPendingRestore(parseBackupText(text));
      setRestoreError("");
    } catch (error) {
      setPendingRestore(null);
      setRestoreError(
        error instanceof Error ? error.message : "Could not read this backup."
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const pendingSummary = pendingRestore
    ? backupSummary(pendingRestore)
    : null;

  return (
    <div className="screen-stack">
      <section className="page-heading">
        <p className="kicker">More</p>
        <h1>{data.dogName}'s training settings.</h1>
      </section>

      {accountPanel}

      {data.scenarios.length > 1 && (
        <section className="menu-card scenario-switch-card">
          <div>
            <strong>Training track</strong>
            <span>Keep different routines on separate progress histories.</span>
          </div>
          <select
            aria-label="Training track"
            value={scenario.id}
            onChange={(event) => {
              const nextId = event.target.value;
              const next = data.scenarios.find((item) => item.id === nextId);
              if (next) {
                setTrackLabel(next.label);
                setTrackStart(next.startSeconds);
                setWarmupCount(
                  next.warmupCount ?? defaultWarmupCount(next.startSeconds)
                );
                setRestSeconds(next.restSeconds ?? DEFAULT_REST_SECONDS);
              }
              void onSelectScenario(nextId);
            }}
          >
            {data.scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="menu-card">
        <div>
          <strong>Starting comfort</strong>
          <span>{formatDuration(scenario.startSeconds)} known comfortable duration</span>
        </div>
      </section>


      <section className="settings-card">
        <div>
          <p className="kicker">Current training track</p>
          <h2>Keep routines separate when they genuinely differ.</h2>
          <p>
            Edit this track's name or known-comfortable starting point without
            touching its history.
          </p>
          <p>
            Short sessions use four warm-ups by default. Each stays at or below
            one minute, and targets under two minutes keep warm-ups to half the
            target at most. Use Shuffle on Today to change the order of the same
            bounded, brief warm-up set without changing the main target.
          </p>
        </div>
        <div className="track-form">
          <label>
            Track name
            <input
              value={trackLabel}
              maxLength={48}
              onChange={(event) => setTrackLabel(event.target.value)}
            />
          </label>
          <label>
            Starting comfort
            <div className="duration-input">
              <input
                aria-label="Track starting comfort"
                type="number"
                min={1}
                max={7200}
                value={trackStart}
                onChange={(event) => {
                  const nextStart = Number(event.target.value);
                  setTrackStart(nextStart);
                  if (scenario.warmupCount == null) {
                    setWarmupCount(defaultWarmupCount(nextStart));
                  }
                }}
              />
              <span>seconds</span>
            </div>
          </label>
          <label>
            Practice departures before the main one
            <input
              aria-label="Warm-up count"
              type="number"
              min={0}
              max={4}
              value={warmupCount}
              onChange={(event) => setWarmupCount(Number(event.target.value))}
            />
          </label>
          <label>
            Suggested settle time between departures
            <div className="duration-input">
              <input
                aria-label="Suggested settle time"
                type="number"
                min={0}
                max={3600}
                value={restSeconds}
                onChange={(event) => setRestSeconds(Number(event.target.value))}
              />
              <span>seconds</span>
            </div>
          </label>
          {(warmupCount === 0 || restSeconds === 0) && (
            <p className="field-help">
              These are advanced choices. Zero warm-ups removes the short practice
              checks, and zero settle time removes the app&apos;s suggested pause; keep
              the defaults if you are unsure.
            </p>
          )}
          <button
            className="secondary-button"
            onClick={() =>
              void onUpdateScenario(
                scenario.id,
                trackLabel,
                trackStart,
                warmupCount,
                restSeconds
              )
            }
          >
            Save track changes
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div>
          <p className="kicker">Daily ceiling</p>
          <h2>How many timed sessions per day, at most.</h2>
          <p>
            Counted across every training track, since it's the same dog. Separation
            training needs comfortable gaps between sessions. More attempts in one day
            are not automatically better. Two is the default; three is the absolute
            maximum and remains a ceiling, not a target. This is a SettledSolo safety
            limit, not a universal clinical dosage.
          </p>
        </div>
        <div className="track-form">
          <label>
            Timed sessions per day
            <input
              aria-label="Daily main-departure cap"
              type="number"
              min={1}
              max={MAX_DAILY_CAP}
              value={dailyCap}
              onChange={(event) => setDailyCap(Number(event.target.value))}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => void onUpdateDailyCap(dailyCap)}
          >
            Save daily ceiling
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div>
          <p className="kicker">Another routine</p>
          <h2>Add a separate training track.</h2>
          <p>
            Useful when a context really behaves differently, such as a school-run
            departure versus an evening departure. Do not split tracks just to chase
            better numbers.
          </p>
        </div>
        <div className="track-form">
          <label>
            New track name
            <input
              value={newTrackLabel}
              maxLength={48}
              placeholder="e.g. School run"
              onChange={(event) => setNewTrackLabel(event.target.value)}
            />
          </label>
          <label>
            Known comfortable duration
            <div className="duration-input">
              <input
                aria-label="New track starting comfort"
                type="number"
                min={1}
                max={7200}
                value={newTrackStart}
                onChange={(event) => setNewTrackStart(Number(event.target.value))}
              />
              <span>seconds</span>
            </div>
          </label>
          <button
            className="secondary-button"
            disabled={!newTrackLabel.trim() || newTrackStart < 1}
            onClick={async () => {
              await onCreateScenario(newTrackLabel, newTrackStart);
              setTrackLabel(newTrackLabel.trim());
              setTrackStart(newTrackStart);
              setNewTrackLabel("");
            }}
          >
            Add training track
          </button>
        </div>
      </section>


      <section className="settings-card">
        <div>
          <p className="kicker">Return alerts</p>
          <h2>Know when it is time to head back.</h2>
          <p>
            Enable a native return alert for the main departure while you watch the
            camera in another app. Foreground chimes stay local, and the timer and
            saved session never depend on notification delivery.
          </p>
        </div>
        <div className="track-form">
          <label>
            Remind me to head back
            <select
              value={walkBackSeconds}
              onChange={(event) => {
                const seconds = Number(event.target.value);
                setWalkBackSeconds(seconds);
                saveWalkBackSeconds(seconds);
              }}
            >
              {WALK_BACK_OPTIONS.map((option) => (
                <option key={option.seconds} value={option.seconds}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="field-help">
            Choose roughly how long it takes to walk back to your dog, so you arrive
            around the target rather than after it. Coming back within this time
            still counts as reaching the target. Short departures use less, and this
            setting stays on this device.
          </p>
        </div>
        {(notificationPermission === "default" ||
          (notificationPermission === "granted" && backgroundAlertsReady !== true)) &&
          alertCapabilities().push && (
          <button
            className="secondary-button"
            onClick={() => void enableReturnAlerts()}
          >
            {notificationPermission === "granted"
              ? "Set up return alerts"
              : "Enable return alerts"}
          </button>
        )}
        {notificationPermission === "granted" && backgroundAlertsReady === true && (
          <span className="alert-status enabled">Background return alerts ready</span>
        )}
        {notificationPermission === "granted" && backgroundAlertsReady === false && (
          <span className="alert-status">
            Notifications are allowed, but background return alerts are not available
            right now. The in-app timer still works.
          </span>
        )}
        {notificationPermission === "denied" && (
          <span className="alert-status">Return alerts are blocked in this browser</span>
        )}
        {(notificationPermission === "unsupported" || !alertCapabilities().push) && (
          <span className="alert-status">
            Background return alerts are unavailable here. On iPhone, install
            SettledSolo to the Home Screen and enable notifications there.
          </span>
        )}
      </section>

      <section className="data-tools-card">
        <div>
          <p className="kicker">Your data</p>
          <h2>Keep a copy whenever you want.</h2>
          <p>
            Export a complete backup or a spreadsheet-friendly session history. These
            exports stay free even if paid features are added later.
          </p>
        </div>
        <div className="data-tools-actions">
          <button onClick={() => downloadBackup(data)}>Download backup</button>
          <button onClick={() => downloadSessionsCsv(data)}>Export CSV</button>
          <button onClick={() => fileInput.current?.click()}>Restore backup</button>
        </div>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Choose backup file"
          onChange={(event) =>
            void chooseBackup(event.target.files?.[0])
          }
        />

        {restoreError && (
          <div className="restore-message restore-error" role="alert">
            {restoreError}
          </div>
        )}

        {pendingRestore && pendingSummary && (
          <div className="restore-preview">
            <div>
              <strong>Ready to restore {pendingSummary.dogName}</strong>
              <span>
                {pendingSummary.scenarios} training {
                  pendingSummary.scenarios === 1 ? "track" : "tracks"
                } · {pendingSummary.sessions} timed {
                  pendingSummary.sessions === 1 ? "session" : "sessions"
                } · {pendingSummary.cueSets} cue {
                  pendingSummary.cueSets === 1 ? "set" : "sets"
                }
              </span>
              <small>
                This replaces the current local training data on this device. Download
                a backup first if you want to keep the current version.
              </small>
            </div>
            <div className="restore-actions">
              <button
                className="restore-confirm"
                onClick={async () => {
                  await onRestoreBackup(pendingRestore);
                  setPendingRestore(null);
                }}
              >
                Restore this backup
              </button>
              <button onClick={() => setPendingRestore(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="settings-card danger-zone">
        <div>
          <p className="kicker">Danger zone</p>
          <h2>Reset SettledSolo and start again.</h2>
          <p>
            This permanently deletes {data.dogName}&apos;s local training tracks,
            session history, departure-cue progress and onboarding setup on this
            device. You&apos;ll return to the first-run assessment. This stops sync on this
            device but does not delete your cloud account or its history.
          </p>
          <p>
            Download a backup first if there is anything you may want to restore
            later.
          </p>
        </div>

        {!resetOpen ? (
          <button
            className="danger-button"
            type="button"
            onClick={() => setResetOpen(true)}
          >
            Reset SettledSolo
          </button>
        ) : (
          <div className="reset-confirmation" role="group" aria-label="Confirm app reset">
            <div className="reset-warning" id="reset-warning">
              <strong>This cannot be undone without a backup.</strong>
              <span>
                Type <b>RESET</b> below to confirm that you want to delete the
                local training data and run onboarding again.
              </span>
            </div>
            <label>
              Type RESET to confirm
              <input
                value={resetConfirmation}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="reset-warning"
                onChange={(event) => setResetConfirmation(event.target.value)}
              />
            </label>
            <div className="reset-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => downloadBackup(data)}
              >
                Download backup first
              </button>
              <button
                className="danger-button danger-confirm"
                type="button"
                disabled={resetConfirmation.trim().toUpperCase() !== "RESET"}
                onClick={() => void onResetApp()}
              >
                Delete local data and start over
              </button>
              <button
                className="text-reset-button"
                type="button"
                onClick={() => {
                  setResetOpen(false);
                  setResetConfirmation("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <HelpFeedbackCard storageMode={storageMode} />

      <section className="quiet-card vertical">
        <p className="kicker">Evidence-aware, not algorithm worship</p>
        <h2>Every recommendation should be explainable.</h2>
        <p>
          The new engine is based on gradual systematic desensitisation and observed
          behaviour. Its exact software step sizes are conservative product heuristics,
          not a claim that science has discovered the perfect percentage increase.
        </p>
      </section>

      <SupportCard />
    </div>
  );
}
