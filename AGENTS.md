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

## Duty Trainee approvals (authorized 2026-10-09)

- Duty Trainee plans, daily reports, solo executions and cancellations remain drafts or immutable approval requests until an assigned instructor approves them. Pending data never feeds official reports or experience counters. Fleet stays a direct save.
- A new courseOperations namespace shares verified Firebase UID memberships, fleet, approved days and requests. Do not trust browser storage as authorization; prevent self-approval, duplicate approval and stale revision overwrites on the server.
- Preserve existing UID-scoped records and drafts. Do not clear a draft until its matching request is approved or the user explicitly chooses to reload the approved version.
- Reference before this feature: reference/build-0791-before-duty-approvals at 80aaa507ef7e1a8c58fdcf2dbe1df542223a9f70.
- This feature separately authorizes an additive rules release. Back up active production rules to a GitHub artifact, merge only the reviewed courseOperations block, test the merged live source against the emulator and verify the active ruleset before Hosting. Never replace unrelated production permissions or mark the old Hosting-only data safeguards as verified.

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

## Mobile chrome and drawer invariants

These behaviors are approved UX baselines and must not regress in future mobile/iOS changes.

### Top + bottom chrome synchronization

- The top header and bottom navigation are one synchronized chrome system: every hide/show decision must toggle both in the same state change.
- Preserve the approved visual cadence unless explicitly requested otherwise:
  - show duration: **0.58s**
  - hide duration: **0.64s**
  - easing: **cubic-bezier(.32,.72,0,1)**
- Do **not** make input responsiveness wait for the full visual transition. A decisive reverse scroll must be able to retarget the chrome almost immediately; the short decision debounce is intentionally separate from the .58/.64s animation duration.
- On touch/mobile, the top header remains **viewport-owned (position: fixed)** and the app keeps a reserved flow footprint for its height. Do not revert it to sticky behavior as a workaround for timing or iOS gaps.
- The document/content geometry must stay stable while chrome hides or shows. Do not collapse the mobile header slot or move the long document to imitate header motion.
- iOS rubber-band / elastic corrections must never be interpreted as an opposite scroll direction.
- The upward navy coverage used to prevent the iOS white seam must stay physically attached to the moving header; do not reintroduce a static page/body cover.

### Pull-to-refresh interaction handoff

- Pull-to-refresh return/spring motion is visual polish, **not an input lock**.
- A new trusted physical touch during the return tail must immediately cancel/finish that tail and hand control back to normal scrolling/chrome auto-hide.
- Pull-to-refresh must not leave stale transforms, animations, or chrome state after completion/cancellation/backgrounding.
- Do not convert ordinary scrolling into pull-to-refresh after momentum merely reaches the top; installed-PWA pull must begin explicitly from the top.

### Sidebar / drawer scroll preservation

- Opening the sidebar while scrolled down must preserve the exact vertical viewport position.
- The temporary fixed-canvas drawer technique may visually freeze the page, but closing the drawer on the **same screen** must restore the saved real scroll offset before the browser can paint the underlying page at the top.
- Synthetic scroll-to-zero events produced by the temporary fixed canvas must be ignored by:
  - bottom-navigation scroll-position persistence
  - chrome direction/velocity logic
- Do not restore the previous screen's scroll position when the user actually navigates to a different screen from the sidebar.
- Any future drawer refactor must preserve the approved push/pull animation **and** the exact pre-open vertical scroll position.

### Regression coverage

Any change touching mobile header positioning, bottom-nav auto-hide, pull-to-refresh, drawer/sidebar freezing, scroll restoration, or iOS viewport behavior must keep/update regression tests for:

- synchronized top/bottom chrome timing
- short input debounce independent of visual animation duration
- immediate handoff from pull-return tail to a new touch
- drawer close restoring the frozen scroll offset
- synthetic drawer scroll events not contaminating saved scroll or chrome direction state

## Sidebar identity + safe-area invariants

- The sidebar footer identity shows the signed-in user's **system/application role only** (for example Owner, Administrator, Training Manager, User), using the canonical auth role label. Never append Course Manager, Instructor, or another role from the selected course. Show course membership only in course-scoped screens.
- On iOS standalone PWA, the sidebar's dark-navy fill must have **no pale separator across the safe-area/status-bar boundary**. Any boundary correction must be painted by the sliding drawer panel itself, not a static document/body patch or an independently moving layer.
- Preserve the 200ms opening, 230ms closing, exact scroll-position restoration, header/bottom-nav auto-hide, and drawer push-canvas synchronization when modifying sidebar visuals.
- Keep regression checks covering the drawer's system-only role across different accounts and its panel-owned safe-area boundary paint.

