# SettledSolo agent instructions

This file defines the working rules for agents and contributors in this repository. Read this file and `docs/HANDOVER.md` before making changes.

## 1. Source of truth

For current project status, use this order:

1. `docs/HANDOVER.md` — current state, recent changes, active priorities and known gaps.
2. The current `main` branch and open pull requests.
3. `docs/EVIDENCE-BASE.md` and `docs/DEVICE-TEST-MATRIX.md` for behavioural/release constraints.
4. Planning documents such as `docs/PRODUCT-PLAN.md`, `docs/NEXT-PHASE.md`, `docs/SA-QUALITY-ROADMAP.md` and `docs/ACCOUNT-SYNC.md`.

Older planning documents may contain completed or superseded steps. Never assume a numbered phase or old PR reference is still current without checking GitHub.

## 2. Repository map

- `app-v2/` — modern React 19 + TypeScript + Vite SettledSolo PWA. This is the active product code.
- `worker/` — Cloudflare Worker serving the modern static build and applying security/caching/noindex rules.
- `wrangler.app.jsonc` — production Worker configuration (`settledsolo-web`).
- `wrangler.preview.jsonc` — preview Worker configuration (`settledsolo-web-preview`).
- `migrations/accounts/` and `scripts/account*` — account D1 migrations and the provisioning, preflight, deployment and endpoint-verification tooling. See `docs/ACCOUNTS-DEPLOYMENT.md`.
- `cloudflare-worker/` — separate privacy-limited analytics event Worker/database.
- root `js/`, `css/`, `tests/`, legacy PWA files — retained for regression and migration compatibility. Do not remove or casually rewrite them.
- `docs/` — product, evidence, release, account/sync and handover documentation.

The product and repository are now named **SettledSolo**. Legacy storage keys and migration identifiers may still use Threshold/dog-training names where changing them would risk existing user data.

## 3. Product rules

SettledSolo is an offline-first training and record-keeping aid for dog separation-related training.

Non-negotiable product behaviour:

- The app must be useful before signup. Do not add a first-run login wall.
- Local storage remains the immediate source for the live app. Network availability must never block starting, completing or saving a training session.
- A target duration is a **ceiling, not a quota**. UI copy must not pressure a user to continue while the dog is concerned.
- Never add a "test the maximum your dog can tolerate" flow.
- Preserve existing training history and stable IDs unless the user explicitly chooses a destructive action.
- Reset/destructive actions must be explicit, difficult to trigger accidentally and clear about what will be deleted.
- Do not turn milestones, streaks or engagement features into pressure to train through distress.
- Core training, history, export and local use should remain genuinely useful for free.

## 4. Evidence and dog-welfare rules

Behavioural recommendations should follow evidence-backed principles where possible.

Before changing training logic or behavioural copy:

- Read `docs/EVIDENCE-BASE.md`.
- Prefer systematic desensitisation / gradual below-distress exposure and direct observation.
- Clearly distinguish an evidence-supported principle from a SettledSolo product heuristic.
- Do not present an exact software increment, duration or readiness threshold as clinically validated unless the evidence supports that exact value.
- Current examples of **product heuristics**, not clinical rules:
  - the 3-second unknown-duration starting observation;
  - the exact progression step sizes;
  - requiring repeated relaxed final-doorway cue practice before the first timed departure.
- Encourage camera/video observation where practical, but do not make a camera mandatory.
- Do not diagnose separation anxiety.
- Do not prescribe medication. Referral wording may suggest discussing persistent/severe cases with a vet or appropriately qualified behaviour professional.
- Repeated or strong distress should make the plan easier, stop the session, or surface support guidance — never increase difficulty.

Substantive behaviour/protocol changes should remain subject to the qualified behaviour-professional review release gate.

## 5. Data and privacy rules

Training data is private user data.

- Do not send dog names, scenario names, notes, outcomes, ratings, planned/actual durations or training history to product analytics.
- The analytics Worker is separate from future account/private-data storage.
- Current product analytics are limited to `app_open`, `session_started` and `session_saved` plus basic platform/app metadata.
- Do not call raw event counts "users".
- Registered account count can become an exact user/member metric once accounts exist.
- If anonymous guest/installation counting is added, use a privacy-conscious random installation identifier, document it in privacy copy, and keep it separate from training content.
- Never log request bodies containing private training/account content.
- Export and restore must remain available. Future account deletion/export controls are release requirements.

## 6. GitHub workflow

For normal development:

