import type { AppData } from "../../domain/types";
import { activeScenario } from "../../data/appData";
import { progressInsights } from "../../domain/progressInsights";
import { formatDuration } from "../../domain/trainingEngine";
import { observedSignalOptions } from "../../domain/observedSignals";
import { milestoneBoard } from "../../domain/milestones";
import { SessionTrendChart } from "./SessionTrendChart";
import { monthlyTrend } from "../../domain/planContext";
import { LIFE_EVENT_LABELS, lifeEvents } from "../../domain/journal";
import type { JournalFocus } from "../journal/JournalView";

function eventDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function Progress({
  data,
  onOpenJournal
}: {
  data: AppData;
  onOpenJournal?: (focus: JournalFocus) => void;
}) {
  const scenario = activeScenario(data);
  const sessions = scenario.sessions;
  const trend = monthlyTrend(sessions);
  const events = lifeEvents(data.journal).slice(-5).reverse();
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

      {trend && (
        <section className="pattern-card month-trend-card" aria-labelledby="month-trend-heading">
          <div>
            <p className="kicker">This month</p>
            <h2 id="month-trend-heading">The last 30 days against the 30 before.</h2>
            <p>
              Only {data.dogName}&apos;s own record on this track. It is not a forecast,
              and a quieter month with more relaxed sessions is still progress.
            </p>
          </div>
          <table className="month-trend">
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Measure</span></th>
                <th scope="col">Last 30 days</th>
                <th scope="col">30 days before</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Sessions</th>
                <td>{trend.current.sessions}</td>
                <td>{trend.previous.sessions}</td>
              </tr>
              <tr>
                <th scope="row">Relaxed</th>
                <td>{trend.current.relaxed} of {trend.current.sessions}</td>
                <td>{trend.previous.relaxed} of {trend.previous.sessions}</td>
              </tr>
              <tr>
                <th scope="row">Longest relaxed</th>
                <td>{trend.current.longestRelaxedSeconds ? formatDuration(trend.current.longestRelaxedSeconds) : "—"}</td>
                <td>{trend.previous.longestRelaxedSeconds ? formatDuration(trend.previous.longestRelaxedSeconds) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

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

      {(events.length > 0 || onOpenJournal) && (
        <section className="pattern-card" aria-labelledby="life-events-heading">
          <div>
            <p className="kicker">Context</p>
            <h2 id="life-events-heading">Changes at home.</h2>
            <p>
              A move, an illness or a new routine can explain a setback. Noting them keeps
              the record fair to {data.dogName}.
            </p>
          </div>
          {events.length > 0 && (
            <ul className="journal-list">
              {events.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{LIFE_EVENT_LABELS[entry.category]}</strong>
                    <span>
                      {eventDate(entry.at)}
                      {entry.note && ` · ${entry.note}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {onOpenJournal && (
            <button type="button" className="text-link-button" onClick={() => onOpenJournal("events")}>
              {events.length ? "Add or edit changes" : "Note a change at home"}
            </button>
          )}
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
