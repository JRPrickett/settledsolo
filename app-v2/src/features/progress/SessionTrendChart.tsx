import { useState } from "react";
import type { TrainingSession } from "../../domain/types";
import { formatDuration } from "../../domain/trainingEngine";

const OUTCOME_COLOR: Record<TrainingSession["outcome"], string> = {
  relaxed: "#5f8a72",
  concern: "#c08a49",
  distressed: "#b56860"
};

const OUTCOME_LABEL: Record<TrainingSession["outcome"], string> = {
  relaxed: "Relaxed",
  concern: "Some concern",
  distressed: "Distressed"
};

const WINDOW = 14;
const CHART_HEIGHT = 120;
const BAR_GAP = 4;
type TrendFilter = "all" | TrainingSession["outcome"];

const FILTERS: Array<{ value: TrendFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "relaxed", label: "Relaxed" },
  { value: "concern", label: "Concern" },
  { value: "distressed", label: "Distressed" }
];

export function SessionTrendChart({ sessions }: { sessions: TrainingSession[] }) {
  const [filter, setFilter] = useState<TrendFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const recent = sessions
    .filter((session) => filter === "all" || session.outcome === filter)
    .slice(-WINDOW);

  if (recent.length === 0) return null;

  const maxSeconds = Math.max(...recent.map((session) => session.actualSeconds), 1);
  const barWidth = 100 / recent.length;
  const activeSession = recent.find((session) => session.id === selectedId) ?? recent.at(-1)!;

  return (
    <section className="pattern-card">
      <div>
        <p className="kicker">Duration over time</p>
        <h2>{filter === "all" ? "Your recent main departures." : `${OUTCOME_LABEL[filter]} sessions.`}</h2>
        <p>
          Bar height is how long they actually stayed away for, not the target —
          colour is what happened while they were.
        </p>
      </div>

      <div className="trend-filters" role="tablist" aria-label="Filter duration chart">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            className={filter === item.value ? "selected" : ""}
            onClick={() => {
              setFilter(item.value);
              setSelectedId(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <svg
        className="trend-chart"
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Duration of ${recent.length} ${filter === "all" ? "recent main departures" : `${OUTCOME_LABEL[filter].toLowerCase()} sessions`}, coloured by outcome`}
      >
        {recent.map((session, index) => {
          const heightRatio = session.actualSeconds / maxSeconds;
          const barHeight = Math.max(3, heightRatio * (CHART_HEIGHT - 4));
          const x = index * barWidth + BAR_GAP / 2;
          const width = Math.max(1, barWidth - BAR_GAP);
          const y = CHART_HEIGHT - barHeight;
          const isActive = session.id === activeSession.id;

          return (
            <rect
              key={session.id}
              x={x}
              y={y}
              width={width}
              height={barHeight}
              rx={Math.min(2, width / 2)}
              fill={OUTCOME_COLOR[session.outcome]}
              opacity={isActive ? 1 : 0.55}
              onClick={() => setSelectedId(session.id)}
              tabIndex={0}
              role="button"
              aria-label={`${formatDuration(session.actualSeconds)}, ${OUTCOME_LABEL[session.outcome]}, ${new Date(session.at).toLocaleDateString()}`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(session.id);
                }
              }}
            >
              <title>
                {formatDuration(session.actualSeconds)} · {OUTCOME_LABEL[session.outcome]} ·{" "}
                {new Date(session.at).toLocaleDateString()}
              </title>
            </rect>
          );
        })}
      </svg>

      {activeSession && (
        <p className="trend-caption">
          <strong>{formatDuration(activeSession.actualSeconds)}</strong> ·{" "}
          {OUTCOME_LABEL[activeSession.outcome]} ·{" "}
          {new Date(activeSession.at).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short"
          })}
          {activeSession.stoppedEarly && " · stopped early"}
        </p>
      )}

      <div className="trend-legend">
        {(Object.keys(OUTCOME_LABEL) as Array<TrainingSession["outcome"]>).map((outcome) => (
          <span key={outcome}>
            <i style={{ background: OUTCOME_COLOR[outcome] }} />
            {OUTCOME_LABEL[outcome]}
          </span>
        ))}
      </div>
    </section>
  );
}
