# FLYMPUS authenticated browser-data isolation

## Purpose

FLYMPUS still has substantial browser-local operational data. Authentication is not considered safely enforceable if two authenticated people using the same Safari/PWA installation can see the same unscoped `localStorage` state.

`storage-scope.js` therefore installs before application code and creates a logical storage namespace for the authenticated Firebase UID.

## Classification

Device-level and intentionally shared:

- `flympus-app-preferences` — theme, language, text, motion, sound and haptic preferences.
- `flympus-last-resolved-theme` and `flympus-last-visible-theme-at` — paint-stability metadata.
- `ct-review-standalone-migration-dismissed` — one-time PWA device notice.

UID-scoped:

- Active course and course definitions.
- Course memberships, roster additions and person/profile overrides.
- Evaluations, revisions, drafts, Safety, Exams, daily reports and activity/experience events.
- Course lifecycle, Package/course overrides, custom packages, catalogs and architecture edits.
- Personal notification and push opt-in state.
- Session navigation, current screen, filters, scroll positions and reload snapshots.

The default is private: any new key beginning with `ct-review-` or `flympus-` is UID-scoped unless it is explicitly placed in the small device-level allowlist.

## Login lifecycle

1. Before Firebase resolves a UID, private keys return no data and private writes are ignored.
2. Firebase verifies `users/{uid}` and its `status`.
3. The UID is bound to the browser session. If it differs from the UID used to parse the page, FLYMPUS reloads while still covered by the authentication shell.
4. The application then reads only physical keys prefixed by that UID.
5. Sign-out clears the session UID and reloads before the application is exposed.

This prevents accidental cross-account inheritance. It is not a substitute for device encryption or Firestore Security Rules; the Firestore rules remain the cloud security boundary.

## Legacy claim

Existing unscoped review data is preserved for rollback but hidden while authentication is enabled.

Only an authenticated account that is already `role: admin` and `status: active` may claim the legacy dataset. The device records one legacy owner UID. A second UID cannot claim or inherit it. Migration is idempotent and never overwrites data already present in the administrator's UID namespace.

## Cloud migration boundary

Training collections remain denied by Firestore rules. This phase isolates the existing device-local runtime; it does not pretend that course data has already moved to Firestore. A later cloud-data migration must introduce explicit course membership documents and per-collection rules before enabling shared cloud course data.
