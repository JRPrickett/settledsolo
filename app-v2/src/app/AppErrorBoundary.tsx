import { Component, type ErrorInfo, type ReactNode } from "react";
import { createAppRepository } from "../data/repository";
import { downloadBackup } from "../data/export";

interface Props {
  children: ReactNode;
  /** Only the training app has saved data worth rescuing from the error screen. */
  offerBackup?: boolean;
}

type BackupStatus = "idle" | "working" | "done" | "empty" | "failed";

interface State {
  failed: boolean;
  backup: BackupStatus;
}

const BACKUP_MESSAGES: Record<Exclude<BackupStatus, "idle" | "working">, string> = {
  done: "Backup downloaded. Keep it somewhere safe, then reload the app.",
  empty: "No saved training was found on this device, so there is nothing to back up.",
  failed: "The saved training could not be read right now. Reload the app and try again from More."
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, backup: "idle" };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep private training data out of future remote error reporting.
    console.error("Application render error", error.name, info.componentStack);
  }

  private downloadSavedData = async () => {
    this.setState({ backup: "working" });
    try {
      // Read storage directly: the component tree that normally holds the data has failed.
      const data = await createAppRepository({ useWebLocks: false }).loadAppData();
      const hasTraining =
        Boolean(data.dogName) ||
        data.scenarios.some(
          (scenario) =>
            scenario.sessions.length > 0 ||
            (scenario.cuePractice?.sessions.length ?? 0) > 0
        );
      if (!hasTraining) {
        this.setState({ backup: "empty" });
        return;
      }
      downloadBackup(data);
      this.setState({ backup: "done" });
    } catch {
      this.setState({ backup: "failed" });
    }
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const { backup } = this.state;

    return (
      <main className="setup-shell">
        <section className="setup-card error-card" role="alert">
          <div className="brand-orbit" aria-hidden="true"><span /></div>
          <p className="kicker">Something went wrong</p>
          <h1>Your saved training data has not been intentionally cleared.</h1>
          <p className="lead">
            Reload the app to recover. If a session was in progress, the modern app
            will restore its saved timer state where possible.
          </p>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
          {this.props.offerBackup && (
            <>
              <button
                className="secondary-button error-backup-button"
                disabled={backup === "working"}
                onClick={() => void this.downloadSavedData()}
              >
                {backup === "working" ? "Preparing backup…" : "Download a backup first"}
              </button>
              {backup !== "idle" && backup !== "working" && (
                <p className="error-backup-status" aria-live="polite">
                  {BACKUP_MESSAGES[backup]}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    );
  }
}
