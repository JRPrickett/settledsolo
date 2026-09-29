import { useEffect, useState } from "react";
import {
  isIOS,
  isStandalone,
  requestPersistentStorage
} from "./installStatus";
import { IOSInstallDemo } from "./IOSInstallDemo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * A local-first app that never gets installed is one silent iOS storage
 * eviction away from losing a training log. This asks the browser to
 * protect the data outright, and nudges toward the one action (installing
 * to the home screen) that reliably keeps it safe.
 */
export function InstallNotice() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (isStandalone() || installed || dismissed) return null;
  if (!installEvent && !isIOS()) return null;

  return (
    <aside className="install-notice" role="status">
      <div>
        <strong>
          {installEvent
            ? "Install SettledSolo for a safer, more reliable log."
            : "Add SettledSolo to your Home Screen."}
        </strong>
        <span>
          {installEvent
            ? "Your training record only exists on this device right now."
            : "iOS can clear a website's saved data after a week unused. Installing it avoids that and gives you the full app experience."}
        </span>
        <p className="install-reassure">
          It&apos;s this same website, saved as an icon. There&apos;s no app store, account
          or permissions involved, and you can remove it like any other app.
        </p>
        {!installEvent && isIOS() && (
          <details className="install-steps">
            <summary>Show me how</summary>
            <ol>
              <li>Tap the <b>three dots</b> at the bottom of Safari.</li>
              <li>Choose <b>Share</b>.</li>
              <li>Choose <b>Add to Home Screen</b>.</li>
              <li>Open SettledSolo from the new Home Screen icon.</li>
            </ol>
            <IOSInstallDemo compact />
          </details>
        )}
      </div>
      <div className="install-notice-actions">
        {installEvent && (
          <button
            className="secondary-button"
            onClick={async () => {
              await installEvent.prompt();
              await installEvent.userChoice;
              setInstallEvent(null);
            }}
          >
            Install
          </button>
        )}
        <button className="text-button install-dismiss" onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </aside>
  );
}
