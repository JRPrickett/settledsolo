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
import { MilestoneBanner } from "../progress/MilestoneBanner";
import type { Achievement, EarnedMilestone } from "../../domain/milestones";

export function Today({
  data,
  storageMode,
  celebration,
  onDismissCelebration,
  onStart,
  onOpenCuePractice,
  onOpenAccount,
  onRecordObservation
}: {
  data: AppData;
  storageMode: StorageMode;
  celebration: { milestones: EarnedMilestone[]; achievements: Achievement[] } | null;
  onDismissCelebration: () => void;
  onStart: (target: number) => void;
  onOpenCuePractice: () => void;
  onOpenAccount: () => void;
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
  const practice = buildPracticeDepartures(
    recommendation.targetSeconds,
    scenario.sessions.length,
    scenario.warmupCount,
    scenario.shuffleWarmups
  );
  const capReached = isDailyCapReached(data, effectiveDailyCap(data));
  const [restDayOverride, setRestDayOverride] = useState(false);
  useEffect(() => setRestDayOverride(false), [scenario.id]);

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
  const planReason = firstMicroObservation
    ? "There is no known-comfortable absence yet, so the first departure is intentionally tiny and should be adjusted from what you observe."
    : cueReady
      ? "Repeated calm practice at the most departure-like doorway cue suggests it is reasonable to try one very brief departure."
      : recommendation.reason;

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

          {firstMicroObservation && (
            <div className="starting-observation-note">
              <strong>Starting observation</strong>
              <p>
                Three seconds is a deliberately cautious SettledSolo starting
                heuristic because you do not yet have an observed comfortable
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

          {practice.length > 0 && !capReached && !showRestDayCard && (
            <div className="practice-preview">
              <span>Before the main departure</span>
              <strong>
                {practice.map((seconds) => formatDuration(seconds)).join(" · ")}
              </strong>
              <small>Short practice departures with calm settle time between them.</small>
            </div>
          )}

          <div className="why-card">
            <span>Why this plan?</span>
            <p>{planReason}</p>
          </div>

          {recommendation.supportFlag && !showRestDayCard && (
            <div className="support-card">
              Several recent sessions showed concern. Make things easier and consider
              checking in with an accredited separation anxiety specialist (such as a
              Certified Separation Anxiety Trainer) before pushing duration.
            </div>
          )}

          {capReached ? (
            <div className="support-card daily-cap-card">
              {sessionsToday(data)} main departure{sessionsToday(data) === 1 ? "" : "s"} logged
              today — that&apos;s today&apos;s ceiling. Separation training consolidates in the gaps
              between sessions, and cramming in another attempt tends to set a dog back
              rather than speed things up. Departure-cue practice below is still available.
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
              <button
                className="primary-button start-button"
                onClick={() => onStart(recommendation.targetSeconds)}
              >
                Start today&apos;s session
              </button>
              <p className="ceiling-note">
                The target is a ceiling, not a quota. Returning early is always okay.
              </p>
            </>
          )}
        </section>
      )}

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

      <AccountNotice storageMode={storageMode} onOpenAccount={onOpenAccount} />

      <section className="cue-entry-card coverage-card">
        <div>
          <p className="kicker">While you&apos;re actively training</p>
          <h2>Cover real absences, not just training sessions.</h2>
          <p>
            {cuePracticeOnly
              ? `While ${data.dogName} is working on departure cues, avoid unnecessary real absences where practical so those cues are not repeatedly followed by a difficult separation.`
              : `Training works best when ${data.dogName} isn't practising anxiety outside of a session too. Try not to leave them alone longer than today's plan for anything else this week — errands included.`}
          </p>
        </div>
        <details className="coverage-options">
          <summary>Ways to cover a real absence</summary>
          <ul>
            <li>Daycare or an in-home pet sitter</li>
            <li>A dog walker for a midday break</li>
            <li>Trading off with a partner, housemate or neighbour</li>
            <li>Bringing them to work, or working from home that day</li>
          </ul>
        </details>
      </section>

      {!cuePracticeOnly && (
        <section className="cue-entry-card">
          <div>
            <p className="kicker">Before you can leave</p>
            <h2>Does getting ready to go already cause worry?</h2>
            <p>
              Practise departure cues without actually leaving, so keys, shoes and the
              door become less predictive.
            </p>
          </div>
          <button className="secondary-button" onClick={onOpenCuePractice}>
            Departure cue practice
          </button>
        </section>
      )}
    </div>
  );
}
