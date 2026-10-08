# FLYMPUS safe production unification

Status: **BLOCKED BEFORE PRODUCTION DEPLOYMENT**. This document and the proposed
pipeline do not certify that production records or personal devices are backed up.

## Verified source checkpoints, 2026-10-08

| Reference | Exact Git commit |
| --- | --- |
| Inspected main / newest approved application | `e372d52bdf79fe1dfbc43f102c58c34d31b9ca5b` |
| Public Firebase Hosting manifest | `ef3f427dae3d585708b223b4f08aa41ae78c0441` |
| Existing draft PR 65 head, preserved as parent | `a79423779a58a82dc494de1823248fa81b02426a` |
| Additional remote source backup branch | `backup/pre-safe-unification-20261008-e372d52` → `e372d52bdf79fe1dfbc43f102c58c34d31b9ca5b` |

The older backup branches remain intact. Main is 34 commits ahead and zero
commits behind the observed Hosting commit. The seven changed files are
`assets/fleet-model.js`, `assets/fleet-operations.css`, `assets/fleet-views.js`,
`index.html`, `sw.js`, `tests/fleet-operations.test.cjs`, and
`tests/ui-render.test.cjs`. The candidate retains the complete newer main tree
and PR 65's Fleet modules / Plan fixture correction.

The application changes include flight-board planned counts, linked Plan /
Planned vs Executed, date handling and draft preservation, flight-form layout,
single required-field indicators, and matching worker asset versions. The
candidate makes no further edits to application UI, authentication, storage
scoping, Firebase web configuration, or Firestore Rules. Source ancestry alone
cannot prove that server configuration and user data have no differences.

The source repository was cloned without shallow history: 1,350 commits across
all refs at inspection; `git fsck --full --no-dangling` passed. Existing remote
branches retain the historical commits. A Git SHA is immutable; the added
backup branch itself is not protected against a future administrator moving it.
An annotated local checkpoint tag was created, but the available authenticated
GitHub API cannot publish tags, and unauthenticated Git push was rejected. Do not
describe that local tag as a protected remote tag or a production-data backup.

## Production-data requirements

The Firebase Console redirected to Google sign-in, which returned HTTP 502 /
connection refused even after one reload. No authorized admin session, cloud
export, Authentication export, Storage inventory or Hosting release-version
read was completed. The existing deployment identity's documented narrow roles
do not include a complete Firestore/Auth/Storage data-backup capability; its
actual current IAM bindings remain unverified. Do not expand IAM or billing
automatically.

With authorized project access, inventory **every** database and collection,
including nested/orphaned subcollections; do not assume the list used by the
client is exhaustive. Code references at least `users`, `invitations`,
`system/access`, and `courseSafety/{course}/events/{event}`. Preserve exact field
types, document paths, UIDs, timestamps, rules releases, index definitions and
provider configuration. Inventory all Storage buckets, object versions/content,
metadata and generation numbers. Record the current Hosting release/version ID,
headers, configured sites/domains and retention before changing Hosting.

Use a supported complete Firestore export when available. Google's managed
Firestore export requires billing / Blaze. If the project is still on Spark,
stop for the owner's decision; do not attach billing, enable paid features or
claim that a collection screenshot is a restorable backup. An alternative typed
document export must be separately reviewed for complete recursive discovery
and tested recovery before its coverage is accepted.

Export Authentication users through supported authorized tooling; retain Google
and any other provider configuration, authorized domains, tenant settings and,
where applicable, the separate password-hash parameters necessary for recovery.
The account file is not a provider-configuration backup. Store user exports,
hash parameters and private configuration in private storage, never this public
repository or public Actions artifacts. Never import an Auth export into the
live project as a test: matching UIDs can be overwritten.

Verify backup manifests/checksums/counts and recovery in an already authorized
isolated environment. Creating paid resources or changing permissions needs the
owner's decision. Record evidence in a private backup location and reference it
in `config/production-migration.json`; a boolean without actual evidence is not
a verification. Mark inapplicable resources only after authorized inventory
proves they are absent.

## Personal-device migration procedure

GitHub Pages, `flympus.firebaseapp.com`, and `flympus.web.app` are three separate
origins. Desktop browsers, Safari, and installed PWA contexts may also retain
different local records. Check each actual context; one Safari export does not
prove an installed iPhone PWA is protected. The Work browser cannot read those
personal-device stores.

1. Keep the old site and every PWA installation. Do not clear browser data,
   uninstall/reinstall, reset review data or redirect either origin.
2. Inventory each used device/browser/PWA and account. Finish pending input or
   explicitly preserve its draft, close other editing tabs and pause edits while
   exporting. Form-value snapshots supplement stored drafts; they are not an
   automatic reconstruction of a running page.
3. Run the reviewed `scripts/browser-local-backup.js` in **the already open,
   signed-in application context**. An offline HTML opened from Files has a
   different origin and cannot export the site's storage. For a computer,
   a trusted operator can run the checked-out script in that tab's console.
   For an iPhone/PWA, first arrange a reviewed in-app helper or supported
   same-context execution; do not ask the owner to use a terminal or pretend a
   Safari shortcut accesses a separately installed PWA. The helper is prepared
   in this candidate and is not published or device-tested yet.
4. Invoke `await FLYMPUS_LOCAL_BACKUP.exportBackup()`. Save the downloaded JSON
   outside browser storage, retain a second private copy, and verify it opens
   and passes `await FLYMPUS_LOCAL_BACKUP.decode(fileText)`. Record the returned
   local-key, session-key and photo counts. The file contains user information;
   do not upload it to public GitHub or send it in chat.
