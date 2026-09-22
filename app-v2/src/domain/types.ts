export type Outcome = "relaxed" | "concern" | "distressed";

export type StartingPath = "departure-cues" | "micro-departure" | "known-duration";

export interface OnboardingProfile {
  version: 2;
  startingPath: StartingPath;
  completedAt: number;
}

export type ObservedSignal =
  | "exit-watching"
  | "pacing"
  | "panting"
  | "whining"
  | "barking-howling"
  | "unable-to-settle"
  | "food-refusal"
  | "self-injury"
  | "escape-attempt"
  | "destructive-escape";

export type SessionTag =
  | "morning"
  | "afternoon"
  | "evening"
  | "not-walked-yet"
  | "after-a-walk"
  | "before-food"
  | "after-food"
  | "radio-or-tv-on"
  | "crated-confined"
  | "free-roam";

export interface TrainingSession {
  id: string;
  at: number;
  targetSeconds: number;
  actualSeconds: number;
  outcome: Outcome;
  stoppedEarly: boolean;
  signals: ObservedSignal[];
  tags: SessionTag[];
  stopReason: string;
  note: string;
  /** Outcomes recorded for the short departures that preceded the main one. */
  practiceReviews?: PracticeDepartureReview[];
}

export interface PracticeDepartureReview {
  targetSeconds: number;
  actualSeconds: number;
  outcome: Outcome;
}

export interface DepartureCueSession {
  id: string;
  at: number;
  cueIndex: number;
  relaxedReps: number;
  concernReps: number;
  outcome: Outcome;
}

export interface DepartureCuePractice {
  level: number;
  sessions: DepartureCueSession[];
}

export interface Scenario {
  id: string;
  label: string;
  startSeconds: number;
  sessions: TrainingSession[];
  cuePractice?: DepartureCuePractice;
  /** Number of short practice departures before the main one. Defaults to four below ten minutes. */
  warmupCount?: number;
  /**
   * Legacy persisted preference. The current app exposes a per-session shuffle
   * action on Today instead of a permanent setting.
   */
  shuffleWarmups?: boolean;
  /** Suggested minimum settle time between departures, in seconds. Defaults to 60 when unset. */
  restSeconds?: number;
}

export interface Recommendation {
  targetSeconds: number;
  direction: "start" | "repeat" | "increase" | "reduce";
  reason: string;
  supportFlag: boolean;
  /** Recent sessions are difficult enough that skipping training entirely today is the better call. */
  restDayRecommended: boolean;
  /** Difficulty has persisted without progress for long enough to suggest involving a vet or veterinary behaviourist. */
  referralSuggested: boolean;
  /** A high-risk sign was logged; timed absences should pause pending professional advice. */
  highRiskFlag: boolean;
}

export interface AppData {
  /** Private local sync metadata; never sent to analytics or imported from a backup. */
  sync?: import("../account/syncState").SyncState;
  dogName: string;
  /** Versioned first-run routing. Existing users may not have this field. */
  onboarding?: OnboardingProfile;
  /** Versioned one-time observation before duration training. Existing users may not have this field. */
  preProtocolObservation?: import("./preProtocolObservation").PreProtocolObservation;
  activeScenarioId: string;
  scenarios: Scenario[];
  /** Main departures allowed per day, counted across every scenario. Defaults to 2 and is capped at 3. */
  dailyCap?: number;
}
