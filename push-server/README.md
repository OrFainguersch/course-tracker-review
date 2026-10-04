# FLYMPUS Push Server

Reference delivery server for the Web Push client in the main FLYMPUS PWA.

## Environment

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — for example `mailto:you@example.com`
- `ADMIN_TOKEN` — required for `POST /send`
- `ALLOWED_ORIGINS` — comma-separated browser origins
- `SUBSCRIPTIONS_FILE` — optional persistent JSON file path
- `PORT`

Generate a VAPID pair with:

```bash
npm install
npm run generate-vapid
```

Keep the private key and admin token only in server environment secrets.

## Run

```bash
npm install
npm start
```

The host must provide persistent storage for `SUBSCRIPTIONS_FILE` or replace the tiny JSON-store helpers in `server.mjs` with a database.

## Connect the PWA

Set `push-config.json`:

```json
{
  "enabled": true,
  "apiBaseUrl": "https://YOUR-PUSH-SERVER.example",
  "vapidPublicKey": "YOUR_PUBLIC_VAPID_KEY"
}
```

## Send

```bash
curl -X POST https://YOUR-PUSH-SERVER.example/send \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"requiredActions",
    "courseCode":"AEP-26",
    "title":"FLYMPUS",
    "body":"A required action needs your attention",
    "screen":"record"
  }'
```

`type` can match an existing bell preference: `assignments`, `courseUpdates`, `evaluations`, `checks`, or `requiredActions`. Devices with that category disabled are skipped.

This is standard Web Push, so the same delivery service can target Android, supported desktop browsers, and installed iPhone/iPad PWAs.