5. Export from **both origins** on each used context before any import. The
   exporter captures raw application keys, including hidden legacy/other-account
   namespaces, current session state, unsaved application form values, and
   Safety photo blobs. It excludes Firebase credentials and authentication
   authorization-cache keys. Log in again normally on the destination; do not
   copy a login session. Unknown additional FLYMPUS IndexedDB databases stop
   export for separate inspection.
6. On Firebase, sign in to the same verified UID, load the same helper and run
   `await FLYMPUS_LOCAL_BACKUP.compareBackup(sourceFileText)`. Keep the source
   and destination files. Inspect missing/identical/conflicting and archived
   entries; the comparison does not write anything.
7. Only after both saved backup files have been checked, an authorized operator
   may invoke `await FLYMPUS_LOCAL_BACKUP.restoreMissing(sourceFileText,
   'SOURCE_AND_TARGET_BACKUPS_SAVED')`. The importer adds absent persistent
   keys for the **same UID** and absent same-UID Safety photos on Firebase only.
   Conflicting scoped records/photos stop the entire import before writes.
   Existing destination values are never overwritten; concurrent conflicts
   abort, and new storage inserts are rolled back after photo/quota failure.
   Another account's records, legacy unscoped data, navigation/session state,
   preferences and captured unsaved forms are preserved in the file for
   separately reviewed/manual recovery, rather than assigned to a different
   user or blindly applied.
8. Where both origins have different saved arrays or objects, reconcile by the
   application's stable record IDs, course and revision history. Keep both
   copies until conflicts are resolved and tested. Do not treat key-level
   conflict detection as a complete record-level merge. Legacy records require
   confirmed ownership; do not automatically promote them into a UID scope.
9. Reload Firebase normally and verify course membership, roster, evaluations,
   drafts, flight boards and Safety photos. Export again and compare expected
   records/photo contents. Repeat for every used device/account/context.
   Keep the old entry point while any context remains unverified.

The helper's serialization, credential exclusions, UID checks, conflict
classification, missing-only writes and rollback are regression-tested.
Real Safari/PWA execution, download handling and IndexedDB restore still need
device verification. It does not migrate cloud data or make cross-device
training synchronization available.

## Release pipeline and safe continuation

Both workflows discover and run **all** `tests/*.test.cjs` with Node 22. A single
real suite outcome gates production; tests have not been removed. Job-level
`continue-on-error` retains the repository's required quiet email behavior, so
read the explicit summary and real test outcome rather than the green icon.

Production requires all three verified safeguards in
`config/production-migration.json`. They remain false in this candidate.
After evidence is reviewed, update the record on an isolated branch and run the
full suite before merging. Do not mark it ready to obtain a green deployment.
Only main can deploy, and its freshness is checked again immediately before
the Hosting write. In-flight writes are not cancelled by newer pushes.

The release is `--only hosting`; Firestore Rules are not published as a side
effect. The separate rules script remains for a separately authorized,
backed-up and compatibility-checked rules change. Authentication settings,
Storage and database records are not written by this release workflow.

`prepare-hosting.cjs` rejects uncommitted/untracked source and a mismatched CI
SHA, prepares the existing 61-file allowlist, stamps the actual commit in HTML
and the worker, and records SHA-256 digests. The existing post-deploy verifier
checks the exact commit, every bundled file and reserved Firebase auth routes.
The explicit release result records `DEPLOYED`, `BLOCKED` or `FAILED`, the
intended SHA, independently observed SHA and actual step outcomes. A failed
post-deploy verification says Hosting changed and does not falsely say the
previous release remained untouched.

The read-only PR audit verifies public Hosting files against both the served
manifest and the exact historical Git source, retaining only public files in
its Actions artifact. It uses no Firebase credentials and is not a cloud-data
backup. A deployment/audit artifact alone does not verify live sign-in, course
records or iPhone behavior; those remain required acceptance checks.

The initial candidate's actual Node 22 CI log confirmed 124 passed tests and
zero failures. Its anonymous Hosting audit verified all 61 manifest-listed
public files against their SHA-256 hashes and the exact live Git source, plus
both reserved auth routes: live commit `ef3f427dae3d585708b223b4f08aa41ae78c0441`,
build 0758. Evidence: Actions run `37841857907`, public artifact `11578600492`
(`verified-public-hosting-audit`, retained until 2027-01-06). This is a verified
public-bundle snapshot, not a database/Auth/Storage backup or a confirmed Hosting
rollback version. Recheck current evidence before release.

## Rollback

Before release, record the previous **Hosting version ID** and ensure it is
retained and available for rollback. After a regression, use Firebase Hosting's
normal previous-release rollback to that exact recorded version, then verify
`deploy-info.json`, all file hashes and sign-in on the production origin.
Hosting rollback does not undo or migrate user data; leave database, Auth,
Storage and browser data intact. If a Hosting version is unavailable, a reviewed
clean checkout of the previous exact Git SHA can prepare an equivalent public
bundle, but redeployment still requires verified safety and authorization.
Never reset/force-push main as a Hosting rollback method.

Do not retire GitHub Pages until device migration, auth domains/callbacks,
deep links and installed-PWA checks pass. Intended official URL after acceptance:
**https://flympus.firebaseapp.com/**. Until then, both entry points remain.

## Authoritative references

- https://firebase.google.com/docs/firestore/manage-data/export-import
- https://firebase.google.com/docs/cli/auth
- https://firebase.google.com/docs/hosting/test-preview-deploy

Historical `KEYLESS_HOSTING.md` / `STABILIZATION_STATUS.md` entries are not
current evidence that the project is still unhosted or that current backup/IAM
requirements have been satisfied; use actual observations and this safety record.
