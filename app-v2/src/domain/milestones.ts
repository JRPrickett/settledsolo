import type { AppData, TrainingSession } from "./types";
import { creditedSeconds } from "./trainingEngine";

export interface MilestoneRung {
  seconds: number;
  label: string;
}

/**
 * Twenty rungs from 10 seconds to the 4-hour limit. Early rungs are close
 * together because many dogs start from a few seconds and small calm wins
 * matter most there; later rungs follow common real-life absences. Credit is
 * capped at each session's target, so rungs arrive only as the plan progresses.
 * Kept as an ordered list so the board can show locked rungs not yet reached.
 */
export const MILESTONE_LADDER: MilestoneRung[] = [
  { seconds: 10, label: "10 sec" },
  { seconds: 15, label: "15 sec" },
  { seconds: 30, label: "30 sec" },
  { seconds: 60, label: "1 min" },
  { seconds: 120, label: "2 min" },
  { seconds: 180, label: "3 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 600, label: "10 min" },
  { seconds: 900, label: "15 min" },
  { seconds: 1200, label: "20 min" },
  { seconds: 1800, label: "30 min" },
  { seconds: 2700, label: "45 min" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 4500, label: "75 min" },
  { seconds: 5400, label: "90 min" },
  { seconds: 7200, label: "2 hours" },
  { seconds: 9000, label: "2.5 hours" },
  { seconds: 10800, label: "3 hours" },
  { seconds: 12600, label: "3.5 hours" },
  { seconds: 14400, label: "4 hours" }
];

export interface EarnedMilestone {
  seconds: number;
  label: string;
  at: number;
  scenarioLabel: string;
  actualSeconds: number;
}

interface ScopedSession {
  session: TrainingSession;
  scenarioLabel: string;
}

/**
 * Milestones are earned by the same dog across every training track, so
 * credit is tracked once across all scenarios rather than per track.
 */
function allSessions(data: AppData): ScopedSession[] {
  return data.scenarios.flatMap((scenario) =>
    scenario.sessions.map((session) => ({ session, scenarioLabel: scenario.label }))
  );
}

/**
 * A milestone credits the relaxed time observed, capped at that session's
 * target (see creditedSeconds). Returning early while still relaxed keeps
 * credit for the time that was genuinely comfortable — the target is a
 * ceiling, not a quota — but overrunning the target, for example by
 * forgetting to tap "I'm back", never earns extra rungs.
 */
export function earnedMilestones(data: AppData): Map<number, EarnedMilestone> {
  const earned = new Map<number, EarnedMilestone>();

  for (const { session, scenarioLabel } of allSessions(data)) {
    if (session.outcome !== "relaxed") continue;

    for (const rung of MILESTONE_LADDER) {
      if (creditedSeconds(session) < rung.seconds) continue;
      const existing = earned.get(rung.seconds);
      if (!existing || session.at < existing.at) {
        earned.set(rung.seconds, {
          seconds: rung.seconds,
          label: rung.label,
          at: session.at,
          scenarioLabel,
          actualSeconds: creditedSeconds(session)
        });
      }
    }
  }

  return earned;
}

export function longestRelaxedSeconds(data: AppData): number {
  return allSessions(data).reduce(
    (best, { session }) =>
      session.outcome === "relaxed" ? Math.max(best, creditedSeconds(session)) : best,
    0
  );
}

export interface MilestoneBoard {
  ladder: MilestoneRung[];
  earned: Map<number, EarnedMilestone>;
  longestRelaxedSeconds: number;
  next: MilestoneRung | null;
  progressToNext: number;
}

export function milestoneBoard(data: AppData): MilestoneBoard {
  const earned = earnedMilestones(data);
  const longest = longestRelaxedSeconds(data);
  const next = MILESTONE_LADDER.find((rung) => !earned.has(rung.seconds)) ?? null;

  let progressToNext = 1;
  if (next) {
    const previousIndex = MILESTONE_LADDER.indexOf(next) - 1;
    const from = previousIndex >= 0 ? MILESTONE_LADDER[previousIndex].seconds : 0;
    progressToNext = Math.max(0, Math.min(1, (longest - from) / (next.seconds - from)));
  }

  return {
    ladder: MILESTONE_LADDER,
    earned,
    longestRelaxedSeconds: longest,
    next,
    progressToNext
  };
}

export function newlyEarnedMilestones(
  before: AppData,
  after: AppData
): EarnedMilestone[] {
  const beforeEarned = earnedMilestones(before);
  const afterEarned = earnedMilestones(after);

  return MILESTONE_LADDER.filter(
    (rung) => !beforeEarned.has(rung.seconds) && afterEarned.has(rung.seconds)
  ).map((rung) => afterEarned.get(rung.seconds)!);
}

export interface AchievementSnapshot {
  relaxedCount: number;
  currentRelaxedRun: number;
  totalRelaxedSeconds: number;
}

export function achievementSnapshot(data: AppData): AchievementSnapshot {
  const sessions = allSessions(data).sort((a, b) => a.session.at - b.session.at);
  const relaxed = sessions.filter(({ session }) => session.outcome === "relaxed");

  let currentRelaxedRun = 0;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    if (sessions[index].session.outcome === "relaxed") currentRelaxedRun += 1;
    else break;
  }

  return {
    relaxedCount: relaxed.length,
    currentRelaxedRun,
    totalRelaxedSeconds: relaxed.reduce((sum, { session }) => sum + creditedSeconds(session), 0)
  };
}

export interface Achievement {
  id: string;
  title: string;
  detail: string;
}

interface AchievementDefinition {
  id: string;
  met: (snapshot: AchievementSnapshot) => boolean;
  title: string;
  detail: string;
}

const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first-relaxed-session",
    met: (snapshot) => snapshot.relaxedCount >= 1,
    title: "First relaxed absence",
    detail: "The first timed absence was completed and came back relaxed."
  },
  {
    id: "five-relaxed-sessions",
    met: (snapshot) => snapshot.relaxedCount >= 5,
    title: "Five relaxed absences",
    detail: "Five timed absences have now been relaxed."
  },
  {
    id: "five-relaxed-in-a-row",
    met: (snapshot) => snapshot.currentRelaxedRun >= 5,
    title: "A settled stretch",
    detail: "The five most recent timed absences were all relaxed."
  },
  {
    id: "one-hour-relaxed-total",
    met: (snapshot) => snapshot.totalRelaxedSeconds >= 3600,
    title: "An hour of relaxed time alone",
    detail: "Relaxed absences now add up to at least an hour of comfortable time alone."
  }
];

export function newlyEarnedAchievements(
  before: AppData,
  after: AppData
): Achievement[] {
  const beforeSnapshot = achievementSnapshot(before);
  const afterSnapshot = achievementSnapshot(after);

  return ACHIEVEMENTS.filter(
    (achievement) => !achievement.met(beforeSnapshot) && achievement.met(afterSnapshot)
  ).map(({ id, title, detail }) => ({ id, title, detail }));
}
