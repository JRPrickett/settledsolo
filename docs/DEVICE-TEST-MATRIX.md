# Production device and interruption test matrix

Last updated: 19 September 2026

Automated browser tests are necessary but are not evidence that an installed PWA behaves
identically on a real phone. This document is the manual release gate for live-session
reliability.

## Automated coverage

CI currently runs the core journey suite against:

- Chromium using a Pixel 7 device profile
- WebKit using an iPhone 15 device profile

Automated journeys include:

- onboarding -> session -> review -> history;
- reload during a running session and timestamp recovery;
- recovered review -> save exactly once, including a deliberate fast double-tap;
- notification denial without blocking training or immediately re-prompting;
- offline session completion;
- backup restore;
- departure-cue progression;
- legacy multi-scenario migration.

CI also builds the **production PWA** and runs a separate service-worker gate against
Chromium/Pixel 7 and WebKit/iPhone 15 profiles. Both profiles must prove the generated service
worker installs and controls the app. Chromium additionally simulates an Airplane Mode relaunch,
completes/saves a session while offline, restores connectivity and confirms the same local
history remains present.

Playwright WebKit currently throws an internal engine error when its offline-emulation mode is
combined with a reload. We therefore do **not** claim that WebKit CI proves an iOS offline
relaunch. The installed-iPhone Airplane Mode check remains a real-device release gate.

Playwright WebKit is **not** a substitute for Mobile Safari or an installed iOS Home Screen app.
The production-service-worker test proves the web/PWA code path, not iOS lifecycle behaviour.

## Supported product promise

The timer is based on original timestamps, not interval ticks. If rendering or browser execution
pauses, the displayed elapsed time should correct itself when execution resumes.

Foreground audio, wake lock and background Web Push are progressive enhancement.
The training record and timer state must remain correct even when all alert features fail.
The PWA no longer keeps a silent looping audio track alive or claims Media Session ownership
to simulate a Lock Screen timer.

## iPhone / iPad real-device gate

Test in current Safari and as an installed Home Screen web app.

### Installation and startup

- [ ] Open production/preview HTTPS URL in Safari.
- [ ] Add to Home Screen.
- [ ] Launch from the Home Screen icon.
- [ ] Confirm standalone layout and safe-area padding.
- [ ] Close and relaunch; local history remains present.

### Live timer

- [ ] Start a 30-second main departure.
- [ ] Confirm countdown begins from the correct timestamp.
- [x] Lock the phone, unlock, and confirm the active session survives with correct timer state.
- [x] Switch away to another app and return; the active session survives and resumes from timestamp-derived elapsed time.
- [ ] Switch Safari/PWA out of the foreground after the 5-second warning boundary and return.
- [ ] Leave the app backgrounded beyond the target, return, and confirm it shows target exceeded rather than restarting.

### Audio / Lock Screen

- [ ] Start the departure directly from a user tap and confirm no browser autoplay error.
- [ ] Verify warning and target chimes while the app remains foregrounded.
- [ ] Switch to another app during the departure and confirm SettledSolo does **not** appear
      as a fake audio player in Lock Screen / Control Centre.
- [ ] Keep SettledSolo visible through the target and confirm the foreground chime plays once.
- [ ] Confirm a simultaneous Web Push notification is silent while SettledSolo is visible.
- [ ] Confirm returning to the app does not create duplicate chimes.

Record the actual result; do not turn an inconsistent OS behaviour into a product guarantee.

### Notifications

On iOS/iPadOS, Web Push/system notification support is tied to Home Screen web apps and
permission must follow user interaction. The current PWA schedules one server-backed native
return alert for the **main departure target**. Foreground warning/target chimes stay local.

- [ ] Configure stable preview VAPID keys and deploy the `ReturnAlertScheduler` Durable Object.
- [ ] Tap Enable return alerts from an explicit user action.
- [ ] Confirm permission and background-alert readiness are accurately reflected.
- [ ] Start a 30-second main departure, switch to the camera app, and confirm one audible
      **Time to come back** notification arrives near the target.
- [ ] Return early and confirm the pending alert is cancelled.
- [ ] Keep SettledSolo visible through the target and confirm the notification is silent while
      the foreground target chime remains audible.
- [ ] Confirm denied permission does not affect the timer.
- [ ] Confirm no repeated permission prompt.
- [ ] Tap the notification and confirm it focuses/opens the installed app.
- [ ] Repeat with networking disabled and confirm push failure never blocks or resets training.

Web Push timing is a supplementary reminder, not the source of truth for the session clock.

### Recovery

- [x] Close the PWA during an active session.
- [x] Reopen it.
- [x] Confirm the active session survives/reconstructs rather than restarting.
- [ ] Complete/review/save the recovered session.
- [ ] Confirm exactly one history record exists.

### Offline

- [ ] Launch once online.
- [ ] Enable Airplane Mode.
- [ ] Relaunch the installed app.
- [ ] Start, complete and save a session.
- [ ] Restore connectivity.
- [ ] Confirm no local data was lost.

### PWA update safety

- [ ] Deploy a new preview build while an older build is installed.
- [ ] Start a live session on the old build.
- [ ] Confirm update does not force a reload.
- [ ] Complete/save the session.
- [ ] Accept Update now outside live mode.
- [ ] Confirm history remains intact.

### iPhone preview evidence — 18 September 2026

Tested against the Cloudflare `settledsolo-web-preview` build.

User-reported real-device results:

- active session survives switching to another app and returning;
- active session survives closing/reopening the PWA;
- active session survives lock/unlock;
- session chime is audible on the tested device.

This clears the core timer/recovery resilience concern that automated WebKit could not prove.

Still to verify on iOS before public release:

- Airplane Mode relaunch and full offline save;
- native Web Push permission/delivery/cancellation behaviour;
- PWA update while a live session is running;
- duplicate-chime behaviour across repeated/backgrounded sessions;
- confirmation that no fake Media Session/Control Centre player remains.

## Android real-device gate

Test current Chrome both in-browser and installed PWA.

Repeat:

- [ ] installation/standalone shell;
- [ ] camera-app switch during timer;
- [ ] screen lock/unlock;
- [ ] foreground target chime;
- [ ] background Web Push notification permission/delivery;
- [ ] confirm no fake lock-screen Media Session presentation;
- [ ] force-close/relaunch recovery;
- [ ] offline relaunch/session;
- [ ] safe prompted PWA update.

## Desktop sanity gate

At least one current Chromium browser and Safari where available:

- [ ] first run;
- [ ] session;
- [ ] history;
- [ ] backup export;
- [ ] backup restore;
- [ ] legacy restore;
- [ ] scenario switching.

## Release evidence

For each public release, record:

- device model;
- OS version;
- browser/PWA mode;
- release commit SHA;
- date;
- pass/fail for each relevant section;
- any OS/browser limitation discovered.

A release may ship with an alert limitation if the timer/recovery/data path is still reliable and
the limitation is clearly communicated. It must not ship with a known path that can silently lose
training history or restart an active timer.
