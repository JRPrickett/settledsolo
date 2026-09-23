import { useState } from "react";
import { conflictTitle, describeSyncValue } from "./conflictSummary";
import type { AppData } from "../domain/types";
import type { AccountController } from "./useAccount";
import { accountRequest, downloadAccountFile } from "./client";
export function AccountPanel({
  data,
  account,
}: {
  data: AppData;
  account: AccountController;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  async function action(task: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const sync = data.sync;
  const owned = !sync || sync.deleted || sync.accountId === account.user?.id;
  const count = data.scenarios.reduce(
    (sum, track) => sum + track.sessions.length,
    0,
  );
  const cues = data.scenarios.reduce(
    (sum, track) => sum + (track.cuePractice?.sessions.length ?? 0),
    0,
  );
  return (
    <section
      className="settings-card account-panel"
      aria-labelledby="account-heading"
    >
      <div className="section-heading">
        <p className="kicker">Optional account</p>
        <h2 id="account-heading">Account & backup</h2>
      </div>
      <p>
        Training works without an account. Connect when you want to keep your
        log across devices.
      </p>
      {!account.ready && (
        <p role="status">Checking your account status…</p>
      )}
      {account.ready && account.available !== true && (
        <>
          <p role="status">
            {account.available === false
              ? "Account setup is not available yet. You can continue training and download a backup below."
              : "Account service could not be reached. Your local training still works."}
          </p>
          <button disabled={busy} onClick={() => void action(account.refresh)}>
            Check connection
          </button>
        </>
      )}
      {account.ready && account.available === true && !account.user && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              if (!sent) {
                await accountRequest(
                  "/api/auth/email-otp/send-verification-otp",
                  { email: email.trim(), type: "sign-in" },
                );
                setSent(true);
              } else {
                await accountRequest("/api/auth/sign-in/email-otp", {
                  email: email.trim(),
                  otp: code,
                });
                await account.refresh();
                setCode("");
                setSent(false);
              }
            });
          }}
        >
          <div className="account-auth-summary">
            <h3>Sign in or create a free account</h3>
            <p>
              <strong>No password needed.</strong> We&apos;ll email you a
              one-time 6-digit code. If your email is new, entering the code
              creates your account; otherwise it signs you in. There is no
              SettledSolo password to remember or for us to store.
            </p>
            <p>
              You&apos;ll stay signed in on this device until you sign out or
              your session expires. A new device or browser needs its own code.
            </p>
          </div>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={busy || sent}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {sent && (
            <>
              <p>
                A one-time 6-digit code has been sent to {email}. It expires
                in five minutes. Check your junk or spam folder if it does not
                arrive.
              </p>
              <label>
                Sign-in code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
            </>
          )}
          <button type="submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : sent
                ? "Sign in or create account"
                : "Email me a code"}
          </button>
          {sent && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Use another email or request a new code
            </button>
          )}
          <p>
            We use your email to sign you in. Training history is only uploaded
            after you choose to connect it.{" "}
            <a href="/privacy">Privacy details</a>
          </p>
        </form>
      )}
      {account.user && (
        <>
          <p>
            Signed in as <strong>{account.user.email}</strong>
          </p>
          <p className="account-session-status">
            Passwordless email account · signed in on this device
          </p>
          {!owned ? (
            <p role="status">
              This device’s log belongs to another account. Sign back into that
              account, or download a backup and use the local reset before
              connecting a different account.
            </p>
          ) : !sync?.enabled ? (
            <div className="account-import">
              <h3>
                {data.dogName
                  ? "Connect this training log?"
                  : "Restore your account’s log?"}
              </h3>
              {data.dogName && (
                <p>
                  {data.dogName} · {data.scenarios.length} training tracks ·{" "}
                  {count} sessions · {cues} cue-practice records
                </p>
              )}
              <p>
                {data.dogName
                  ? "This uploads the log shown above and brings in your saved account history. Conflicting edits are kept for you to review."
                  : "This downloads your saved training history onto this device."}
              </p>
              <button
                disabled={busy || account.syncing}
                onClick={() => void action(account.connect)}
              >
                {data.dogName
                  ? "Connect and upload this log"
                  : "Restore from my account"}
              </button>
            </div>
          ) : (
            <>
              <p role="status">
                {account.syncing
                  ? "Syncing…"
                  : sync.conflicts.length
                    ? sync.conflicts.length === 1
                      ? "1 change needs your review."
                      : `${sync.conflicts.length} changes need your review.`
                    : sync.outbox.length
                      ? sync.outbox.length === 1
                        ? "1 change waiting to sync."
                        : `${sync.outbox.length} changes waiting to sync.`
                      : sync.lastSyncAt
                        ? `Last synced ${new Date(sync.lastSyncAt).toLocaleString()}`
                        : "Ready to sync."}
              </p>
              <button
                disabled={busy || account.syncing}
                onClick={() => void action(() => account.syncNow(true))}
              >
                Sync now
              </button>
              {sync.conflicts.map((conflict) => (
                <div className="account-conflict" key={conflict.key}>
                  <h3>{conflictTitle(conflict.local, conflict.remote.value)}</h3>
                  <p>
                    This changed on this device and on another device before they
                    could sync. Choose which version to keep.
                  </p>
                  <div className="conflict-versions">
                    <section aria-label="This device’s version">
                      <h4>This device</h4>
                      <ul>
                        {describeSyncValue(conflict.local).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                    <section aria-label="Cloud version">
                      <h4>Cloud</h4>
                      <ul>
                        {describeSyncValue(conflict.remote.value).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  </div>
                  <p>
                    Both versions are retained in the conflict archive after you
                    choose.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(() => account.resolve(conflict.key, "local"))
                    }
                  >
                    Keep this device’s version
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(() => account.resolve(conflict.key, "cloud"))
                    }
                  >
                    Use cloud version
                  </button>
                </div>
              ))}
            </>
          )}
          <div className="account-actions">
            <button
              disabled={busy}
              onClick={() =>
                void action(async () =>
                  downloadAccountFile(
                    await accountRequest(
                      `/api/account/export?accountId=${encodeURIComponent(account.user!.id)}`,
                    ),
                    "settledsolo-account.json",
                  ),
                )
              }
            >
              Export cloud data
            </button>
            <button
              disabled={busy}
              onClick={() => void action(account.signOut)}
            >
              Sign out
            </button>
            <button disabled={busy} onClick={() => setDeleting(!deleting)}>
              Delete cloud account…
            </button>
          </div>
          <p>
            Signing out keeps this device’s log and any unsynced changes. It
            does not delete cloud history.
          </p>
          {deleting && (
            <div className="account-conflict">
              <h3>Permanently delete your cloud account?</h3>
              <p>
                Your account and cloud history will be deleted. This device’s
                local log remains. Export a copy first. You may need a fresh
                sign-in code.
              </p>
              <label>
                Type DELETE
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                disabled={busy || confirmation !== "DELETE"}
                onClick={() =>
                  void action(async () => {
                    await accountRequest("/api/account/delete", {
                      confirmation,
                      accountId: account.user!.id,
                    });
                    await account.deleted();
                    setDeleting(false);
                    setConfirmation("");
                  })
                }
              >
                Permanently delete cloud account
              </button>
              <button disabled={busy} onClick={() => setDeleting(false)}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}
      {Boolean(sync?.archive.length) && (
        <button
          onClick={() =>
            downloadAccountFile(
              sync!.archive,
              "settledsolo-conflict-archive.json",
            )
          }
        >
          Download conflict archive
        </button>
      )}
      {(message || account.error) && (
        <p role="alert">{message || account.error}</p>
      )}
    </section>
  );
}
