import { useMemo, useState } from "react";
import { BrandMark } from "../../brand/BrandMark";
import type { StartingPath } from "../../domain/types";
import {
  determineStartingPlan,
  type ComfortableAbsenceAnswer,
  type DepartureCueResponse
} from "../../domain/onboarding";

type SetupStep = "name" | "cues" | "absence" | "duration" | "plan";

function planDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder
    ? `${minutes} min ${remainder} sec`
    : `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function Setup({
  onSaved,
  onOpenAccount
}: {
  onOpenAccount?: () => void;
  onSaved: (
    dogName: string,
    startSeconds: number,
    startingPath: StartingPath
  ) => Promise<void>;
}) {
  const [step, setStep] = useState<SetupStep>("name");
  const [name, setName] = useState("");
  const [cueResponse, setCueResponse] =
    useState<DepartureCueResponse | null>(null);
  const [comfortableAbsence, setComfortableAbsence] =
    useState<ComfortableAbsenceAnswer | null>(null);
  const [durationValue, setDurationValue] = useState("5");
  const [durationUnit, setDurationUnit] = useState<"seconds" | "minutes">(
    "seconds"
  );

  const numericDuration = Number.parseInt(durationValue, 10);
  const durationSeconds =
    Number.isFinite(numericDuration) && numericDuration > 0
      ? numericDuration * (durationUnit === "minutes" ? 60 : 1)
      : 0;
  const durationIsValid = durationSeconds >= 1 && durationSeconds <= 7200;

  const plan = useMemo(
    () =>
      cueResponse
        ? determineStartingPlan({
            cueResponse,
            comfortableAbsence,
            knownDurationSeconds: durationSeconds
          })
        : null,
    [cueResponse, comfortableAbsence, durationSeconds]
  );

  function changeDuration(value: string) {
    const digitsOnly = value.replace(/\D/g, "");
    setDurationValue(digitsOnly.replace(/^0+(?=\d)/, ""));
  }

  function back() {
    if (step === "cues") setStep("name");
    if (step === "absence") setStep("cues");
    if (step === "duration") setStep("absence");
    if (step === "plan") {
      if (cueResponse !== "relaxed") setStep("cues");
      else if (comfortableAbsence === "yes") setStep("duration");
      else setStep("absence");
    }
  }

  const dogName = name.trim() || "your dog";

  return (
    <main className="setup-shell">
      <section className="setup-card">
        <BrandMark light />
        <div className="setup-heading-row">
          <p className="setup-brand">SettledSolo</p>
          <span className="setup-progress">Getting started</span>
        </div>

        {step === "name" && (
          <>
            <h1>Calm starts with small steps.</h1>
            <p className="lead">
              We&apos;ll find a comfortable place to begin without asking your dog
              to prove how long they can cope.
            </p>

            <label>
              Your dog&apos;s name
              <input
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Mabel"
                maxLength={40}
              />
            </label>

            <button
              className="primary-button setup-next"
              disabled={!name.trim()}
              onClick={() => setStep("cues")}
            >
              Continue
            </button>
          </>
        )}

        {step === "cues" && (
          <>
            <p className="kicker">Before any leaving</p>
            <h1>What happens when you get ready to go?</h1>
            <p className="lead">
              Think about shoes, keys, a coat, a bag or moving toward the door.
              We&apos;re looking for the earliest point where {dogName} starts to
              become concerned.
            </p>

            <div className="setup-options" role="group" aria-label="Response to departure cues">
              {([
                ["relaxed", "Stays relaxed", "Getting-ready cues do not meaningfully change their behaviour."],
                ["watchful", "Gets watchful or follows me", "They become alert, shadow me, stare at the exit or struggle to settle."],
                ["distressed", "Gets clearly upset", "The routine already brings pacing, panting, vocalising or obvious distress."],
                ["unsure", "I'm not sure yet", "I haven't watched closely enough to know."]
              ] as const).map(([value, title, detail]) => (
                <button
                  key={value}
                  type="button"
                  className={`setup-choice${cueResponse === value ? " selected" : ""}`}
                  aria-pressed={cueResponse === value}
                  onClick={() => setCueResponse(value)}
                >
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </button>
              ))}
            </div>

            <div className="setup-camera-note" role="note">
              <strong>Important safety check.</strong>
              <span>
                If {dogName} has injured themselves, tried to escape through a barrier,
                or damaged doors or windows while alone, pause timed departures and
                speak to your vet or a qualified behaviour professional.
              </span>
              <span>
                If the problem started suddenly, or {dogName} is older or has been unwell
                or in pain, see your vet first. Medical problems can cause or add to
                distress when left alone.
              </span>
            </div>

            <div className="setup-actions">
              <button className="setup-back" type="button" onClick={back}>Back</button>
              <button
                className="primary-button"
                disabled={!cueResponse}
                onClick={() =>
                  setStep(cueResponse === "relaxed" ? "absence" : "plan")
                }
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "absence" && (
          <>
            <p className="kicker">A known-comfortable starting point</p>
            <h1>Have you already seen {dogName} stay comfortable after you leave?</h1>
            <p className="lead">
              Only count a duration you&apos;ve actually observed as comfortable.
              Do not deliberately stay away until anxiety appears just to find a limit.
            </p>

            <div className="setup-options" role="group" aria-label="Known comfortable absence">
              {([
                ["yes", "Yes", "I can name a duration I've already observed them manage calmly."],
                ["no", "Not yet", "I don't have a known-comfortable absence to start from."],
                ["unsure", "I'm not sure", "I'd rather begin with a very brief observation."]
              ] as const).map(([value, title, detail]) => (
                <button
                  key={value}
                  type="button"
                  className={`setup-choice${comfortableAbsence === value ? " selected" : ""}`}
                  aria-pressed={comfortableAbsence === value}
                  onClick={() => setComfortableAbsence(value)}
                >
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </button>
              ))}
            </div>

            <div className="setup-actions">
              <button className="setup-back" type="button" onClick={back}>Back</button>
              <button
                className="primary-button"
                disabled={!comfortableAbsence}
                onClick={() =>
                  setStep(comfortableAbsence === "yes" ? "duration" : "plan")
                }
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "duration" && (
          <>
            <p className="kicker">Known-comfortable duration</p>
            <h1>Start from what {dogName} has already shown you.</h1>
            <p className="lead">
              Enter a duration you&apos;ve observed them manage without meaningful
              signs of concern. This is a starting ceiling, not a target to beat.
            </p>

            <label className="duration-field">
              Comfortable duration
              <div className="duration-input">
                <input
                  aria-label="Comfortable duration"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={durationValue}
                  onChange={(event) => changeDuration(event.target.value)}
                />
                <select
                  aria-label="Duration unit"
                  value={durationUnit}
                  onChange={(event) =>
                    setDurationUnit(event.target.value as "seconds" | "minutes")
                  }
                >
                  <option value="seconds">seconds</option>
                  <option value="minutes">minutes</option>
                </select>
              </div>
            </label>

            <p className="field-help">
              If you are uncertain, go back and choose &quot;I&apos;m not sure&quot;.
              SettledSolo will begin more cautiously instead.
            </p>

            <div className="setup-actions">
              <button className="setup-back" type="button" onClick={back}>Back</button>
              <button
                className="primary-button"
                disabled={!durationIsValid}
                onClick={() => setStep("plan")}
              >
                See my starting plan
              </button>
            </div>
          </>
        )}

        {step === "plan" && plan && (
          <>
            <p className="kicker">Your starting plan</p>

            {plan.startingPath === "departure-cues" && (
              <>
                <h1>Start before the leaving part.</h1>
                <p className="lead">
                  Because getting-ready cues already change {dogName}&apos;s
                  behaviour — or you&apos;re not yet sure — start by making those
                  cues ordinary without actually leaving.
                </p>
                <div className="setup-plan">
                  <span className="setup-plan-badge">Departure cues first</span>
                  <strong>Keys, shoes, door movements — one mild step at a time.</strong>
                  <p>
                    SettledSolo will keep real departures out of the plan until repeated
                    cue practice stays relaxed.
                  </p>
                </div>
              </>
            )}

            {plan.startingPath === "micro-departure" && (
              <>
                <h1>Start with a 3-second observation.</h1>
                <p className="lead">
                  You don&apos;t need to discover {dogName}&apos;s maximum. The goal
                  is simply to begin with an extremely brief departure and observe.
                </p>
                <div className="setup-plan">
                  <span className="setup-plan-badge">Very brief first departure</span>
                  <strong>3 seconds, with a camera if you can.</strong>
                  <p>
                    Starting below distress is the evidence-led principle. The exact
                    3-second value is a conservative SettledSolo heuristic, not a
                    clinically validated threshold.
                  </p>
                </div>
              </>
            )}

            {plan.startingPath === "known-duration" && (
              <>
                <h1>Start from known comfort.</h1>
                <p className="lead">
                  You&apos;ve already seen {dogName} manage this amount of time
                  calmly, so SettledSolo can use it as the first training ceiling.
                </p>
                <div className="setup-plan">
                  <span className="setup-plan-badge">Observed comfortable duration</span>
                  <strong>{planDuration(plan.startSeconds)}</strong>
                  <p>
                    Return sooner whenever you need to. The app will adapt from what
                    you observe rather than treating this as a quota.
                  </p>
                </div>
              </>
            )}

            <div className="setup-camera-note">
              <strong>Observe, don&apos;t guess.</strong>
              <span>
                If possible, use a camera or spare phone so you can see early signs
                of concern rather than relying only on the clock.
              </span>
            </div>

            <div className="setup-camera-note">
              <strong>New to your home?</strong>
              <span>
                If {dogName} joined you recently, some worry when left may be settling in.
                Starting gently now still helps, and it does not need a diagnosis.
              </span>
            </div>

            <div className="setup-actions">
              <button className="setup-back" type="button" onClick={back}>Back</button>
              <button
                className="primary-button"
                onClick={() =>
                  void onSaved(name.trim(), plan.startSeconds, plan.startingPath)
                }
              >
                Use this starting plan
              </button>
            </div>
          </>
        )}

        <p className="disclaimer">
          SettledSolo is a training and record-keeping aid. It does not diagnose
          separation anxiety or replace advice from a veterinary behaviourist or
          appropriately qualified behaviour professional.
        </p>
        {onOpenAccount && (
          <button
            type="button"
            className="setup-back setup-account-button"
            onClick={onOpenAccount}
          >
            Sign in or create a free account
          </button>
        )}
      </section>
    </main>
  );
}
