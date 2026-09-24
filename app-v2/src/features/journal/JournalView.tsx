import { useEffect, useRef, useState } from "react";
import type {
  AppData,
  CoverOption,
  JournalEntry,
  LifeEventCategory,
  Outcome
} from "../../domain/types";
import {
  COVER_LABELS,
  LIFE_EVENT_LABELS,
  MAX_JOURNAL_DURATION_SECONDS,
  REAL_ABSENCE_OUTCOME_LABELS,
  formatAbsenceDuration,
  lifeEvents,
  realAbsences,
  upcomingPlannedAbsences
} from "../../domain/journal";
import { createOpaqueId } from "../../domain/ids";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateInput(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeInput(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocal(date: string, time = "12:00"): number | null {
  const at = new Date(`${date}T${time || "12:00"}`).getTime();
  return Number.isFinite(at) ? at : null;
}

function when(at: number, withTime = true): string {
  return new Date(at).toLocaleString(undefined, {
    weekday: withTime ? "short" : undefined,
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" })
  });
}

function DurationFields({
  idPrefix,
  hours,
  minutes,
  onHours,
  onMinutes
}: {
  idPrefix: string;
  hours: string;
  minutes: string;
  onHours: (value: string) => void;
  onMinutes: (value: string) => void;
}) {
  return (
    <fieldset className="journal-duration">
      <legend>How long</legend>
      <label htmlFor={`${idPrefix}-hours`}>
        <input
          id={`${idPrefix}-hours`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={hours}
          onChange={(event) => onHours(event.target.value.replace(/\D/g, ""))}
        />
        hours
      </label>
      <label htmlFor={`${idPrefix}-minutes`}>
        <input
          id={`${idPrefix}-minutes`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={minutes}
          onChange={(event) => onMinutes(event.target.value.replace(/\D/g, ""))}
        />
        minutes
      </label>
    </fieldset>
  );
}

function durationSeconds(hours: string, minutes: string): number {
  return (Number(hours || 0) * 60 + Number(minutes || 0)) * 60;
}

function validDuration(seconds: number): boolean {
  return seconds >= 60 && seconds <= MAX_JOURNAL_DURATION_SECONDS;
}

export type JournalFocus = "planner" | "absences" | "events";

export function JournalView({
  data,
  onSave,
  onClose,
  focus = "planner"
}: {
  data: AppData;
  onSave: (journal: JournalEntry[]) => Promise<void>;
  onClose: () => void;
  focus?: JournalFocus;
}) {
  const journal = data.journal ?? [];
  const dogName = data.dogName || "your dog";
  const [now] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const sections = {
    planner: useRef<HTMLElement>(null),
    absences: useRef<HTMLElement>(null),
    events: useRef<HTMLElement>(null)
  };

  const [planDate, setPlanDate] = useState(() => dateInput(now));
  const [planTime, setPlanTime] = useState("09:00");
  const [planHours, setPlanHours] = useState("2");
  const [planMinutes, setPlanMinutes] = useState("0");
  const [planCover, setPlanCover] = useState<CoverOption>("not-covered");
  const [planNote, setPlanNote] = useState("");

  const [absenceDate, setAbsenceDate] = useState(() => dateInput(now));
  const [absenceTime, setAbsenceTime] = useState(() => timeInput(now));
  const [absenceHours, setAbsenceHours] = useState("1");
  const [absenceMinutes, setAbsenceMinutes] = useState("0");
  const [absenceOutcome, setAbsenceOutcome] = useState<Outcome | "unknown">("unknown");
  const [absenceNote, setAbsenceNote] = useState("");

  const [eventDate, setEventDate] = useState(() => dateInput(now));
  const [eventCategory, setEventCategory] = useState<LifeEventCategory>("moved-home");
  const [eventNote, setEventNote] = useState("");

  useEffect(() => {
    if (focus === "planner") {
      window.scrollTo(0, 0);
      heading.current?.focus();
    } else {
      sections[focus].current?.scrollIntoView();
      sections[focus].current?.querySelector("h2")?.focus();
    }
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(next: JournalEntry[]) {
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: JournalEntry, description: string) {
    if (!window.confirm(`Delete ${description}? This cannot be undone.`)) return;
    await save(journal.filter((item) => item.id !== entry.id));
  }

  const planned = upcomingPlannedAbsences(journal, now);
  const absences = realAbsences(journal).slice(-20).reverse();
  const events = lifeEvents(journal).slice().reverse();
  const planSeconds = durationSeconds(planHours, planMinutes);
  const planAt = parseLocal(planDate, planTime);
  const absenceSeconds = durationSeconds(absenceHours, absenceMinutes);
  const absenceAt = parseLocal(absenceDate, absenceTime);
  const eventAt = parseLocal(eventDate);

  return (
    <div className="journal-shell">
      <div className="summary-toolbar">
        <button type="button" className="summary-back" onClick={onClose}>
          Back
        </button>
      </div>

      <div className="screen-stack">
        <section className="page-heading">
          <h1 ref={heading} tabIndex={-1}>Life around training.</h1>
          <p>
            Plan cover for the week, log absences you could not avoid and note changes at
            home. The plan and your summary take them into account.
          </p>
        </section>

        <section className="settings-card journal-section" ref={sections.planner} aria-labelledby="journal-planner">
          <div>
            <h2 id="journal-planner" tabIndex={-1}>This week&apos;s absences</h2>
            <p>
              While {dogName} is in training, try to cover every absence longer than
              today&apos;s plan. List them here and who is covering each one.
            </p>
          </div>

          {planned.length ? (
            <ul className="journal-list">
              {planned.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{when(entry.at)}</strong>
                    <span>
                      {formatAbsenceDuration(entry.durationSeconds)} ·{" "}
                      <span className={entry.cover === "not-covered" ? "journal-uncovered" : undefined}>
                        {COVER_LABELS[entry.cover]}
                      </span>
                      {entry.note && ` · ${entry.note}`}
                    </span>
                  </div>
                  <button type="button" onClick={() => void remove(entry, `the absence on ${when(entry.at)}`)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="journal-empty">Nothing planned for the next seven days.</p>
          )}

          <div className="track-form journal-form">
            <div className="journal-row">
              <label>
                Date
                <input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} />
              </label>
              <label>
                Leaving at
                <input type="time" value={planTime} onChange={(event) => setPlanTime(event.target.value)} />
              </label>
            </div>
            <DurationFields
              idPrefix="plan"
              hours={planHours}
              minutes={planMinutes}
              onHours={setPlanHours}
              onMinutes={setPlanMinutes}
            />
            <label>
              Who is covering
              <select value={planCover} onChange={(event) => setPlanCover(event.target.value as CoverOption)}>
                {Object.entries(COVER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Note <small>Optional</small></span>
              <input value={planNote} maxLength={120} placeholder="e.g. Dentist" onChange={(event) => setPlanNote(event.target.value)} />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={saving || planAt === null || !validDuration(planSeconds)}
              onClick={async () => {
                if (planAt === null) return;
                await save([
                  ...journal,
                  { type: "planned-absence", id: createOpaqueId("j"), at: planAt, durationSeconds: planSeconds, cover: planCover, note: planNote.trim() }
                ]);
                setPlanNote("");
                setPlanCover("not-covered");
              }}
            >
              Add planned absence
            </button>
          </div>
        </section>

        <section className="settings-card journal-section" ref={sections.absences} aria-labelledby="journal-absences">
          <div>
            <h2 id="journal-absences" tabIndex={-1}>Absences you couldn&apos;t avoid</h2>
            <p>
              Real life happens. Logging an absence outside training keeps the record honest.
              If it went badly, the next plan holds or eases instead of stepping up.
            </p>
          </div>

          {absences.length > 0 && (
            <ul className="journal-list">
              {absences.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{when(entry.at)}</strong>
                    <span>
                      {formatAbsenceDuration(entry.durationSeconds)} alone · {REAL_ABSENCE_OUTCOME_LABELS[entry.outcome]}
                      {entry.note && ` · ${entry.note}`}
                    </span>
                  </div>
                  <button type="button" onClick={() => void remove(entry, `the absence on ${when(entry.at)}`)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="track-form journal-form">
            <div className="journal-row">
              <label>
                Date
                <input type="date" value={absenceDate} onChange={(event) => setAbsenceDate(event.target.value)} />
              </label>
              <label>
                Left at
                <input type="time" value={absenceTime} onChange={(event) => setAbsenceTime(event.target.value)} />
              </label>
            </div>
            <DurationFields
              idPrefix="absence"
              hours={absenceHours}
              minutes={absenceMinutes}
              onHours={setAbsenceHours}
              onMinutes={setAbsenceMinutes}
            />
            <label>
              How was {dogName}?
              <select
                value={absenceOutcome}
                onChange={(event) => setAbsenceOutcome(event.target.value as Outcome | "unknown")}
              >
                {Object.entries(REAL_ABSENCE_OUTCOME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Note <small>Optional</small></span>
              <input value={absenceNote} maxLength={120} placeholder="e.g. Barked for the first 20 minutes" onChange={(event) => setAbsenceNote(event.target.value)} />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={saving || absenceAt === null || !validDuration(absenceSeconds)}
              onClick={async () => {
                if (absenceAt === null) return;
                await save([
                  ...journal,
                  { type: "real-absence", id: createOpaqueId("j"), at: absenceAt, durationSeconds: absenceSeconds, outcome: absenceOutcome, note: absenceNote.trim() }
                ]);
                setAbsenceNote("");
                setAbsenceOutcome("unknown");
              }}
            >
              Log this absence
            </button>
          </div>
        </section>

        <section className="settings-card journal-section" ref={sections.events} aria-labelledby="journal-events">
          <div>
            <h2 id="journal-events" tabIndex={-1}>Changes at home</h2>
            <p>
              A move, an illness, a new baby or a change to {dogName}&apos;s vet-prescribed
              medication can all affect progress. Noting them helps explain a setback, to
              you and to anyone you share your summary with.
            </p>
          </div>

          {events.length > 0 && (
            <ul className="journal-list">
              {events.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{when(entry.at, false)}</strong>
                    <span>
                      {LIFE_EVENT_LABELS[entry.category]}
                      {entry.note && ` · ${entry.note}`}
                    </span>
                  </div>
                  <button type="button" onClick={() => void remove(entry, `"${LIFE_EVENT_LABELS[entry.category]}"`)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="track-form journal-form">
            <label>
              Date
              <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
            </label>
            <label>
              What changed
              <select value={eventCategory} onChange={(event) => setEventCategory(event.target.value as LifeEventCategory)}>
                {Object.entries(LIFE_EVENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Note <small>Optional</small></span>
              <input value={eventNote} maxLength={120} placeholder="e.g. Moved to a flat" onChange={(event) => setEventNote(event.target.value)} />
            </label>
            <p className="field-help">
              SettledSolo records medication changes only as context. Dosing and changes are
              for your vet.
            </p>
            <button
              type="button"
              className="secondary-button"
              disabled={saving || eventAt === null}
              onClick={async () => {
                if (eventAt === null) return;
                await save([
                  ...journal,
                  { type: "life-event", id: createOpaqueId("j"), at: eventAt, category: eventCategory, note: eventNote.trim() }
                ]);
                setEventNote("");
              }}
            >
              Add this change
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
