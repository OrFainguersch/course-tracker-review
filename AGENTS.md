# FLYMPUS deployment guardrails

This repository treats production deployment stability as a hard project rule.

1. Never publish an incomplete multi-file change set to `main` one file/commit at a time.
2. Build multi-file work on a temporary branch or create one atomic Git commit/tree, then move `main` once the complete set is ready.
3. Before moving `main`, verify the complete revision against the repository test suite whenever execution is available.
4. The Firebase production workflow must ignore obsolete revisions and must not fail merely because an intermediate/application verification revision is invalid; it should leave production unchanged and exit successfully.
5. Real production infrastructure failures (authentication, Firestore Rules deployment, Hosting deployment, or final production verification) must stop that deployment and be surfaced as workflow warnings/summary, but the workflow must not conclude as failed or generate repeated GitHub failure emails.
6. Do not report a deployment as successful until the exact `main` SHA reaches the final production verification step and that step succeeds.
7. Pull-request/review verification must also be email-quiet: failed checks stay visible as step warnings and summary output, but the workflow must not conclude as failed or generate GitHub failure-email spam.

These rules exist specifically to prevent repeated GitHub Actions failure emails from transient edits.

## Navigation audio invariant

- Bottom-navigation sound must respond to the **first trusted physical press** after cold launch, reload, focus/resume, and ordinary navigation on both mobile and desktop layouts.
- Capture-phase handlers may preload, decode, or resume audio, but must never claim/consume the audible navigation gesture before the target navigation binding.
- If WebAudio cannot become running synchronously on that press, target phase must use the already-preloaded media fallback on the same trusted gesture; a later resume must never emit a ghost sound.
- Do not reintroduce a cold round-robin media fallback where unloaded pool entries can make the first N presses silent.
- Any change touching navigation audio, hydration, lifecycle, bottom navigation, or sound preferences must preserve and update regression coverage for this first-press guarantee.

## Instructor nickname identity invariant

- User-facing terminology is **Nickname**, not Preferred Name. The persisted Firestore field may remain `preferredName` for backward compatibility.
- Nickname is an instructor/account concept only. Trainees do not have nicknames; a trainee's course-managed full name is the name shown throughout the training UI.
- Instructor cards and instructor profiles keep the official full name as the primary identity and show Nickname only as secondary text when one exists.
- Nickname must remain searchable alongside official full name and email. It must never replace the stable official identity used for course assignment.
- Course Roster management may edit trainee identity and instructor course role, but must not overwrite an instructor's official full name or Nickname.
