import { useEffect, useMemo, useState } from "react";
import type { AppData } from "../../domain/types";
import type { StorageMode } from "../../data/repository";
import { activeScenario } from "../../data/appData";
import {
  buildPracticeDepartures,
  formatDuration,
  recommendNext
} from "../../domain/trainingEngine";
import {
  DEPARTURE_CUES,
  cuePracticeReadyForDeparture,
  recommendCueLevel
} from "../../domain/departureCues";
import { effectiveDailyCap, isDailyCapReached, sessionsToday } from "../../domain/dailyCap";
import {
  shouldOfferPreProtocolObservation,
  type PreProtocolFinding
} from "../../domain/preProtocolObservation";
import { PreProtocolObservationCard } from "./PreProtocolObservationCard";
import { AccountNotice } from "../../components/AccountNotice";
import { backupReminderDue, loadBackupReminderState } from "../../data/backupReminder";
import { MilestoneBanner } from "../progress/MilestoneBanner";
import type { Achievement, EarnedMilestone } from "../../domain/milestones";

/**
 * Once a track has this many sessions the owner has seen the standing guidance,
 * so it collapses to one line that still opens in place. A product choice.
 */
const GUIDANCE_COMPACT_AFTER_SESSIONS = 5;

const COVERAGE_OPTIONS = [
  "Daycare or an in-home pet sitter",
  "A dog walker for a midday break",
  "Trading off with a partner, housemate or neighbour",
  "Bringing them to work, or working from home that day"
];

function newWarmupSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) || Date.now();
}

