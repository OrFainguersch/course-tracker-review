# FLYMPUS deployment through GitHub OIDC

This configuration is prepared but **not provisioned or deployed**. Google Cloud
Console currently returns `Site Unavailable` in the Work browser, even after one
reload. There is no login or interactive approval prompt to complete there.
Never create/download another service-account key or fall back to FIREBASE_TOKEN.

## Exact trust boundary

- Project: `flympus`, project number `272914048311`.
- GitHub repository: `OrFainguersch/course-tracker-review`.
- Repository ID: `1393810184`; owner ID: `335200333` (verified public GitHub API).
- Pool: `github-hosting`; provider: `github`.
- Issuer: `https://token.actions.githubusercontent.com`.
- Provider condition checks exact repository name, immutable repository and owner
  IDs, `refs/heads/main`, and the exact `firebase-hosting.yml` workflow on main.
- Service-account impersonation is granted to the repository ID principal set,
  not every identity in the pool.
- Dedicated account: `flympus-hosting-deployer@flympus.iam.gserviceaccount.com`.
- Project roles are intentionally narrow:
  - `roles/firebasehosting.admin` — deploy the reviewed Hosting bundle.
  - `roles/serviceusage.apiKeysViewer` — Firebase CLI API-key lookup.
  - `roles/serviceusage.serviceUsageViewer` — inspect whether required APIs are enabled; this includes `serviceusage.services.get/list` but cannot enable/disable services.
  - `roles/firebaserules.admin` — publish Firebase Security Rules only.
- No Owner, Editor, Firebase Admin, Cloud Firestore database admin, Auth admin,
  or service-account-key permissions are added.

`scripts/configure-hosting-wif.sh` is the administrator bootstrap implementation.
It validates the project number, aborts if the dedicated account already has
unexpected project roles, provisions/updates only the named resources, and emits
the cloud configuration and IAM bindings for review. It has not been executed.
The owner only has an iPhone; do not ask them to run this script or a terminal.

After provisioning and verification, set these non-secret GitHub repository
variables (do not mark placeholders as configured):

| Variable | Intended value, pending provisioning |
| --- | --- |
| `FIREBASE_WIF_PROVIDER` | `projects/272914048311/locations/global/workloadIdentityPools/github-hosting/providers/github` |
| `FIREBASE_DEPLOY_SERVICE_ACCOUNT` | `flympus-hosting-deployer@flympus.iam.gserviceaccount.com` |

## Firebase CLI verification

Pin `firebase-tools@15.32.1`. A public report describes an ADC/WIF failure on
15.17.0; its claim about a token-exchange timeout is not present in the inspected
15.32.1 `requireAuth` source. Do not assume every v15 release fails from that report.

`scripts/test-firebase-wif.cjs` exercised the **installed CLI's real**
`requireAuth`, GoogleAuth external-account ADC, STS exchange, service-account
impersonation, and API bearer-token selection with synthetic local endpoints.
It passed for 15.32.1. This proves compatibility of that code path without any
private key or real credentials; it does not prove the cloud IAM configuration.
The workflow repeats this test for the CLI installed in CI, then uses auth@v3's
generated external-account ADC file and verifies real Hosting access before
deploying `--only hosting,firestore:rules`. It never uses a token or a JSON service-account key.

## Production acceptance

Run the manual workflow from main only after the two verified variables exist.
The job must pass real ADC preflight, the combined Hosting + Firestore Rules
deploy, and the verifier checking the exact commit, every public asset, and
reserved auth helper responses.
Then test Google login on the Firebase origin in the live browser and iPhone PWA.
Current production still returns 404; no successful deployment is claimed.
The existing real-worker test confirms `/__/` bypasses worker handling.

Sources:
- https://github.com/google-github-actions/auth
- https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- https://firebase.google.com/docs/projects/iam/roles-predefined-product
- https://firebase.google.com/docs/cli
- https://github.com/firebase/firebase-tools/issues/10726

Possible unused key from the previously approved attempt remains unverified;
inspect its metadata and revoke it when authorized cloud access is available.
Do not retrieve its contents or use it for deployment.
