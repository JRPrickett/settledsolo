import type { AppData } from "../domain/types";

/**
 * When a local-only owner last downloaded a backup on this device, and when a
 * dismissed reminder may return. Device-local: the reminder is about this
 * device's copy, so neither value is synced, exported or restored.
 */
export const LAST_BACKUP_KEY = "settledsolo.last-backup-at.v1";
export const BACKUP_SNOOZE_KEY = "settledsolo.backup-reminder-snoozed-until.v1";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Enough history that losing it would hurt; a new user is not nagged. */
export const BACKUP_REMINDER_MIN_SESSIONS = 10;
export const BACKUP_REMINDER_INTERVAL_DAYS = 30;
export const BACKUP_REMINDER_SNOOZE_DAYS = 14;

export interface BackupReminderState {
  lastBackupAt: number | null;
  snoozedUntil: number | null;
}

function readTime(key: string): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeTime(key: string, value: number): void {
  try {
    globalThis.localStorage?.setItem(key, String(value));
  } catch {
    // Without storage the reminder may reappear; the backup itself still downloaded.
  }
}

export function loadBackupReminderState(): BackupReminderState {
  return { lastBackupAt: readTime(LAST_BACKUP_KEY), snoozedUntil: readTime(BACKUP_SNOOZE_KEY) };
}

export function recordBackupDownloaded(now = Date.now()): void {
  writeTime(LAST_BACKUP_KEY, now);
}

export function snoozeBackupReminder(now = Date.now()): void {
  writeTime(BACKUP_SNOOZE_KEY, now + BACKUP_REMINDER_SNOOZE_DAYS * DAY_MS);
}

export function savedSessionCount(data: AppData): number {
  return data.scenarios.reduce((total, scenario) => total + scenario.sessions.length, 0);
}

/** Account sync keeps a second copy, so only unsynced logs need a reminder. */
function syncedToAccount(data: AppData): boolean {
  return Boolean(data.sync?.enabled && !data.sync.deleted);
}

export function backupReminderDue(
  data: AppData,
  state: BackupReminderState,
  now = Date.now()
): boolean {
  if (syncedToAccount(data)) return false;
  if (savedSessionCount(data) < BACKUP_REMINDER_MIN_SESSIONS) return false;
  if (state.snoozedUntil !== null && now < state.snoozedUntil) return false;
  if (state.lastBackupAt === null) return true;
  return now - state.lastBackupAt >= BACKUP_REMINDER_INTERVAL_DAYS * DAY_MS;
}
