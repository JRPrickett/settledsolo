import { useState } from "react";
import type { AppData } from "../domain/types";
import type { StorageMode } from "../data/repository";
import { downloadBackup } from "../data/export";
import {
  backupReminderDue,
  loadBackupReminderState,
  savedSessionCount,
  snoozeBackupReminder
} from "../data/backupReminder";

export function AccountNotice({ data, storageMode, onOpenAccount }: {
  data: AppData;
  storageMode: StorageMode;
  onOpenAccount: () => void;
}) {
  const [reminderDue, setReminderDue] = useState(() =>
    backupReminderDue(data, loadBackupReminderState())
  );

  if (storageMode !== "indexeddb") return null;

  if (reminderDue) {
    const { lastBackupAt } = loadBackupReminderState();
    return (
      <aside className="account-notice backup-reminder" aria-label="Backup reminder">
        <div>
          <strong>Keep a copy of {data.dogName}&apos;s training record.</strong>
          <span>
            {savedSessionCount(data)} sessions are saved only on this device
            {lastBackupAt === null
              ? " and have never been backed up."
              : `, last backed up ${new Date(lastBackupAt).toLocaleDateString()}.`}
            {" "}Download a backup and keep it somewhere safe, such as cloud storage or email.
          </span>
        </div>
        <div className="backup-reminder-actions">
          <button
            type="button"
            onClick={() => {
              downloadBackup(data);
              setReminderDue(false);
            }}
          >
            Download backup
          </button>
          <button
            type="button"
            className="backup-reminder-later"
            onClick={() => {
              snoozeBackupReminder();
              setReminderDue(false);
            }}
          >
            Remind me later
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="account-notice">
      <div>
        <strong>Your progress is saved on this device.</strong>
        <span>
          Optional account sync and backup controls are in More.
        </span>
        <span>
          Keep a separate copy with More → Download backup. Installing the app does not back up your history.
        </span>
      </div>
      <button type="button" onClick={onOpenAccount}>
        Account & backup
      </button>
    </aside>
  );
}
