# Account and sync architecture

## Implementation status — account branch, 19 September 2026

`feat/accounts-sync` implements email OTP, account controls, explicit guest import and
local-first incremental sync. It is not deployed or activated. See `ACCOUNTS-DEPLOYMENT.md`
for activation inputs and `ACCOUNTS-REVIEW.md` for review evidence and remaining gates.

The implementation uses generated Better Auth tables plus `sync_records` and an append-only
`sync_changes` log. Typed payloads represent dog profile, track, timed session and cue-session
entities. This replaces the separate entity-table proposal below for the first release.
Server revisions are monotonic D1 sequence numbers, not client clocks. Each mutation has
a stable retry ID and expected base revision; stale writes return recoverable conflicts.

The browser stores sync ownership, cursor, shadow, remote records, durable outbox and
conflict archive with its existing local app record. Local mutations and merges are serialized.
Live-session checkpoints are not synced. Signup and import remain separate actions.
API routes are same-origin and no-store; private records never enter analytics.

Email OTP is the first supported path. Passkeys remain deferred. Account endpoints remain
disabled without complete configuration; preview and production D1 IDs must differ.

## Original design rationale


## Goal

Add optional free accounts without making signup a prerequisite for using the training
app.

The existing local-storage model is an asset: it provides instant startup, offline use and
a safe guest mode. Production accounts should extend it rather than replace it.

## User states

### Guest

- No account required.
- Full core app works locally.
- Clear status: progress is saved on this device.
- Backup/export remains available.

### Signed in

- Local cache remains the immediate working copy.
- Changes are synced to the authenticated API.
- Account status confirms the last successful sync.
- The user can sign out without deleting cloud data.
- The user can explicitly remove local account data from that device.

## Signup conversion

Do not show a login wall on first open.

After the user has meaningful progress, surface:

> **Your progress is currently saved on this device.**
> Create a free account to back it up and use SettledSolo on your other devices.

When an existing guest creates an account, ask before uploading the current local log and
show the number of scenarios/sessions that will be attached to the account.

## Proposed data model

### users

- id
- email / auth subject
- created_at
- deleted_at

### dogs

- id
- user_id
- name
- created_at
- updated_at

Design for multiple dogs even if the first free UI exposes one.

### scenarios

- id
- dog_id
- label
- start_seconds
- warmups
- rest_seconds
- mode
- door_level
- created_at
- updated_at
- deleted_at

### sessions

- id
- scenario_id
- occurred_at
- kind
- target_seconds
- actual_seconds
- base_seconds
- outcome
- stopped
- stop_reason
- tags_json
- note
- created_at
- updated_at
- deleted_at

### preferences

- user_id
- daily_cap
- sound_off
- updated_at

## IDs and migration

The browser already creates stable scenario/session IDs. Preserve those during account
import where possible so the first sync does not create duplicates.

Add a local schema migration that introduces sync metadata separately from the training
record:

- local revision / updated_at
- last successful sync
- authenticated account id
- tombstones for deletes until acknowledged by the server

## Sync rules

- The UI always writes locally first.
- Sync is asynchronous and must not block a training session.
- Session creation should be idempotent by stable ID.
- Deletes use tombstones until the server confirms them.
- Server authorization is derived from the authenticated user; never trust user_id sent
  by the browser.
- Conflicts in append-only session history should normally merge.
- Settings/scenario edits use updated timestamps/revisions and surface a recoverable
  conflict instead of silently discarding data.

## Privacy boundaries

**Analytics database:** aggregate product events only.

**Account database:** private user-owned training data required to provide sync.

Do not send notes, dog names or training history to analytics.

## Required account controls

Before public account launch:

- email/account recovery;
- export all account data;
- delete account and cloud records;
- privacy notice describing storage and subprocessors;
- rate limiting;
- authenticated authorization tests;
- CSRF/origin protection appropriate to the auth design;
- audit of logs to ensure request bodies and notes are not captured accidentally.

## Selected account direction

Use **Better Auth** in the SettledSolo Worker with a dedicated Cloudflare D1 binding.

Current Better Auth supports Cloudflare D1 directly, so auth does not need an ORM solely for
database compatibility.

### Sign-in UX

Recommended first release:

1. Email one-time passcode (OTP) for signup/sign-in/recovery.
2. Offer passkey registration after the first successful sign-in on supported devices.
3. Keep password login out of the first release unless real-user feedback creates a reason to add it.

OTP is preferred over a magic-link-first flow for the installed PWA because the user can stay in
the PWA and enter the code rather than depending on an email link reopening the desired browser/app
context.

### Worker/database layout

Keep account/private training data separate from aggregate analytics:

- `settledsolo-web-preview` -> preview auth/sync API + preview D1;
- `settledsolo` -> production auth/sync API + production D1;
- analytics/events remains a separate Worker/database.

Use same-origin routes:

- `/api/auth/*`
- `/api/sync/*`
- `/api/account/export`
- `/api/account/delete`

This avoids introducing a separate API origin for core account flows.

### Environment separation

Never bind preview to the production account database.

Create separate D1 databases for preview and production so auth testing, migrations and destructive
account-deletion tests cannot contaminate real user data.

