# Duty Trainee instructor approval

Reference before implementation: Build 0791, main commit
`80aaa507ef7e1a8c58fdcf2dbe1df542223a9f70`, preserved at
`reference/build-0791-before-duty-approvals`.

## Workflow

Duty Trainee day plans, solo executions, cancellations and daily reports are
working copies. Sending creates an immutable pending request, without an
official Data write. An active instructor assigned to the shared course can
review the complete day and approve or return it with a correction note.
Approval and the official day update are one Firestore transaction. The
request's base revision prevents overwriting newer approved data. A trainee
cannot review their own request. Fleet continues to save directly.

Plan has a Pending approvals tab for instructors and My requests for Duty
Trainees. The instructor bell links to outstanding approvals for the selected
course. Pending submissions are locked; Withdraw and edit preserves the draft.
Returned drafts preserve all submitted entries. Update approval base keeps
entries when the official version changes. Reload approved version requires
explicit confirmation before replacing a working copy.

## Data and authorization

The additive `courseOperations` namespace contains a course manifest with
verified Firebase UIDs, shared fleet, approved day snapshots and approval
requests. Membership is set by a global account manager, using exact roster
email matches to active accounts. Course participant context exposes names and
stable roster IDs, without publishing roster email addresses to trainees.

As in shared Safety, a verified Training Manager automatically enrolls opened
courses and reconciles the roster with active Firebase accounts. There is no
manual Connect course action on the day plan. Incorrect or unmatched accounts
must be resolved in Course Roster and User Management. Existing manager-owned course records form the initial
shared baseline; reconnecting updates participants without replacing fleet or
approved days. Existing device records remain intact. Existing trainee entries
are preserved as approval drafts, once per date/type. Pending data is never
merged into official reports, solo counts or experience events.

UID and course namespaces keep drafts separate. Failed sends keep entries and
the same request ID for safe retries. Stale callbacks after account switching
are ignored. No production user roles, unrelated security rules or legacy
training collections are changed by this feature.

## Release

The separate authorization in `config/course-operations-release.json` permits
only the additive rules block. The previous Hosting-only migration record is
unchanged. The production workflow backs up the active rules to a durable
GitHub artifact, merges only the reviewed block and runs the permission suite
against that actual merged source in an isolated demo emulator. It compiles,
publishes and verifies the active ruleset before deploying Hosting. The release
summary cannot report DEPLOYED when any permission/rules/Hosting verification
step was skipped.

The backup includes the previous ruleset name and exact source for recovery;
the stable reference branch preserves the previous application. Deployment
does not perform a bulk data migration or delete historical records.

## Automatic enrollment (Build 0793)

An authorized manager provisions known courses on opening them and synchronizes
changes to participant emails and roles. Duty Trainees cannot self-enroll.
Only the initial link seeds previously stored fleet and official days. Later
roster syncs leave shared fleet, approved days and pending requests untouched;
failures never authorize a local Submit or discard drafts.

## Bidirectional in-app alerts (Build 0795)

- After a confirmed Firestore approval-request submission, the Duty Trainee hears the existing Form submission sound.
- An assigned instructor hears the existing Notification sound when a newly pending request arrives while the app is visible.
- Following APPROVED or RETURNED, the originating trainee hears the existing Notification sound while the app is visible, and can open the matching My requests entry from the notification bell.
- Instructor reviews play the existing Form submission sound only after a successful Firestore review transaction.
- First Firestore snapshots are silent; opaque event IDs are remembered per account to avoid replay after reload or cross-tab synchronization. No sound is emitted after a failed operation.
- Background/closed-app remote Web Push is unavailable while the delivery server is unconfigured (push-config.json currently disables it).
