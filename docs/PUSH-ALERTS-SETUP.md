# Background return alerts setup

SettledSolo's installed PWA uses standards-based Web Push for the **main departure return point**. The live timer remains timestamp-derived and local; push delivery is a supplementary reminder only.

## Architecture

1. The user enables notifications from a direct gesture in the installed PWA.
2. The browser creates a Push API subscription using SettledSolo's VAPID public key.
3. When the main departure starts, the app sends only:
   - the browser push endpoint;
   - an anonymous installation ID;
   - an opaque session token;
   - the target return timestamp.
4. A Cloudflare Durable Object alarm wakes at the target time and sends an empty Web Push message.
5. The service worker displays a native **Time to come back** notification.
6. Returning early asks the scheduler to cancel the pending alarm.

Dog names, notes, outcomes, ratings and training history are not sent to the return-alert scheduler.

The push request has a 60-second TTL so a reminder is not useful indefinitely if the device is offline. Cloudflare alarms and push delivery are not a safety-critical or exact-to-the-millisecond clock; the in-app session state remains the source of truth.

## VAPID keys

Each deployed environment needs a stable P-256 VAPID key pair. Do not rotate these casually: an existing browser subscription is restricted to the public key it was created with.

Generate a pair locally:

```bash
npm run push:keys
```

Store both values as Worker secrets. Use separate pairs for preview and production.

Preview:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY --config wrangler.preview.jsonc
npx wrangler secret put VAPID_PRIVATE_KEY --config wrangler.preview.jsonc
```

Production:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY --config wrangler.app.jsonc
npx wrangler secret put VAPID_PRIVATE_KEY --config wrangler.app.jsonc
```

The private key must never be committed. The public key is returned to the installed app from `GET /api/push/config`.

If either key is missing, the push API fails closed and the app continues with its normal local timer and foreground chimes.

## Deployment and test gate

The first deployment creates the `ReturnAlertScheduler` Durable Object namespace through the Wrangler migration in both app configs.

Before production use, verify on a physical iPhone Home Screen install:

- permission can be granted from the live-session prompt;
- starting a main departure while online schedules one return alert;
- switching to the camera app removes the fake media-player card;
- the native return notification arrives with sound near the target;
- keeping SettledSolo visible uses the in-app chime and the push notification is silent;
- returning early cancels the pending reminder;
- denied permission leaves the live timer usable;
- offline/network failure never blocks starting, returning from or saving a session.
