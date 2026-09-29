import { useEffect, useRef, useState, type RefObject } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { BrandMark } from "../brand/BrandMark";
import { isIOS, isStandalone } from "../pwa/installStatus";
import { IOSInstallDemo } from "../pwa/IOSInstallDemo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function IOSInstallGuide({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog
      ref={dialogRef}
      className="ios-install-dialog"
      aria-labelledby="ios-install-title"
    >
      <button className="ios-install-close" type="button" onClick={() => dialogRef.current?.close()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
        <span className="visually-hidden">Close installation guide</span>
      </button>

      <div className="ios-install-copy">
        <BrandMark compact />
        <p>Install on iPhone or iPad</p>
        <h2 id="ios-install-title">Keep SettledSolo one tap away.</h2>
        <ol>
          <li><span>1</span>Open this page in Safari.</li>
          <li><span>2</span>Tap the three dots, then <strong>Share</strong>.</li>
          <li><span>3</span>Choose <strong>Add to Home Screen</strong>.</li>
        </ol>
        <small>It&apos;s this same website, saved as an icon. No App Store, account or payment card, and you can remove it like any other app.</small>
      </div>

      <IOSInstallDemo />
    </dialog>
  );
}

export function PublicInstallAction() {
  useRegisterSW({ immediate: true });
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const guideRef = useRef<HTMLDialogElement>(null);
  const ios = isIOS();

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

  if (installed) {
    return <a className="marketing-primary" href="/app/">Open SettledSolo</a>;
  }

  if (installEvent) {
    return (
      <button
        className="marketing-primary marketing-install-button"
        type="button"
        onClick={async () => {
          await installEvent.prompt();
          const choice = await installEvent.userChoice;
          setInstallEvent(null);
          if (choice.outcome === "accepted") setInstalled(true);
        }}
      >
        Install SettledSolo
      </button>
    );
  }

  if (ios) {
    return (
      <>
        <button
          className="marketing-primary marketing-install-button"
          type="button"
          onClick={() => guideRef.current?.showModal()}
        >
          Install on iPhone
        </button>
        <IOSInstallGuide dialogRef={guideRef} />
      </>
    );
  }

  return <a className="marketing-primary" href="/app/">Start training free</a>;
}