### Approved sidebar logo (2026-10-08)

- Sidebar wordmark asset: `assets/flympus-sidebar-uploaded-0762.webp`, a transparent, tight-cropped export of the user-provided silver/white FLYMPUS wordmark with subtle gold details and the TRAIN. TRACK. PROGRESS. tagline.
- It replaces the previous wordmark completely in the sidebar. Do not revert the source or overlay a secondary/duplicate logo.
- Keep the centered layout with the user-requested **8px physical left offset (2026-10-09)** for mobile and desktop, including RTL, with the original aspect ratio, inside the existing sidebar brand row. It must not affect the fixed-canvas drawer timing, scroll restoration, or safe-area boundary fix.
- **Approved responsive wordmark width (2026-10-08): 198px**, the midpoint between the older 164px mobile logo and the too-large 232px replacement. Keep the optical left offset, `max-width:100%`, `height:auto`, and `object-fit:contain`. Do not reintroduce the 232px oversized presentation without an explicit new request.

## Desktop/mobile visual and behavioral parity (approved 2026-10-08)

- Desktop is not a legacy layout. The top header and bottom dock MUST hide/show together on the same scroll-decision JS, with the approved **0.58s show, 0.64s hide** animations and short input debounce.
- On screens >=900px, the top bar MUST remain **position:fixed** relative to viewport, with a persistent ~78px normal-flow placeholder in .app. Never restore sticky + negative margin as the desktop implementation. Document scroll geometry stays stable.
- When the sidebar is temporarily frozen/open, its desktop panel MUST be **flex-direction:column**: FLYMPUS wordmark with its approved optical left offset first, full-width vertically stacked COURSE/APP menu second, app role footer at bottom. Do not allow flex-row to place logo and navigation side by side. Keep existing 200/230ms single-canvas motion and saved scroll position.
- Desktop must use the same app-level language selection/i18n translations, RTL sidebar/right-side mirror and negative push transform, Dark theme palette, and Large Text setting as mobile. Test both languages, both themes, normal and large text when changing the shell; never force LTR/light or small fonts in desktop-specific overrides.
- Preserve mobile shell geometry and CSS unchanged when implementing desktop parity. Regression tests for desktop-specific chrome and drawer layout are in tests/pull-lifecycle.test.cjs and run in review/production gates.

## Firebase account switcher and Notifications focus (2026-10-08)
- Profile popover displays **authenticated name, email, system role** together. Sign out is an action only; never show email below Sign out.
- Add Another Account means authenticating an existing Google/Firebase identity, not creating or inviting users. Available regardless of system role.
- Each additional identity must use separate named Firebase Auth browserLocalPersistence; picker metadata is display-only, never a credential or permission grant. Only primary Auth drives Firestore, and on UID changes the app locks, server-verifies active profile, and reloads UID-scoped data. Do not expose prior user's app screen to the new UID.
- Expired secondary sessions require fresh provider sign-in. Sign out of active account leaves other accounts available; credentials are never copied to the app's own localStorage keys.
- Bell > Notification settings should directly center the Notifications **section heading** (not the full tall card) in Settings, on desktop and mobile. Avoid conflicting top-reset scroll timers. Maintain RTL, dark theme, and large-text behavior.

## Reports & Analytics · operational reporting baseline (2026-10-08)
- Three distinct in-page views: **Planned vs Executed** (default), **Course dashboard**, **Detailed analytics** (preserve existing legacy panels and filters). No outer-tab duplicate buttons.
- Only **submitted** course-scoped daily reports supply planned flight numbers. No draft/unsaved plan counts. Actual instructed flights come from submitted Evaluations, actual Solo flights from saved Solo records. Never include review/demo mock Evaluations in operational counts.
- A scheduled sortie with no execution is **NOT automatically Cancelled**. Count cancellations only where a saved reason is recorded, never above the actual shortfall; remaining shortfall is **Unclassified gap**. Unplanned execution is a separate category; do not inflate execution rate above 100%.
- Provide day/week/month grouping, date-range filtering, CSV export appropriate to current view, Print/PDF, responsive accessible charts, reason breakdown and trainee course dashboard. All data scoped to active course, user UID namespace.
- Respect Light/Dark, English/Hebrew RTL, Large Text, desktop/mobile, print, and non-floating tab controls. Client-generated CSV must escape Excel formula injection from trainee names or cancellation text.
- This architecture's pure data normalization, aggregation, export and localization is in assets/reports-dashboard.js and must be covered by tests/reports-dashboard.test.cjs (in review and production gates).
