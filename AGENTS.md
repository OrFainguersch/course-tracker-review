# FLYMPUS deployment guardrails

This repository treats production deployment stability as a hard project rule.

1. Never publish an incomplete multi-file change set to `main` one file/commit at a time.
2. Build multi-file work on a temporary branch or create one atomic Git commit/tree, then move `main` once the complete set is ready.
3. Before moving `main`, verify the complete revision against the repository test suite whenever execution is available.
4. The Firebase production workflow must ignore obsolete revisions and must not fail merely because an intermediate/application verification revision is invalid; it should leave production unchanged and exit successfully.
5. Real production infrastructure failures (authentication, Firestore Rules deployment, Hosting deployment, or final production verification) remain fatal and must be investigated.
6. Do not report a deployment as successful until the final production workflow run for the exact `main` SHA has completed successfully.

These rules exist specifically to prevent repeated GitHub Actions failure emails from transient edits.