export function Today({
  data,
  storageMode,
  celebration,
  onDismissCelebration,
  onStart,
  onOpenCuePractice,
  onOpenAccount,
  onOpenSummary,
  onRecordObservation
}: {
  data: AppData;
  storageMode: StorageMode;
  celebration: { milestones: EarnedMilestone[]; achievements: Achievement[] } | null;
  onDismissCelebration: () => void;
  onStart: (target: number, warmupSeed: number) => Promise<boolean>;
  onOpenCuePractice: () => void;
  onOpenAccount: () => void;
  onOpenSummary?: () => void;
  onRecordObservation: (
    outcome: "observed" | "skipped",
    findings: PreProtocolFinding[]
  ) => void;
}) {
  const scenario = activeScenario(data);
  const recommendation = useMemo(
    () => recommendNext(scenario.sessions, scenario.startSeconds),
    [scenario]
  );
  const cueRecommendation = useMemo(
    () => recommendCueLevel(scenario.cuePractice),
    [scenario.cuePractice]
  );
  const [warmupSeed, setWarmupSeed] = useState(newWarmupSeed);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const practice = buildPracticeDepartures(
    recommendation.targetSeconds,
    warmupSeed,
    scenario.warmupCount,
    true
  );
  const capReached = isDailyCapReached(data, effectiveDailyCap(data));
  const [restDayOverride, setRestDayOverride] = useState(false);
  useEffect(() => setRestDayOverride(false), [scenario.id]);
  useEffect(() => setStartError(""), [scenario.id, data.dailyCap]);

  const cueFirstRoute =
    data.onboarding?.startingPath === "departure-cues" &&
    scenario.sessions.length === 0;
  const cueReady =
    cueFirstRoute && cuePracticeReadyForDeparture(scenario.cuePractice);
  const cuePracticeOnly = cueFirstRoute && !cueReady;
  const firstMicroObservation =
    data.onboarding?.startingPath === "micro-departure" &&
    scenario.sessions.length === 0;
  const offerObservation = shouldOfferPreProtocolObservation(
    data,
    scenario,
    !cuePracticeOnly
  );
  const showRestDayCard =
    recommendation.restDayRecommended && !capReached && !restDayOverride;
  async function beginSession() {
    setStarting(true);
    setStartError("");
    try {
      const started = await onStart(recommendation.targetSeconds, warmupSeed);
      if (!started) {
        setStartError(
          "Another training session has already used today's ceiling. Refreshing your plan is the safest next step."
        );
      }
    } finally {
      setStarting(false);
    }
  }
  const planReason = firstMicroObservation
    ? "There is no known-comfortable absence yet, so the first departure is intentionally tiny and should be adjusted from what you observe."
    : cueReady
      ? "Repeated calm practice at the most departure-like doorway cue suggests it is reasonable to try one very brief departure."
      : recommendation.reason;
  const lastSession = scenario.sessions.at(-1);
  // A due backup reminder stays near the plan; the everyday storage note sits last.
  const backupReminderShowing = useMemo(
    () => backupReminderDue(data, loadBackupReminderState()),
    [data]
  );
  const guidanceSettled = scenario.sessions.length >= GUIDANCE_COMPACT_AFTER_SESSIONS;
  const coverageCopy = cuePracticeOnly
    ? `While ${data.dogName} is working on departure cues, avoid unnecessary real absences where practical so those cues are not repeatedly followed by a difficult separation.`
    : `Training works best when ${data.dogName} isn't practising anxiety outside of a session too. Try not to leave them alone longer than today's plan for anything else this week, errands included.`;

  return (
    <div className="screen-stack">
      <section className="today-intro">
        <p>Today with</p>
        <h1>You &amp; {data.dogName}</h1>
        <span>Calm starts with small steps.</span>
      </section>

      {celebration && (celebration.milestones.length > 0 || celebration.achievements.length > 0) && (
        <MilestoneBanner celebration={celebration} onDismiss={onDismissCelebration} />
      )}

      {offerObservation && (
        <PreProtocolObservationCard
          dogName={data.dogName}
          onRecord={(findings) => onRecordObservation("observed", findings)}
          onSkip={() => onRecordObservation("skipped", [])}
        />
      )}

      {cuePracticeOnly ? (
        <section className="today-card starting-route-card">
          <p className="kicker">Your starting plan</p>
          <div className="starting-route-heading">
            <div>
              <h1>Departure cues first</h1>
              <p>No real leaving yet.</p>
            </div>
            <span className="direction direction-repeat">Foundation</span>
          </div>

          <p className="starting-route-copy">
            Getting ready to leave already changes {data.dogName}&apos;s behaviour.
            Work on one mild cue at a time while staying home, and only make it more
            departure-like while they remain relaxed.
          </p>

          <div className="practice-preview">
            <span>Current cue</span>
            <strong>{DEPARTURE_CUES[cueRecommendation.cueIndex]}</strong>
            <small>{cueRecommendation.reason}</small>
          </div>

          <div className="starting-observation-note">
            <strong>Keep this genuinely easy</strong>
            <p>
              If even a mild getting-ready cue causes clear or escalating distress,
              stop rather than pushing through it. A vet or appropriately qualified
              behaviour professional can help with more severe cases.
            </p>
          </div>

          {cueRecommendation.supportFlag && (
            <div className="support-card">
              The last cue practice was too difficult. Stop for now, return to an
              easier step next time, and consider qualified behavioural support if
              distress is strong or persistent.
            </div>
          )}

          <button
            className="primary-button start-button"
            onClick={onOpenCuePractice}
          >
            Start departure cue practice
          </button>
          <p className="ceiling-note">
            This practice deliberately does not ask you to leave.
          </p>
        </section>
      ) : (
        <section className="today-card">
          <p className="kicker">Today&apos;s plan</p>
          <div className="target-row">
            <div>
              <h1>{formatDuration(recommendation.targetSeconds)}</h1>
              <p>main departure</p>
            </div>
            <span className={`direction direction-${recommendation.direction}`}>
              {recommendation.direction === "increase"
                ? "Small step up"
                : recommendation.direction === "reduce"
                  ? "Easier today"
                  : recommendation.direction === "start"
                    ? "Starting point"
                    : "Repeat"}
            </span>
          </div>

          {lastSession && (
            <div className="today-stats-strip" aria-label="Recent and next duration">
              <div>
                <span>Last target</span>
                <strong>{formatDuration(lastSession.targetSeconds)}</strong>
              </div>
              <div>
                <span>Last actual</span>
                <strong>{formatDuration(lastSession.actualSeconds)}</strong>
              </div>
              <div className="today-stats-next">
                <span>Next target</span>
                <strong>{formatDuration(recommendation.targetSeconds)}</strong>
              </div>
            </div>
          )}

          {firstMicroObservation && (
            <div className="starting-observation-note">
              <strong>Starting observation</strong>
              <p>
                Three seconds is a deliberately cautious SettledSolo starting
                point (a rule of thumb) because you do not yet have an observed comfortable
                absence. If possible, watch on a camera and return sooner at the
                first sign of concern.
              </p>
            </div>
          )}

          {cueReady && (
            <div className="starting-observation-note">
              <strong>Ready for the first brief departure</strong>
              <p>
                The most departure-like doorway cue has stayed relaxed across
                repeated practice. Try the very short departure below and keep
                observing {data.dogName}, ideally by camera.
              </p>
            </div>
          )}

          {practice.length > 0 &&
            !capReached &&
            !showRestDayCard &&
            !recommendation.highRiskFlag && (
            <div className="practice-preview">
              <div className="practice-preview-heading">
                <span>Before the main departure</span>
                <button
                  type="button"
                  className="shuffle-button"
                  aria-label="Shuffle warm-up durations"
                  onClick={() => setWarmupSeed(newWarmupSeed())}
                >
                  Shuffle
                </button>
              </div>
              <strong aria-live="polite" aria-atomic="true">
                {practice.map((seconds) => formatDuration(seconds)).join(" · ")}
              </strong>
              <small>
                Brief, varied practice departures with calm settle time between them.
              </small>
            </div>
          )}

          <div className="why-card">
            <span>Why this plan?</span>
            <p>{planReason}</p>
          </div>

          {recommendation.supportFlag &&
            !showRestDayCard &&
            !recommendation.highRiskFlag &&
            !recommendation.referralSuggested && (
              <div className="support-card">
                Several recent sessions showed concern. Make things easier and consider
                checking in with an accredited separation anxiety specialist (such as a
                Certified Separation Anxiety Trainer) before pushing duration.
              </div>
            )}

          {recommendation.referralSuggested && !recommendation.highRiskFlag && (
            <div className="support-card referral-card">
              <strong>Worth involving a vet at this point.</strong>
              <p>
                Training has been difficult for a while now without moving forward.
                Your vet, or a veterinary behaviourist, can check whether something
                medical is contributing and talk through whether medication alongside
                training would help in {data.dogName}&apos;s case.
              </p>
              <p>
                SettledSolo can&apos;t make that assessment, and it isn&apos;t a sign
                you have done anything wrong — persistent cases often need more than
                training on its own. Keep logging sessions either way; the record is
                useful to bring to an appointment.
              </p>
              {onOpenSummary && (
                <button type="button" className="text-link-button" onClick={onOpenSummary}>
                  Open a summary to bring to the appointment
                </button>
              )}
            </div>
          )}

          {recommendation.highRiskFlag ? (
            <div className="support-card referral-card" role="alert">
              <strong>Pause timed departures.</strong>
              <p>
                A high-risk sign is recorded in this track. Do not run another timed
                absence just to collect more app data. Speak with your vet or a
                qualified behaviour professional, and use management to avoid another
                difficult absence where practical.
              </p>
              {onOpenSummary && (
                <button type="button" className="text-link-button" onClick={onOpenSummary}>
                  Open a summary to share with them
                </button>
              )}
            </div>
          ) : capReached ? (
            <div className="support-card daily-cap-card">
              {sessionsToday(data)} timed training session{sessionsToday(data) === 1 ? "" : "s"} logged
              today — that&apos;s today&apos;s ceiling. More attempts are not automatically
              better, especially if {data.dogName} is not comfortably settled between
              them. Departure-cue practice below is still available.
            </div>
          ) : showRestDayCard ? (
            <div className="support-card rest-day-card">
              <strong>Consider a rest day.</strong> Recent sessions have been difficult
              enough that a full day without training — no timed absences at all — is
              likely to help more than an easier session would. Setbacks are normal;
              skipping today is part of the plan, not a failure of it.
              <button
                type="button"
                className="text-button rest-day-override"
                onClick={() => setRestDayOverride(true)}
              >
                Train anyway
              </button>
            </div>
          ) : (
            <>
              {startError && (
                <div className="support-card" role="alert">
                  {startError}
                </div>
              )}
              <button
                className="primary-button start-button"
                disabled={starting}
                onClick={() => void beginSession()}
              >
                {starting ? "Checking today's ceiling…" : "Start today's session"}
              </button>
              <p className="ceiling-note">
                The target is a ceiling, not a quota. Returning early is always okay.
              </p>
            </>
          )}
        </section>
      )}

      {backupReminderShowing && (
        <AccountNotice data={data} storageMode={storageMode} onOpenAccount={onOpenAccount} />
      )}

      {guidanceSettled ? (
        <section className="cue-entry-card coverage-card coverage-compact">
          <details>
            <summary>Cover real absences while you train</summary>
            <p>{coverageCopy}</p>
            <ul className="coverage-list">
              {COVERAGE_OPTIONS.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          </details>
        </section>
      ) : (
        <section className="cue-entry-card coverage-card">
          <div>
            <p className="kicker">While you&apos;re actively training</p>
            <h2>Cover real absences, not just training sessions.</h2>
            <p>{coverageCopy}</p>
          </div>
          <details className="coverage-options">
            <summary>Ways to cover a real absence</summary>
            <ul>
              {COVERAGE_OPTIONS.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {!cuePracticeOnly && (
        <section className="cue-entry-card">
          <div>
            <p className="kicker">Before you can leave</p>
            <h2>Do keys, shoes or the door still cause worry?</h2>
            <p>Practise those cues without leaving, so they stop predicting an absence.</p>
          </div>
          <button className="secondary-button" onClick={onOpenCuePractice}>
            Departure cue practice
          </button>
        </section>
      )}

      {/* The track name only matters once there is more than one routine. */}
      {data.scenarios.length > 1 && (
        <section className="quiet-card session-summary-card">
          <div>
            <p className="kicker">Your training track</p>
            <h2>{scenario.label}</h2>
            <p className="quiet-copy">A separate history for this routine.</p>
          </div>
          <div className="mini-stat">
            <strong>{scenario.sessions.length}</strong>
            <span>sessions logged</span>
          </div>
        </section>
      )}

      {!backupReminderShowing && (
        <AccountNotice data={data} storageMode={storageMode} onOpenAccount={onOpenAccount} />
      )}
    </div>
  );
}
