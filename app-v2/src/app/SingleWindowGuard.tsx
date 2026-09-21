import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "../brand/BrandMark";
import { claimAppWindow, type WindowOwnership } from "./windowOwnership";

export function SingleWindowGuard({ children }: { children: (compatibility: boolean) => ReactNode }) {
  const [state, setState] = useState<WindowOwnership>("checking");
  const [attempt, setAttempt] = useState(0);
  const [compatibility, setCompatibility] = useState(false);

  useEffect(() => {
    // Access can itself throw under browser privacy/security policies.
    let locks: LockManager | undefined;
    try { locks = navigator.locks; } catch { /* show explicit compatibility choice */ }
    return claimAppWindow(locks, setState);
  }, [attempt]);

  if (state === "active" || compatibility) return children(compatibility);

  return (
    <main className="setup-shell">
      <section className="setup-card" aria-live="polite">
        <BrandMark light />
        <p className="kicker">Your training log</p>
        {state === "checking" ? (
          <h1>Opening SettledSolo…</h1>
        ) : state === "waiting" ? (
          <>
            <h1>SettledSolo is open in another window.</h1>
            <p className="lead">Continue there, especially if a session is running. To use this window, close the other SettledSolo tab or window, then try again.</p>
            <p>This keeps two windows from changing the same training log or running the same timer.</p>
            <button className="primary-button" onClick={() => { setState("checking"); setAttempt(value => value + 1); }}>Try this window again</button>
          </>
        ) : (
          <>
            <h1>Use one SettledSolo window at a time.</h1>
            <p className="lead">This browser cannot check whether another window is using your training log. Close any other SettledSolo tabs or windows before continuing.</p>
            <button className="primary-button" onClick={() => setCompatibility(true)}>Continue in this window only</button>
          </>
        )}
      </section>
    </main>
  );
}
