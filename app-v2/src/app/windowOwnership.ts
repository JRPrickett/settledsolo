export type WindowOwnership = "checking" | "active" | "waiting" | "unavailable";

// Separate from the short-lived repository mutation lock. Do not expire/steal this
// lock: a backgrounded phone may still own an unfinished training session.
const WINDOW_LOCK = "settledsolo-app-window";

export interface WindowLocks {
  request(name: string, options: LockOptions, callback: (lock: Lock | null) => void | Promise<void>): Promise<void>;
}

export function claimAppWindow(
  locks: WindowLocks | undefined,
  onState: (state: WindowOwnership) => void,
): () => void {
  let disposed = false;
  let release: (() => void) | undefined;
  onState("checking");
  if (!locks) {
    onState("unavailable");
    return () => { disposed = true; };
  }

  const claim = async () => {
    try {
      // React Strict Mode immediately disposes its first effect setup. Do not
      // submit that abandoned probe: the browser can reserve its lock before
      // invoking its callback, making the real probe incorrectly see contention.
      await Promise.resolve();
      if (disposed) return;
      await locks.request(WINDOW_LOCK, { mode: "exclusive", ifAvailable: true }, lock => {
        if (disposed) return;
        if (!lock) {
          onState("waiting");
          return;
        }
        return new Promise<void>(resolve => {
          release = resolve;
          onState("active");
        });
      });
    } catch {
      // Storage/security policy may deny an otherwise present API. Do not mount
      // another writable app silently when ownership could not be established.
      if (!disposed) onState("unavailable");
    }
  };
  void claim();
  return () => {
    disposed = true;
    release?.();
  };
}
