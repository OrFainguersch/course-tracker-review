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
- Keep the image centered horizontally for mobile and desktop, with the original aspect ratio, inside the existing sidebar brand row. It must not affect the fixed-canvas drawer timing, scroll restoration, or safe-area boundary fix.
- **Approved responsive wordmark width (2026-10-08): 198px**, the midpoint between the older 164px mobile logo and the too-large 232px replacement. Keep centering, `max-width:100%`, `height:auto`, and `object-fit:contain`. Do not reintroduce the 232px oversized presentation without an explicit new request.
