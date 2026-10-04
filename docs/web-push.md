# FLYMPUS Web Push

FLYMPUS now has the browser/PWA side of standard Web Push wired for Android, desktop browsers and installed iPhone/iPad PWAs.

## What is already implemented

- `sw.js` receives background `push` events and shows operating-system notifications.
- Notification clicks focus an existing FLYMPUS window or open the PWA and can navigate to a screen/course.
- Settings → System notifications detects support, requests permission from a user action, registers the service worker, offers a device-level test notification and can unsubscribe the device.
- Existing bell preferences are included when subscriptions are synchronized to the delivery server.
- iPhone/iPad is handled explicitly: Web Push is enabled only from the Home Screen installed PWA.
- The same Push API path is used for Android and supported desktop browsers.

## Delivery-server contract

GitHub Pages cannot itself send a push while the app is closed. Configure a server in `push-config.json`:

```json
{
  "enabled": true,
  "apiBaseUrl": "https://YOUR-PUSH-SERVER.example",
  "vapidPublicKey": "YOUR_URL_SAFE_VAPID_PUBLIC_KEY"
}
```

The private VAPID key must exist only on the delivery server. Never commit it to this repository.

### POST /subscriptions

FLYMPUS sends JSON with:

- `subscription` — standard PushSubscription JSON
- `userId`, `userName`
- `courseCode`
- `preferences` — assignments, courseUpdates, evaluations, checks, requiredActions
- `language`, `timezone`, `userAgent`, `standalone`
- `updatedAt`

The server should upsert by `subscription.endpoint`.

### DELETE /subscriptions

Same payload. Remove the matching endpoint.

### Push payload expected by sw.js

```json
{
  "title": "FLYMPUS",
  "body": "Evaluation requires your attention",
  "tag": "evaluation:t1:123",
  "data": {
    "screen": "record",
    "courseCode": "AEP-26"
  }
}
```

A click will navigate to the target screen/course.

## Device testing before the backend is connected

Settings → System notifications → Enable grants OS permission and registers the service worker. “Send test” uses the service worker registration to display a real system notification on that device. This validates the PWA/OS notification path, but it is not a remote background push.

## Next infrastructure step

Deploy a small Web Push delivery service with persistent subscription storage and VAPID keys, then fill `push-config.json`. The front end does not need an OS-specific implementation after that.
