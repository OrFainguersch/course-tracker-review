# FLYMPUS authentication setup

The repository now contains a dormant authentication layer for Google and Microsoft accounts. Production enforcement is intentionally **off** until Firebase is connected and the existing device-local training data is migrated/scoped by authenticated UID.

## Cost boundary

Keep the Firebase project on the **Spark** plan. Do not attach a billing account. This implementation does not use Cloud Functions, Identity Platform paid features, mailbox APIs, Google Drive APIs, Microsoft Graph mail/calendar scopes, or any server secret in the repository.

## Current files

- `firebase-config.js` — public Firebase web identifiers only. It is disabled by default.
- `auth.js` — Google/Microsoft Firebase Authentication client and pending/active user gate.
- `auth.css` — login/pending/error UI.
- `firestore.rules` — USER/ADMIN bootstrap rules for `users/{uid}`.
- `?authPreview=1` — displays the login UI without connecting to Firebase.

## Firebase console steps required before activation

1. Create a Firebase project on Spark and register a Web app.
2. Create a Cloud Firestore database.
3. Enable Authentication > Google.
4. Register a Microsoft Entra application, then enable Authentication > Microsoft in Firebase. The Microsoft client secret belongs **only in Firebase Console**, never in this repository.
5. Add `orfainguersch.github.io` as a Firebase Authentication Authorized domain for the current GitHub Pages deployment.
6. Copy the Firebase Web configuration into `firebase-config.js`.
7. Deploy `firestore.rules`.
8. Set `enabled:true`, but keep `enforceAuth:false` while validating sign-in.
9. Sign in once with the intended administrator account. A `users/{uid}` document is created with `role:user`, `status:pending`.
10. In Firestore Console, bootstrap that one account by changing it to `role:admin`, `status:active`.
11. Build the Admin > User Management UI so future approvals happen inside FLYMPUS.
12. Scope/migrate course data by UID and membership. Only after that set `enforceAuth:true`.

## Roles

Application role:
- `user`
- `admin`

Account status:
- `pending`
- `active`
- `blocked`

Course roles remain separate:
- Trainee
- Instructor
- Course Manager

The client UI may hide/show features based on the application role, but Firestore Security Rules remain the security boundary.

## Why popup sign-in is used

The site is hosted by GitHub Pages, not Firebase Hosting. Firebase redirect authentication depends on cross-origin auth helpers and can fail in browsers that block third-party storage unless the helpers are proxied/self-hosted. The current foundation therefore uses `signInWithPopup()` for both Google and Microsoft. We can revisit a self-hosted redirect helper after the Firebase project exists if iOS PWA testing shows that it is needed.
