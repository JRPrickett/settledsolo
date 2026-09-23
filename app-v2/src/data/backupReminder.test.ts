import { describe, expect, it } from "vitest";
import type { AppData, TrainingSession } from "../domain/types";
import { backupReminderDue, BACKUP_REMINDER_SNOOZE_DAYS } from "./backupReminder";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

function sessions(count: number): TrainingSession[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    at: NOW - (count - index) * DAY,
    targetSeconds: 30,
    actualSeconds: 30,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: ""
  }));
}

function dataWith(count: number, extra: Partial<AppData> = {}): AppData {
  return {
    dogName: "Mabel",
    activeScenarioId: "a",
    scenarios: [
      { id: "a", label: "Front door", startSeconds: 5, sessions: sessions(Math.ceil(count / 2)) },
      { id: "b", label: "Car", startSeconds: 5, sessions: sessions(Math.floor(count / 2)) }
    ],
    ...extra
  } as AppData;
}

const never = { lastBackupAt: null, snoozedUntil: null };

describe("backup reminder", () => {
  it("waits until there is enough history to be worth protecting", () => {
    expect(backupReminderDue(dataWith(9), never, NOW)).toBe(false);
    expect(backupReminderDue(dataWith(10), never, NOW)).toBe(true);
  });

  it("returns 30 days after the last backup", () => {
    const data = dataWith(12);
    expect(backupReminderDue(data, { lastBackupAt: NOW - 29 * DAY, snoozedUntil: null }, NOW)).toBe(false);
    expect(backupReminderDue(data, { lastBackupAt: NOW - 30 * DAY, snoozedUntil: null }, NOW)).toBe(true);
  });

  it("respects a snooze until it expires", () => {
    const data = dataWith(12);
    const snoozedUntil = NOW + BACKUP_REMINDER_SNOOZE_DAYS * DAY;
    expect(backupReminderDue(data, { lastBackupAt: null, snoozedUntil }, NOW)).toBe(false);
    expect(backupReminderDue(data, { lastBackupAt: null, snoozedUntil }, snoozedUntil)).toBe(true);
  });

  it("is not needed while account sync keeps a second copy", () => {
    const sync = { accountId: "acct", enabled: true, cursor: 0, shadow: {}, remote: {}, outbox: [], conflicts: [], archive: [] };
    expect(backupReminderDue(dataWith(12, { sync }), never, NOW)).toBe(false);
    expect(backupReminderDue(dataWith(12, { sync: { ...sync, enabled: false } }), never, NOW)).toBe(true);
    expect(backupReminderDue(dataWith(12, { sync: { ...sync, deleted: true } }), never, NOW)).toBe(true);
  });
});
