import { useEffect, useRef, type CSSProperties } from "react";
import { formatDuration } from "../domain/trainingEngine";

const RING_SIZE = 280;
const RING_RADIUS = 112;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** m:ss, or h:mm:ss for long targets. No padded leading zero, so it fits the ring. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

function ringOffset(progress: number): number {
  return RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function ProgressRing({
  elapsed,
  targetSeconds,
  over,
  startedAt
}: {
  elapsed: number;
  targetSeconds: number;
  over: boolean;
  /** Departure start. When present, the ring fills smoothly between whole seconds. */
  startedAt?: number | null;
}) {
  const valueRef = useRef<SVGCircleElement>(null);
  const smooth = startedAt != null && !over && !prefersReducedMotion();
  const targetMs = Math.max(1, targetSeconds) * 1000;

  // Drive the ring from the timestamp every frame, outside React rendering. The
  // clock text still updates once a second, and the saved timer is unaffected.
  useEffect(() => {
    if (!smooth || startedAt == null) return;
    let frame = 0;
    const draw = () => {
      const progress = (Date.now() - startedAt) / targetMs;
      valueRef.current?.setAttribute("stroke-dashoffset", String(ringOffset(progress)));
      if (progress < 1) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [smooth, startedAt, targetMs]);

  const progress = elapsed / Math.max(1, targetSeconds);
  const clock = over
    ? `+${formatClock(elapsed - targetSeconds)}`
    : formatClock(targetSeconds - elapsed);
  const label = over
    ? `Target reached, ${formatDuration(elapsed - targetSeconds)} over`
    : `${formatDuration(targetSeconds - elapsed)} remaining of ${formatDuration(targetSeconds)}`;

  return (
    <div className={`progress-ring ${over ? "over" : ""}`} role="img" aria-label={label}>
      <svg
        className="progress-ring-svg"
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden="true"
      >
        <circle
          className="progress-ring-track"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
        />
        <circle
          ref={valueRef}
          className="progress-ring-value"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          // While smooth, the frame loop owns this attribute; React must not
          // rewrite it back to the last whole second on each tick.
          strokeDashoffset={smooth ? undefined : ringOffset(progress)}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </svg>
      <div className="progress-ring-content">
        <div
          className={`live-clock ${over ? "over" : ""}`}
          style={{ "--clock-chars": clock.length } as CSSProperties}
        >
          {clock}
        </div>
        <span className="progress-ring-of">of {formatDuration(targetSeconds)}</span>
      </div>
    </div>
  );
}
