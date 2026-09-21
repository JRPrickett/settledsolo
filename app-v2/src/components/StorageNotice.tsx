import type { AppData } from "../domain/types";
import type { StorageMode } from "../data/repository";
import { downloadBackup } from "../data/export";

export function StorageNotice({ data, mode, training }: {
  data: AppData;
  mode: StorageMode;
  training: boolean;
}) {
  if (mode === "indexeddb") return null;
  return (
    <aside className={`account-notice storage-notice${mode === "memory" ? " storage-danger" : ""}`} role="status" aria-label="Storage recovery">
      <div>
        <strong>{mode === "memory" ? "Keep this page open — progress is only in memory." : "Using compatibility storage."}</strong>
        <span>
          {mode === "memory"
            ? "This browser cannot save changes to this device. Download a backup before closing or reloading. Account sync is paused."
            : "Progress is saved on this device, but account sync is paused. Keep a separate backup."}
        </span>
        {training && <span>Finish and save your session before downloading its record. A backup only includes saved training.</span>}
      </div>
      <button type="button" onClick={() => downloadBackup(data)}>Back up saved training</button>
    </aside>
  );
}
