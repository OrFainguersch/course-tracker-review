# FLYMPUS stabilization — current verified state

GitHub `main` in `OrFainguersch/course-tracker-review` is the source of truth.
Do not use an old ZIP or Phase-2 copy, restart completed work, or claim that an
earlier Work run completed deployment.

## Complete task scope

- The owner has only an iPhone. Do not ask them to use a computer or terminal.
- Stabilize authentication, startup, PWA lifecycle, appearance and existing UI
  together, carrying changes through configuration, deployment and verification.
- Verify persistent Google/Firebase login across ordinary and rapid refreshes,
  background/resume, full PWA termination and cold relaunch on iPhone.
- Eliminate missing initial state, redirect URI mismatch, cancelled popup,
  duplicate/false sign-in errors and unexpected return to the sign-in screen.
- Complete Firebase Hosting and verify `https://flympus.firebaseapp.com/` serves
  FLYMPUS. Firebase reserved `/__/` routes must bypass the Service Worker.
- Resolve cold-start/white-screen/crash-like behavior and intermittent theme
  flashes without another competing timeout-driven theme writer.
- Preserve last screen/activity on refresh and Hebrew for every new UI.
- Verify User Management scrolling, notification/profile dismissal and existing
  course workflows. Do not treat Chrome tests as iPhone PWA verification.
- Stop for the owner only for a genuinely required authentication/approval step.

## Current production checkpoint — 2026-10-06

This section supersedes the historical deployment blockers below. Repository
variables were saved, and Hosting workflow run `37353905377` succeeded for
`d591015756cd8a1863a19bdd01850617c34e2e30` with real WIF/ADC access, Hosting-only
deployment and production file/hash/helper verification. The owner confirms
Google sign-in works on their physical iPhone in Safari and Home Screen.
Do not repeat Cloud configuration, deploy credentials, or physical Google login
setup. No new key was created or downloaded for this deployment.

The attached 847-frame recording demonstrates a remaining System theme
lifecycle problem. The theme-only follow-up removes media-event/timing-based
resolution, embeds the same authority before HTML/worker first paint, and adds
recording-sequence regressions. See `THEME_LIFECYCLE.md`. Physical iPhone theme
acceptance is still pending; Chrome/VM tests cannot prove iOS compositor frames.

## Historical verification on 2026-10-05

- Main initially contained `c7f263c` (Firebase auth / iOS lifecycle stabilization).
- GitHub Pages served the current auth13, storage7 and theme1 assets.
- Live Google sign-in succeeded. The profile showed Signed in / Administrator.
- Repeated Chrome refreshes preserved the verified account. Bottom navigation
  dismissed the profile dropdown. These are Cloud Chrome observations, not an
  iPhone PWA cold-relaunch test.
- All local application tests passed, including behavioral auth race tests.
- `7a8a1a3` added auth lifecycle regression coverage and theme tests to CI.
- GitHub Actions repository/environment secrets and variables were inspected
  with explicit owner authorization: none were configured. No secret values
  were read or exposed.
- Firebase Hosting displayed Site Not Found; the Firebase Console displayed
  Get started. It was not deployed. The deployment CLI independently reported
  that it requires authentication. The production verifier rejects this state.
- Cloud Shell (embedded and direct) and the Google Cloud IAM console were
  unavailable in this browser. Firebase Console and GitHub remained accessible.
- After explicit owner approval, published the main Firestore rules in Firebase
  Console. The latest published rules entry is 2026-10-05 at 7:55 PM.
- Live User Management then loaded successfully: one active administrator,
  no permission error. Its content fits the Cloud Chrome viewport; this does
  not verify overflowing touch scrolling on iPhone.
- Plan remained selected after refresh. Bottom navigation also dismissed the
  notification dropdown. These observations were on the existing Pages origin.
- The owner explicitly approved creating the Firebase Admin SDK credential and
  using it for Hosting deployment. Generate key was clicked once. The dialog
  closed, but the documented download event timed out and no credential file
  appeared in the shared download directory. Creation success is unknown; a
  key may exist. Do not generate another key blindly or claim no key exists.
- Browser security policy rejected opening the browser download manager and
  forbids circumventing that restriction. No credential contents were read,
  exposed, committed or saved to Library. Deployment remains unauthorized.
- Live Firebase Authentication has Google enabled. Authorized domains include
  flympus.firebaseapp.com, flympus.web.app and orfainguersch.github.io.
- Prefer restricted WIF when the Google Cloud IAM console becomes accessible.
  Credential delivery, possible unused-key cleanup and GitHub deployment
  authorization remain unresolved. Additional consent cannot fix an unsupported
  download mechanism; do not repeatedly ask for the same approval.

## Deployment prepared in this change

- `scripts/prepare-hosting.cjs` builds an allowlisted public bundle in `dist`.
  CI authentication files, tests, rules and push-server code are excluded.
- The bundle records the exact Git commit and public-file SHA-256 hashes.
- `firebase-hosting.yml` runs all tests, authenticates, deploys Hosting only and
  verifies the live commit, every public asset and Firebase auth helper routes.
- The owner now requires keyless WIF only. All JSON-key fallback steps have
  been removed. Use only `FIREBASE_WIF_PROVIDER` and
  `FIREBASE_DEPLOY_SERVICE_ACCOUNT`; do not create/download keys or use tokens.
- Firebase CLI 15.32.1 passed its real ADC/WIF code path with synthetic STS and
  impersonation endpoints. CI repeats that test and verifies real Hosting access
  before deploying. No real WIF exchange or production deploy is verified yet.
- `docs/KEYLESS_HOSTING.md` records exact repo/owner IDs, main/workflow restrictions,
  dedicated account roles, and the bootstrap script. Cloud resources and repository
  variables are not provisioned. The Google Cloud console still returns Site
  Unavailable after one reload; no interactive authentication prompt is present.
- The workflow is manual until the first release succeeds. Enable automatic
  main deployments only after authorization and production validation succeed.
- No usable deployment credential and no production release are available. A
  possible unused key from the earlier attempt needs metadata review/cleanup,
  not recovery. The next blocking step is provisioning WIF with administrator access.

## Still required before completion

1. Connect deployment authorization without exposing credential values.
2. Run the Hosting workflow on main and verify its production checks and live UI.
3. Google provider, both Hosting domains and the Pages domain are already verified.
   Firestore publication and live directory load are also verified; do not repeat.
4. Validate the iPhone PWA auth return path on the Firebase origin; make changes
   only when the current architecture's behavior is established.
5. Complete lifecycle/theme/UI validation and report remaining physical-device
   limitations honestly.
6. Keep the old GitHub Pages origin available: browser-local training data and
   preferences do not transfer automatically to the Firebase Hosting origin.
   Do not redirect existing users and strand their data without a migration path.
