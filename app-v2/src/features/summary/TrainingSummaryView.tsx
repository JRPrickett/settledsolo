import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "../../domain/types";
import { formatDuration } from "../../domain/trainingEngine";
import { formatAbsenceDuration } from "../../domain/journal";
import {
  OUTCOME_LABELS,
  SUMMARY_RECENT_WINDOW,
  buildTrainingSummary,
  type CountedLabel,
  type SummarySessionRow,
  type SummaryTrack
} from "../../data/trainingSummary";
import { downloadSummaryPage } from "../../data/export";

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function countedList(items: CountedLabel[]): string {
  return items.map(({ label, count }) => (count > 1 ? `${label} (${count})` : label)).join(", ");
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function OutcomeText({ row }: { row: SummarySessionRow }) {
  const warmupsNotRelaxed = row.warmups && row.warmups.relaxed < row.warmups.total;
  return (
    <>
      <span className={`summary-outcome summary-outcome-${row.outcome}`}>
        {OUTCOME_LABELS[row.outcome]}
      </span>
      {warmupsNotRelaxed && row.warmups && (
        <span className="summary-sub">
          Warm-ups: {row.warmups.relaxed} of {row.warmups.total} relaxed
        </span>
      )}
    </>
  );
}

function SignsText({ row }: { row: SummarySessionRow }) {
  const details = [...row.signals, ...row.tags].join(", ");
  return (
    <>
      {row.highRisk && <strong className="summary-risk">High-risk sign. </strong>}
      {details || "No signs or context noted"}
    </>
  );
}

function OwnerText({ row }: { row: SummarySessionRow }) {
  return (
    <>
      {row.stopReason && <span>Came back because: {row.stopReason}</span>}
      {row.note && <span>{row.note}</span>}
    </>
  );
}

function TrackSection({ track, includeNotes }: { track: SummaryTrack; includeNotes: boolean }) {
  const { outcomes, next } = track;
  return (
    <section className="summary-section" aria-labelledby={`summary-track-${track.id}`}>
      <h2 id={`summary-track-${track.id}`}>{track.label}</h2>

      <dl className="summary-facts">
        <div>
          <dt>Starting duration</dt>
          <dd>{formatDuration(track.startSeconds)}, the plan&apos;s first ceiling</dd>
        </div>
        <div>
          <dt>Timed sessions</dt>
          <dd>
            {track.sessionCount === 0
              ? "None yet"
              : `${track.sessionCount}: ${outcomes.relaxed} relaxed, ${outcomes.concern} some concern, ${outcomes.distressed} distressed`}
          </dd>
        </div>
        {track.sessionCount > 0 && (
          <>
            <div>
              <dt>Recent sessions</dt>
              <dd>
                {track.recentRelaxed} of the last {Math.min(track.recentTotal, SUMMARY_RECENT_WINDOW)} relaxed
              </dd>
            </div>
            <div>
              <dt>Longest relaxed absence</dt>
              <dd>
                {track.longestRelaxedSeconds
                  ? `${formatDuration(track.longestRelaxedSeconds)} (counted up to the planned time)`
                  : "None yet"}
              </dd>
            </div>
          </>
        )}
        {next && (
          <div>
            <dt>Next plan in the app</dt>
            <dd>
              {next.paused
                ? "Timed departures paused after a high-risk sign"
                : `${formatDuration(next.targetSeconds)} (${next.direction.toLowerCase()})`}
            </dd>
          </div>
        )}
      </dl>

      {next && !next.paused && <p className="summary-note">{next.reason}</p>}

      {(track.highRiskDates.length > 0 || next?.vetSuggested || next?.supportSuggested) && (
        <ul className="summary-flags">
          {track.highRiskDates.length > 0 && (
            <li>
              <strong>High-risk sign recorded</strong> (self-injury, an escape attempt or damaging a
              barrier) on {track.highRiskDates.map(formatDate).join(", ")}.
            </li>
          )}
          {next?.vetSuggested && !next.paused && (
            <li>
              <strong>The app suggested involving a vet or veterinary behaviourist</strong> after
              difficulty persisted without progress.
            </li>
          )}
          {next?.supportSuggested && !next.vetSuggested && (
            <li>
              <strong>Several recent sessions showed concern.</strong> The app suggested easier
              sessions and specialist support.
            </li>
          )}
        </ul>
      )}

      {track.sessionCount > 0 && (
        <dl className="summary-facts summary-facts-wide">
          <div>
            <dt>Signs the owner noticed</dt>
            <dd>{track.signals.length ? countedList(track.signals) : "None ticked"}</dd>
          </div>
          <div>
            <dt>Context noted</dt>
            <dd>{track.tags.length ? countedList(track.tags) : "None noted"}</dd>
          </div>
        </dl>
      )}

      {track.cuePractice && (
        <p className="summary-note">
          <strong>Departure-cue practice (no leaving):</strong>{" "}
          {plural(track.cuePractice.sets, "set")}. Current step: {track.cuePractice.currentCue.toLowerCase()}.
          {track.cuePractice.lastOutcome && track.cuePractice.lastAt !== null && (
            <> Last set: {OUTCOME_LABELS[track.cuePractice.lastOutcome].toLowerCase()} on {formatDate(track.cuePractice.lastAt)}.</>
          )}
        </p>
      )}

      {track.rows.length > 0 && (
        <>
          <p className="summary-caption">
            Most recent sessions, newest first.
            {track.olderSessions > 0 &&
              ` ${plural(track.olderSessions, "older session")} ${track.olderSessions === 1 ? "is" : "are"} in the CSV export.`}
          </p>

          {/* Wide screens and print: a table. Phones: the same rows as a list. */}
          <div
            className="summary-table-wrap"
            role="region"
            aria-label={`${track.label}: recent sessions`}
            tabIndex={0}
          >
            <table className="summary-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Planned</th>
                  <th scope="col">Away</th>
                  <th scope="col">How it went</th>
                  <th scope="col">Signs and context</th>
                  {includeNotes && <th scope="col">Owner&apos;s notes</th>}
                </tr>
              </thead>
              <tbody>
                {track.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="summary-nowrap">{formatDate(row.at)}</td>
                    <td className="summary-nowrap">{formatDuration(row.targetSeconds)}</td>
                    <td className="summary-nowrap">
                      {formatDuration(row.actualSeconds)}
                      {row.stoppedEarly && <span className="summary-sub">came back early</span>}
                      {row.firstSignSeconds !== null && (
                        <span className="summary-sub">first sign at {formatDuration(row.firstSignSeconds)}</span>
                      )}
                    </td>
                    <td>
                      <OutcomeText row={row} />
                    </td>
                    <td>
                      <SignsText row={row} />
                    </td>
                    {includeNotes && (
                      <td className="summary-owner-text">
                        <OwnerText row={row} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ol className="summary-list" aria-label={`${track.label}: recent sessions`}>
            {track.rows.map((row) => (
              <li key={row.id}>
                <p className="summary-list-head">
                  <span>{formatDate(row.at)}</span>
                  <OutcomeText row={row} />
                </p>
                <p>
                  Planned {formatDuration(row.targetSeconds)} · away {formatDuration(row.actualSeconds)}
                  {row.stoppedEarly ? " (came back early)" : ""}
                  {row.firstSignSeconds !== null ? ` · first sign at ${formatDuration(row.firstSignSeconds)}` : ""}
                </p>
                <p className="summary-list-signs">
                  <SignsText row={row} />
                </p>
                {includeNotes && (row.stopReason || row.note) && (
                  <div className="summary-owner-text">
                    <OwnerText row={row} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export function TrainingSummaryView({
  data,
  onClose
}: {
  data: AppData;
  onClose: () => void;
}) {
  const [includeNotes, setIncludeNotes] = useState(true);
  const summary = useMemo(() => buildTrainingSummary(data), [data]);
  const sheet = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const documentTitle = `${summary.dogName} training summary ${formatDate(summary.generatedAt)}`;

  // The page title becomes the suggested file name when printing to PDF.
  useEffect(() => {
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, []);

  const range =
    summary.firstAt !== null && summary.lastAt !== null
      ? `${formatDate(summary.firstAt)} to ${formatDate(summary.lastAt)}`
      : null;

  return (
    <div className="summary-shell">
      <div className="summary-toolbar">
        <button type="button" className="summary-back" onClick={onClose}>
          Back
        </button>
        <div className="summary-actions">
          <label className="summary-toggle">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(event) => setIncludeNotes(event.target.checked)}
            />
            Include notes
          </label>
          <button type="button" className="summary-print" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button
            type="button"
            className="summary-download"
            onClick={() => {
              if (sheet.current) downloadSummaryPage(sheet.current, documentTitle);
            }}
          >
            Download as a file
          </button>
        </div>
        <p className="summary-privacy">
          Built on this device from your log. It is only shared if you print, save or send it.
        </p>
      </div>

      <article className="summary-sheet" ref={sheet} aria-labelledby="summary-title">
        <header className="summary-head">
          <h1 id="summary-title" ref={heading} tabIndex={-1}>
            {summary.dogName}&apos;s separation training record
          </h1>
          <p className="summary-meta">
            Prepared {formatDate(summary.generatedAt)} from the owner&apos;s SettledSolo log
            {range ? ` · ${range}` : ""} · {plural(summary.totalSessions, "timed session")}
          </p>
        </header>

        <dl className="summary-facts">
          {summary.startingRoute && (
            <div>
              <dt>How training started</dt>
              <dd>{summary.startingRoute}</dd>
            </div>
          )}
          <div>
            <dt>Daily limit</dt>
            <dd>Up to {plural(summary.dailyCap, "timed session")} a day</dd>
          </div>
          {summary.observation && (
            <div>
              <dt>One-time observation before training</dt>
              <dd>
                {summary.observation.skipped
                  ? "Skipped"
                  : summary.observation.findings.join("; ") || "Recorded, nothing ticked"}
              </dd>
            </div>
          )}
        </dl>

        {summary.tracks.map((track) => (
          <TrackSection key={track.id} track={track} includeNotes={includeNotes} />
        ))}

        {(summary.lifeEvents.length > 0 || summary.realAbsences.length > 0) && (
          <section className="summary-section" aria-labelledby="summary-context">
            <h2 id="summary-context">Changes and other absences</h2>
            {summary.lifeEvents.length > 0 && (
              <>
                <p className="summary-caption">Life events the owner noted, newest first.</p>
                <ul className="summary-events">
                  {summary.lifeEvents.map((event) => (
                    <li key={event.id}>
                      <strong>{formatDate(event.at)}</strong> {event.label}
                      {includeNotes && event.note && <span className="summary-sub">{event.note}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {summary.realAbsences.length > 0 && (
              <>
                <p className="summary-caption">
                  Unavoidable absences outside training, newest first.
                </p>
                <ul className="summary-events">
                  {summary.realAbsences.map((absence) => (
                    <li key={absence.id}>
                      <strong>{formatDate(absence.at)}</strong> {formatAbsenceDuration(absence.durationSeconds)}{" "}
                      alone, {absence.outcome.toLowerCase()}
                      {includeNotes && absence.note && <span className="summary-sub">{absence.note}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <section className="summary-section summary-reading" aria-labelledby="summary-reading">
          <h2 id="summary-reading">How to read this record</h2>
          <ul>
            <li>
              <strong>How it went</strong> is the owner&apos;s own rating. Relaxed: settled quickly,
              with no pacing, whining or watching the exit for more than a few seconds. Some concern:
              signs that eased or stayed mild. Distressed: sustained signs, or the reason the owner
              came back early.
            </li>
            <li>
              <strong>Away</strong> is the time until the owner tapped &quot;I&apos;m back&quot;.
              Planned times are a ceiling, not a target. Coming back early is recorded as good
              handling, not failure.
            </li>
            <li>
              Warm-ups are short practice departures before the main one. They are listed only
              when one was not relaxed.
            </li>
            <li>
              Plans follow gradual, below-threshold desensitisation. Exact step sizes and limits are
              SettledSolo product rules, not clinical prescriptions.
            </li>
          </ul>
        </section>

        <footer className="summary-foot">
          Generated by SettledSolo (settledsolo.com), a training and record-keeping aid. It does
          not diagnose separation anxiety or replace advice from a vet or qualified behaviour
          professional.
        </footer>
      </article>
    </div>
  );
}
