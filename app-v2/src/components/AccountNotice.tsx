import type { StorageMode } from "../data/repository";

export function AccountNotice({ storageMode, onOpenAccount }: { storageMode: StorageMode; onOpenAccount: () => void }) {
  if (storageMode !== "indexeddb") return null;

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