1. Check current `main`, recent merged PRs, open PRs and CI before editing.
2. Create a focused branch from current `main`.
3. Keep PRs small enough to review and recover independently.
4. Do not bypass a failing CI check to get a feature merged.
5. Do not push feature work directly to `main` unless the user explicitly directs that workflow.
6. Preserve unrelated user changes.
7. Document meaningful behavioural, data-model, deployment or product changes.

Before calling a PR ready:

```bash
npm install --ignore-scripts
npm run verify
npm run test:e2e
npm run test:pwa
```

CI runs `npm run verify` first, then the normal Playwright suite against Chromium/Pixel 7 and WebKit/iPhone 15 profiles, followed by `npm run test:pwa` against the production build/service worker. The production PWA gate proves service-worker control in both engines and the full offline relaunch/save/reconnect cycle in Chromium; real installed-iOS offline lifecycle behaviour remains a physical-device gate.

Automated WebKit is not proof of installed iOS PWA behaviour. Changes affecting timers, notifications, audio, offline behaviour, install flows, safe areas or app lifecycle may also require the real-device gates in `docs/DEVICE-TEST-MATRIX.md`.

## 7. Mobile and accessibility rules

SettledSolo is mobile-first.

- Text/number inputs, selects and textareas must compute to **at least 16px on mobile/touch layouts** to prevent iOS Safari focus zoom.
- Do not solve iOS focus zoom with `maximum-scale=1` or by disabling pinch zoom.
- Preserve iPhone safe-area handling.
- Test narrow layouts; do not assume desktop screenshots prove mobile fit.
- Maintain visible keyboard focus and accessible names.
- Respect `prefers-reduced-motion`.
- Do not rely on colour alone to communicate training state.
- Avoid CTA/text overflow at small viewport widths.

## 8. Live-session resilience rules

The live session is the highest-risk product path.

- The clock is timestamp-derived; interval ticks are presentation only.
- Switching apps, locking the screen, browser suspension or reload must not reset elapsed time.
- Persist active-session state sufficiently to reconstruct safely after interruption.
- Saving after recovery must create exactly one history record.
- Audio, Media Session and notifications are progressive enhancements. Training state must remain correct when they fail.
- A service-worker/PWA update must never force-reload an active session.
- Do not add background behaviour that can duplicate chimes/notifications without tests.

## 9. Cloudflare and deployment rules

The modern app is built to `dist-v2` and served by `worker/index.ts`.

- Production Worker: `settledsolo-web`.
- Preview Worker: `settledsolo-web-preview`.
- Production canonical URL in config: `https://settledsolo.com`.
- Production deployment is a manual GitHub Actions workflow dispatch from `main`.
- Preview and production must never share future account D1 databases.
- Do not overwrite or merge the separate analytics Worker/database into the app Worker.
- Preserve CSP/security headers and the noindex rule for preview/app routes unless there is a deliberate SEO/security change.
- Prefer GitHub + Cloudflare deployment. Do not move this product to ChatGPT Sites, Wix or WordPress.

## 10. Accounts, D1 and sync rules

Accounts/sync are implemented on the account branch but remain disabled until deployment
configuration and release evidence are complete. See `docs/ACCOUNTS-DEPLOYMENT.md`.

When extending that work:

- Keep guest/local mode as the default.
- Use separate preview and production account D1 databases.
- Keep account/private training data separate from analytics.
- Better Auth + email OTP is the planned first auth path; optional passkeys may follow successful sign-in.
- Use same-origin routes under `/api/auth/*`, `/api/sync/*`, `/api/account/export`, `/api/account/delete`.
- UI writes locally first. Sync is asynchronous.
- Use stable IDs, an outbox, idempotent remote writes and tombstones for deletes.
- Conflicts must be recoverable; never silently discard a user's training record.
- Do not add sharding, queues, Durable Objects or extra caching layers without usage evidence that they are needed.

See `docs/ACCOUNT-SYNC.md` before implementing account work.

## 11. Documentation discipline

At the end of a substantial PR, update `docs/HANDOVER.md` when the change affects:

- current phase/status;
- architecture;
- deployment;
- data model/storage;
- training behaviour;
- known issues;
- open release gates;
- the recommended next task.

The handover should say what is **actually merged**, what is still a proposal, and what is currently open. Do not leave another agent to reconstruct state from chat history.

## 12. Definition of done

A change is not done merely because the UI looks correct.

For relevant changes, done means:

- TypeScript/build/unit checks pass.
- Browser journeys pass.
- Mobile layout is considered.
- Offline/local-data safety is preserved.
- Accessibility is not knowingly degraded.
- Behavioural claims remain evidence-aware.
- Analytics/privacy boundaries remain intact.
- Docs/handover are updated when project state materially changed.
