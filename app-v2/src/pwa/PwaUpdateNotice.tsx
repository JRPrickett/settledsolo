import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdateNotice({ canUpdate = true }: { canUpdate?: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW();

  if (!canUpdate || (!needRefresh && !offlineReady)) return null;

  return (
    <aside className="pwa-notice" aria-live="polite">
      <div>
        <strong>{needRefresh ? "A new version is ready." : "Ready to use offline."}</strong>
        <span>
          {needRefresh
            ? "Update when you are between training sessions."
            : "The core app is now cached on this device."}
        </span>
      </div>
      <div className="pwa-notice-actions">
        {needRefresh && (
          <button
            className="pwa-update-button"
            onClick={() => void updateServiceWorker(true)}
          >
            Update now
          </button>
        )}
        <button
          className="pwa-later-button"
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
        >
          {needRefresh ? "Later" : "Got it"}
        </button>
      </div>
    </aside>
  );
}