### Delivery order

1. D1 schema + Better Auth server foundation.
2. OTP sign-in/sign-out/session endpoint.
3. Optional passkey registration and sign-in.
4. Account status UI with no signup wall.
5. Explicit guest-history import preview.
6. Local-first sync metadata/outbox and idempotent server writes.
7. Multi-device reconciliation tests.
8. Export/delete/recovery controls.
9. Privacy/subprocessor documentation and abuse/rate-limit review.

## Scaling to ~500 accounts

The design above was already right-sized for this. Numbers below are current published
Cloudflare limits (checked September 2026), not estimates, so the plan can be judged
against them rather than against a general "will D1 scale" worry.

### The actual load at 500 users

Assume a generous active cohort: 30% of 500 users (150) opens the app most days, and a
smaller slice trains daily.

- **Writes.** A logged session is a handful of row writes (the session row, an
  updated_at touch on its scenario, a sync-ack). Even 150 sessions/day is ~750 row
  writes/day. Auth (OTP requests, session rows) adds a few hundred more. Total: **low
  thousands of row writes/day**, against a free-tier allowance of **100,000/day** and a
  paid-tier allowance of **50 million/month**. This is roughly 1-2 orders of magnitude
  of headroom before it's worth a second thought.
- **Reads.** The risk here isn't the row count, it's the *pattern*. A naive "re-fetch
  everything on every open" sync would push real row counts (a season of history for
  active users), and at enough opens/day that adds up. The design already avoids this —
  sync is specified as incremental, keyed on `updated_at`/revision and last-synced
  cursor, not a full resync. With that in place, a normal open reads only what changed
  since last sync (usually zero to a handful of rows). Free tier is **5 million rows
  read/day**; this stays a rounding error of that even generously modelled.
- **Storage.** 500 users x a genuinely heavy year of history (hundreds of sessions
  each, notes and tags included) is tens of megabytes, not gigabytes. Free tier is
  **5 GB**. No storage-driven upgrade is plausible at this scale.
- **Worker requests.** `worker/index.ts` runs every request through the Worker
  (`run_worker_first: true`) for the security headers, and HTML responses are
  explicitly `no-cache`, so every navigation and every auth/sync call counts against
  the Workers request budget — cached JS/CSS/font assets mostly don't, once a device
  has them. Modelled generously (three app opens/day per active user, each worth a
  handful of Worker-hitting requests), 500 users lands around **1,500-2,500 Worker
  requests/day**, against a free-tier cap of **100,000/day**. Reaching that free cap
  would take roughly a 20-40x bigger active user base than this plan is for.

### The one limit worth planning around

Not row counts — the free plan's **10ms CPU time per invocation**. That's CPU time, not
wall-clock, but OTP verification, WebAuthn/passkey signature checks and JSON-serializing
a sync payload are exactly the kind of work that can bump into a 10ms ceiling under real
load even though it looks fine in local testing. **Budget for Workers Paid ($5/month
minimum) once account writes go live** — not because 500 users will exceed the free
plan's volume (they won't, by a wide margin), but because Paid removes the daily request
cap and raises CPU time to 30s default / 5 minutes max, which removes an entire class of
"worked in testing, intermittently times out in production" bug reports for a cost that
rounds to noise. At 500 accounts, realistic total Cloudflare spend on this design is
**~$5/month** (D1 usage stays inside what Workers Paid already includes).

### What this plan should explicitly *not* add at this scale

Sharding, read replicas, a message queue, Durable Objects for real-time sync, or a
separate caching layer in front of the API. None of it is warranted for 500 accounts,
all of it is extra surface to operate and secure, and the existing single-Worker/
single-D1-database design already has 1-2 orders of magnitude of headroom on every
number above. Revisit only if usage data says otherwise, not preemptively.

### Filling in the remaining mechanics

Two things the plan above names but doesn't yet pin down precisely enough to build
against:

**The sync wire protocol.** A single endpoint following the pull-since-cursor /
push-outbox pattern the rules section already implies:

```
POST /api/sync
  { cursor, operations: [{ id: "mutation UUID", key, value, base: expectedRevision }, ...] }
  ->
  { accepted: [...], conflicts: [...], changes: [...], cursor, hasMore }
```

This maps directly onto the repository methods already built for the local-first store
(`appendSession`/`updateSession`/`deleteSession`/`updateScenario`, etc.) — each already
has clear create/update/delete semantics and stable IDs, which is most of the hard part
of an outbox already done on the client side.

**Rate limiting.** Use Cloudflare's dashboard-configured Rate Limiting rules on
`/api/auth/*` (specifically the OTP-request endpoint — email-bombing is the realistic
abuse vector at this scale) alongside the implemented native Worker rate limiter and Better Auth database-backed
limits. The latter remain effective across Worker instances; edge rules add protection
against distributed email abuse.

**Migrations and backups**, for completeness: use `wrangler d1 migrations` (wire a
`migrate:preview` / `migrate:production` script into CI rather than applying schema
changes by hand), and rely on D1's built-in point-in-time recovery rather than building
a custom backup/export cron — both are already-solved problems at this scale, not
something this project needs to build.
