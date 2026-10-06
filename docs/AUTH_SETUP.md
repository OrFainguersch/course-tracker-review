# FLYMPUS authentication setup

The repository contains enforced Google Firebase Authentication, Firestore-backed account approval, tiered application roles, an Owner/Admin User Management screen, and UID-scoped browser persistence. Microsoft Authentication remains staged and hidden until its Entra registration is completed.

## Cost boundary

Keep the Firebase project on the **Spark** plan. Do not attach a billing account. This implementation does not use Cloud Functions, Identity Platform paid features, mailbox APIs, Google Drive APIs, Microsoft Graph mail/calendar scopes, or any server secret in the repository.

## Current files

- `firebase-config.js` — public Firebase web identifiers and independent enforcement/provider feature flags.
- `auth.js` — Google/Microsoft Firebase Authentication client and pending/active user gate.
- `auth.css` — login/pending/error UI.
- `firestore.rules` — Owner/Administrator/Training Manager/User account rules for `users/{uid}`, invitations, and protected ownership bootstrap.
- `storage-scope.js` — UID isolation and one-time first-admin legacy migration.
- `docs/AUTH_DATA_MIGRATION.md` — persistence classification and migration boundary.
- `?authPreview=1` — displays the login UI without connecting to Firebase.

## Firebase console steps required before activation

1. Create a Firebase project on Spark and register a Web app.
2. Create a Cloud Firestore database.
3. Enable Authentication > Google.
4. Optional/later: register a Microsoft Entra application, then enable Authentication > Microsoft in Firebase. The Microsoft client secret belongs **only in Firebase Console**, never in this repository. Set `microsoftEnabled:true` only after that setup is verified.
5. Add `orfainguersch.github.io` as a Firebase Authentication Authorized domain for the current GitHub Pages deployment.
6. Copy the Firebase Web configuration into `firebase-config.js`.
7. Deploy `firestore.rules`.
8. Set `enabled:true`, validate Google sign-in, then set `enforceAuth:true` after the first admin and UID migration are verified.
9. Sign in once with the intended administrator account. A `users/{uid}` document is created with `role:user`, `status:pending`.
10. In Firestore Console, bootstrap that one account by changing it to `role:admin`, `status:active`.
11. Verify the Admin-only User Management UI and UID isolation.
12. Microsoft can remain independently disabled with `microsoftEnabled:false`; it does not block Google authentication enforcement.

## Roles

Application role:
- `owner` — protected full-system owner; only one client-bootstrapped owner.
- `admin` — user administration plus all training/course/global Package management, except Owner/peer-Admin management.
- `training_manager` — create/manage courses, rosters and course-specific Package overrides without user administration or global Package authority.
- `user` — operational work in assigned courses, including evaluations/forms, without structural editing.

Application roles and course roles are intentionally separate. A `user` can
still be `COURSE_MANAGER` for a specific assigned course and receive only that
course's roster/tailoring permissions.

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

The site is hosted by GitHub Pages, not Firebase Hosting. Firebase redirect authentication depends on cross-origin auth helpers and can fail in browsers that block third-party storage unless the helpers are proxied/self-hosted. Google therefore uses `signInWithPopup()`. The staged Microsoft provider uses the same flow and stays hidden until it is configured. We can revisit a self-hosted redirect helper if iOS PWA testing shows that it is needed.

## Pre-authorized users

User Management can add an email before first sign-in and choose USER, TRAINING_MANAGER or ADMIN. OWNER is never invitation-assignable. This creates an `invitations/{normalizedEmail}` record; it does not send email. On first Firebase sign-in, Security Rules permit ACTIVE access only with the exact role stored in that administrator-created invitation. Uninvited accounts continue to enter as PENDING.

The invitation rules in `firestore.rules` must be deployed to Firebase when this feature is released.
