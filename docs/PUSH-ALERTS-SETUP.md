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

Each deployed environment needs a stable P-256 VAPID key pair. The deploy script now provisions
this automatically and safely:

- after deploying the Worker it lists the target's existing secret names;
- if both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` already exist, it leaves them untouched;
- if either is absent, it creates a fresh pair in a mode-0600 temporary file, uploads both with
  `wrangler secret bulk`, and removes the temporary file;
- preview and production therefore receive separate key pairs automatically through their
  separate Worker deployments.

Do not rotate these casually: an existing browser subscription is restricted to the public key
it was created with. The client does detect a changed application-server key and can resubscribe,
but routine deployments should preserve the existing pair.

For recovery or inspection work, a pair can also be generated locally:

```bash
npm run push:keys
```

Never commit the private value. The public value is returned to the installed app from
`GET /api/push/config`.

If key provisioning or push delivery fails, the app continues with its normal local timer and
foreground chimes. Background alerts are supplementary.

## Deployment and test gate

The first deployment creates the `ReturnAlertScheduler` Durable Object namespace through the Wrangler migration and automatically provisions a stable VAPID pair for that Worker.

Before production use, verify on a physical iPhone Home Screen install:

- permission can be granted from the live-session prompt;
- starting a main departure while online schedules one return alert;
- switching to the camera app removes the fake media-player card;
- the native return notification arrives with sound near the target;
- keeping SettledSolo visible uses the in-app chime and the push notification is silent;
- returning early cancels the pending reminder;
- denied permission leaves the live timer usable;
- offline/network failure never blocks starting, returning from or saving a session.
