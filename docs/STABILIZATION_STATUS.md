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

## Verified on 2026-10-05

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
- Live User Management opened but its directory load failed with
  `Missing or insufficient permissions`. Do not report this feature as verified:
  inspect the actually deployed Firestore rules and reconcile them with main.

## Deployment prepared in this change

- `scripts/prepare-hosting.cjs` builds an allowlisted public bundle in `dist`.
  CI authentication files, tests, rules and push-server code are excluded.
- The bundle records the exact Git commit and public-file SHA-256 hashes.
- `firebase-hosting.yml` runs all tests, authenticates, deploys Hosting only and
  verifies the live commit, every public asset and Firebase auth helper routes.
- Prefer GitHub Workload Identity Federation with the public variables
  `FIREBASE_WIF_PROVIDER` and `FIREBASE_DEPLOY_SERVICE_ACCOUNT`. The alternative
  is a deployment account stored in `FIREBASE_SERVICE_ACCOUNT_FLYMPUS`.
- The workflow is manual until the first release succeeds. Enable automatic
  main deployments only after authorization and production validation succeed.
- No deployment credential has been created and no production release has been
  made. The next blocking step is connecting authorized Google deployment access.

## Still required before completion

1. Connect deployment authorization without exposing credential values.
2. Run the Hosting workflow on main and verify its production checks and live UI.
3. Inspect the live Firestore rules, authorized domains and Google provider setup.
4. Validate the iPhone PWA auth return path on the Firebase origin; make changes
   only when the current architecture's behavior is established.
5. Complete lifecycle/theme/UI validation and report remaining physical-device
   limitations honestly.
6. Keep the old GitHub Pages origin available: browser-local training data and
   preferences do not transfer automatically to the Firebase Hosting origin.
   Do not redirect existing users and strand their data without a migration path.
