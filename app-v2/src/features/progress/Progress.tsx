import type { AppData } from "../../domain/types";
import { activeScenario } from "../../data/appData";
import { progressInsights } from "../../domain/progressInsights";
import { formatDuration } from "../../domain/trainingEngine";
import { observedSignalOptions } from "../../domain/observedSignals";
import { milestoneBoard } from "../../domain/milestones";
import { SessionTrendChart } from "./SessionTrendChart";

export function Progress({ data }: { data: AppData }) {
  const scenario = activeScenario(data);
  const sessions = scenario.sessions;
  const insights = progressInsights(sessions);
  const board = milestoneBoard(data);
  const earnedCount = board.earned.size;
  const signalLabel = new Map(
    observedSignalOptions.map(({ value, label }) => [value, label])
  );

  return (
    <div className="screen-stack">
      <section className="page-heading">
        <p className="kicker">Progress</p>
        <h1>Look for comfort, not just longer times.</h1>
        <p>
          A shorter relaxed departure can be better progress than a longer difficult one.
        </p>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>Longest relaxed</span>
          <strong>
            {insights.longestRelaxedSeconds
              ? formatDuration(insights.longestRelaxedSeconds)
              : "—"}
          </strong>
          <small>Relaxed time, up to each session's target</small>
        </div>
        <div className="stat-card">
          <span>Recent comfort</span>
          <strong>
            {insights.recentTotal
              ? `${insights.recentRelaxed}/${insights.recentTotal}`
              : "—"}
          </strong>
          <small>Relaxed sessions in the latest 10</small>
        </div>
      </section>

      <SessionTrendChart sessions={sessions} />

      <section className="milestone-card">
        <div>
          <p className="kicker">Milestones</p>
          <h2>{earnedCount} of {board.ladder.length} earned</h2>
          <p>
            Earned the first time a relaxed session reaches that length, counting no
            more than its planned target, so rungs follow your gradual progression.
            Counted across every training track — it's the same dog doing all of them.
          </p>
        </div>

        {board.next ? (
          <div className="milestone-next">
            <div className="milestone-next-row">
              <span>Next: {board.next.label} alone</span>
              <span className="milestone-next-amount">
                {board.longestRelaxedSeconds >= board.next.seconds
                  ? "there"
                  : `${formatDuration(board.next.seconds - board.longestRelaxedSeconds)} to go`}
              </span>
            </div>
            <div className="milestone-progress-track">
              <div
                className="milestone-progress-fill"
                style={{ width: `${(board.progressToNext * 100).toFixed(1)}%` }}
              />
            </div>
            <p className="milestone-longest">
              Longest relaxed absence so far: {board.longestRelaxedSeconds
                ? formatDuration(board.longestRelaxedSeconds)
                : "none yet"}.
            </p>
          </div>
        ) : (
          <p className="milestone-longest">
            Every milestone logged. These are comfortable durations recorded in the
            tracks and contexts you have used — not a general measure of what your dog
            can manage everywhere.
          </p>
        )}

        <div className="milestone-ladder">
          {board.ladder.map((rung) => {
            const earned = board.earned.get(rung.seconds);
            const isNext = board.next?.seconds === rung.seconds;
            return (
              <div
                key={rung.seconds}
                className={`milestone-rung ${earned ? "earned" : isNext ? "next" : ""}`}
              >
                <span className="milestone-rung-label">{rung.label}</span>
                <span className="milestone-rung-sub">
                  {earned
                    ? new Date(earned.at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short"
                      })
                    : isNext
                      ? "next up"
                      : ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {insights.signals.length > 0 && (
        <section className="pattern-card">
          <div>
            <p className="kicker">Recent observations</p>
            <h2>What you have actually seen.</h2>
            <p>
              These are patterns in your last {insights.recentTotal} logged sessions,
              not a diagnosis or proof that a particular context caused the behaviour.
            </p>
          </div>
          <div className="signal-summary">
            {insights.signals.map(({ signal, count }) => (
              <span key={signal}>
                <strong>{signalLabel.get(signal) ?? signal}</strong>
                <small>{count} {count === 1 ? "session" : "sessions"}</small>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="quiet-card vertical">
        <p className="kicker">What counts as progress</p>
        <h2>Duration is only one signal.</h2>
        <p>
          When you save a session, tick the signs you noticed, such as pacing,
          whining, watching the exit or being unable to settle. They build the
          observation summary on this page, describing what you saw rather than
          proving what caused it.
        </p>
      </section>
    </div>
  );
}
