# Local-window safety

## Policy

Use one writable SettledSolo app window per origin/browser storage context. Guest
and connected use follow the same rule. The app acquires an exclusive Web Lock
named `settledsolo-app-window` before mounting any repository, sync, onboarding or
live-session code. Public information pages do not acquire it.

A second window shows a clear explanation and **Try this window again**. It does
not load the local log, send account requests, run a recovered timer, or expose
settings/reset. The owner keeps working even when backgrounded. To hand over,
close the owner or navigate it out of the app, then retry in the other window.
The browser releases ownership on document destruction; the next owner mounts a
fresh app, reads current storage and recovers an existing checkpoint normally.

Do not expire ownership using wall-clock time or heartbeat silence. Mobile
suspension is not evidence that the original window has stopped owning its timer.
Do not provide a force-takeover button.

## Compatibility and limits

- Missing or denied Web Locks produces an explicit **Continue in this window only**
  choice. The user must close other app windows. Local writes remain serialized
  within that instance, but automatic exclusion is unavailable. Repository Web
  Locks are skipped in that explicitly chosen mode so a denied API cannot strand
  local onboarding/training.
- Coordination is limited to the browser storage context. Separate browsers,
  partitioned installed-app storage and separate devices still need the existing
  account sync revisions, idempotence, conflict archive and server identity checks.
- Already-open builds from before this guard do not participate. When validating
  the first rollout, finish/save sessions and close old app windows first.
- Memory-only changes cannot be recovered after closing a page; the existing
  storage recovery warning/backup flow still applies.
- This change does not reconcile divergent persistent stores, change cloud data,
  or establish real-device notification/update reliability.

## Evidence

Unit tests cover lock lifetime, contention, pending-request disposal, Strict Mode
cleanup, and missing/denied APIs. Mobile Chromium/WebKit journeys cover a blocked
second window without account requests, handover to the latest saved log,
back-navigation safety, recovered timer timestamps and exactly one saved session.
Compatibility journeys prove onboarding can still save with missing/denied locks.
Run the normal PWA gate too because startup now depends on local ownership.

For installed iOS and Android, record in DEVICE-TEST-MATRIX.md:

1. Keep a session running, switch apps and lock/unlock. Ownership and timer survive.
2. Open another app window in the same storage context. It cannot start another timer.
3. Close the original after its checkpoint is saved; retry and save once in the new window.
4. Navigate away/back and reload repeatedly. No permanent waiting screen or duplicate session.
5. Relaunch offline; local locking and training remain usable without a server.

The mechanism follows the [Web Locks standard](https://www.w3.org/TR/web-locks/).
No training/account content is included in the lock name or coordination traffic.
