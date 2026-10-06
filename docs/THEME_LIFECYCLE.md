# Theme lifecycle correction — 2026-10-06

## Recording evidence

Reviewed all 847 decoded frames (30 fps, 28.275 s) of
`ScreenRecording_10-06-2026 04-07-56_1.mp4`, including per-frame palette changes
and adjacent frames at each transition; timestamps use the video frame PTS.

- Frames 1–414: dark app, including earlier Home Screen reopen sequences.
- Frame 415, 13.800 s: selecting Light changes Settings to light.
- Around frame 470, 15.633 s: System selected; frame 481 at 16.000 s visibly
  confirms System selected while Settings remains light.
- Frames 530–560: light Home/Forms/Home navigation.
- Frame 562, 18.700 s: App Switcher still shows a light FLYMPUS snapshot.
- Around 19.6–21.6 s: Home Screen, followed by opening FLYMPUS again.
- Frame 656, 21.833 s: reopened FLYMPUS is already dark. This is a persistent
  lifecycle palette change, not merely a one-frame crossfade.

The video cannot expose DOM attributes, storage values, exact lifecycle event
order or whether iOS discarded the page. Correlation with the old code is an
inference, not a captured event trace: its delayed media listener could still
commit a transient appearance after the 1500 ms threshold. A network-loaded
bootstrap, fixed navy fallback and inconsistent root/final CSS colors were
additional first-paint paths, even though this recording does not isolate them.

## Complete writer audit

| State | Owner/path after correction |
| --- | --- |
| `data-flympus-theme`, `data-flympus-theme-mode` | Only controller `commit()`, using its in-memory decision |
| Root inline `colorScheme`, background and canvas/ink variables | Same atomic commit; dark canvas matches final CSS `#07131f`, light `#f4f8fc` |
| `meta theme-color`, `meta color-scheme` | Same commit; metadata exists before inline execution |
| Body/app colors | Existing attribute-scoped CSS; auth startup canvas/card now follow the same selection |
| `flympus-app-preferences` | Existing Settings saver; explicit selection/reset authorizes a new controller decision |
| `flympus-last-resolved-theme` | Last committed palette; legacy System migration only at bootstrap |
| `flympus-system-resolved-theme` | Separate device-level System resolution, never overwritten by Light/Dark |
| `flympus-last-visible-theme-at` | Legacy allowlisted key, no runtime reads/writes; no timestamp-based theme logic |
| `flympusResumeVisualSync` | Unused old CSS guard removed; no writer remains |
| `matchMedia('(prefers-color-scheme: dark)')` | One fallback sample if no stored System result; explicit new System selection can sample once. No listeners/resume sampling |
| `pageshow`, visible `visibilitychange` | Reassert existing decision; do not reread potentially unavailable storage or sample OS |
| Runtime preference hydration/render | Reassert only, unless explicitly selected/reset; defaults cannot overwrite first-paint choice |
| Reload content snapshots | Existing theme/language/viewport signature check retained; incompatible snapshots not restored |
| Service Worker shell | Cache version bumped; normal HTML and emergency offline HTML embed identical controller source; `/__/` bypass unchanged |

The source remains `theme-controller.js`. `sync-theme-bootstrap.cjs` embeds it
in the main head and emergency worker shell. Tests and Hosting predeploy reject
source/embedded drift. No additional theme network request precedes first paint.
Explicit palette changes suppress CSS transitions synchronously and flush final
styles in the same task; there is no timer, elapsed-time gate or delayed writer.
System intentionally retains its resolved palette across lifecycle transitions.
To resample the device setting, select Light/Dark and then System explicitly.

## Validation and physical sequence

Behavioral tests cover explicit Light/Dark against opposite stored/OS values,
late media values at multiple delays, temporary storage failure, repeated
resume, initial hydration defaults, isolated System storage across UID changes,
and the recording's Light → System light → cold reopen with OS dark sequence.
Authentication/race, Hebrew, storage, audio, worker route and existing app tests
remain required in the Hosting workflow. Production is verified by commit and
all public SHA-256 hashes plus real Firebase `/__/auth/` endpoints.

Repeat on the **Firebase-origin** installed PWA (do not clear site data):

1. Open once, then close/reopen once to let the updated worker replace its shell.
2. Select Light in Settings. Go Home, refresh, open App Switcher and return,
   go to Home Screen and reopen, then fully swipe FLYMPUS away and cold open.
   Repeat the same sequence after selecting Dark.
3. Select Light then System, noting the palette committed at selection. Repeat
   the recording's Forms → Home → App Switcher → Home Screen → reopen sequence,
   then refresh and fully terminate/reopen. The selected System palette must
   remain identical throughout. Repeat from Dark → System.
4. Repeat background/foreground and lock/unlock several times, including rapid
   refreshes. Confirm Settings selection persists and Hebrew still works.

Record the whole screen including the launch/resume transition. Distinguish app
content from iOS-owned launch splash/App Switcher snapshots: the static installed
manifest and OS compositor can paint before any JavaScript executes. This change
controls the first document paint, not iOS's pre-document imagery; no physical
zero-incorrect-frame claim is justified until the new build is recorded on the
actual device. Native splash remains branded by the existing manifest, which
cannot read persisted web preferences. Auth/PWA configuration is preserved.

## Follow-up: pull/scroll compositing (6 October 2026)

The owner's second recording (`ScreenRecording_10-06-2026 04-23-32_1.mp4`, 34.47 seconds) shows a normal skeleton at approximately 0.6–0.7 seconds, then loaded content around 0.8 seconds. It also shows pull returns and scroll chrome movement sharing the same transformed nodes, with a light seam near the status/header boundary (for example 21.7 seconds). Exact WebKit event ordering cannot be inferred from video alone.

The pull now claims transform ownership only after a downward gesture reaches the top. Ordinary touch-down no longer opens hidden chrome. Scroll chrome updates are suspended during the claimed pull and its return; CSS transitions are disabled for those nodes while owned. All return animations are awaited together and cancelled after installing resting geometry, releasing their `fill:forwards` effects. Background cancellation invalidates pending callbacks so they cannot reload a resumed page. The status-bar canvas is fixed, opaque, overlaps its boundary, and follows the selected header palette; it no longer translates with hidden chrome. The existing return curve, sound thresholds, session continuity, auth, theme decisions, and legitimate cold-start skeleton remain intact.

Regression tests replay ordinary scrolling, repeated pulls, and backgrounding an armed return. Physical validation: in both Light and Dark, scroll the roster down and quickly back to the top; perform repeated short pulls (no reload) and full pulls (reload); switch away during a pull return and reopen. Check for a boundary seam, jumping header/content, duplicate reloads, or an incorrect palette. Production browser checks cannot establish zero transient frames in physical iOS compositing.

## Follow-up: Safari browser chrome and restored top backing (6 October 2026)

The 7.07-second owner recording `ScreenRecording_10-06-2026 04-43-30_1.mp4` was captured in Safari, rather than Home Screen standalone. Frames 3.3–5.8 seconds show three independent moving systems: Safari collapses/expands its URL and toolbar chrome, FLYMPUS toggles `topHidden`/`dockHidden` and translates the full content root by 78px, and Safari begins native overscroll refresh when the fast upward page movement reaches the top. The application header disappears around 5.6 seconds and native refresh chrome occupies the exposed top canvas around 5.8 seconds. This is a sustained geometry conflict, not slow content loading or a theme decision.

Touch layouts now keep the app header, content origin and bottom dock geometrically stable while the browser manages its own chrome. Touch Safari and installed mode both route top overscroll through the same FLYMPUS pull owner; the handler can follow a gesture that starts lower in a long page, claims it only when the document reaches the top, then prevents native overscroll. Desktop pointer layouts retain auto-hide. Reload snapshots use visual version 4 and never restore hidden chrome on touch devices. The deep fixed backing above the document is restored to its previously proven 180px geometry after the preceding scroll patch accidentally reduced it to 2px and reopened the seam risk.

Regression coverage includes touch Safari starting a downward finger gesture at scroll position 500, reaching zero, claiming the custom pull and preventing native overscroll, plus repeated pull release and lifecycle cancellation. Physical verification must cover Safari and the installed app on Home, Course Roster, Forms and Reports with fast bidirectional scrolling, a short pull and a threshold-crossing reload.

## Correction: preserve owner-requested chrome animation (6 October 2026)

The owner rejected the previous touch auto-hide disablement and supplied `ScreenRecording_10-06-2026 05-00-02_1.mp4` (15.73 seconds), showing persistent blank bands during fast Safari scrolling. Disabling a requested interaction was not an acceptable fix. The small top and bottom chrome animations are restored on touch, including snapshot restoration. The long `#content` is no longer permanently promoted with `translate3d(0,0,0)` and `will-change:transform`, nor translated by a header-height offset during auto-hide. Only small chrome layers animate; the document retains normal scrolling and stable geometry. Pull translation is temporary and remains owned/cleaned up by its existing controller. Root touch overscroll suppression now exists in parsed CSS rather than only after a gesture or standalone-mode detection. The header does not hide until its original normal-flow slot has scrolled away. Visual snapshot version is 5.

Tests replay repeated touch hide/show states and verify document style is untouched, in addition to pull ownership, Safari edge capture, cancellation, theme and auth regressions. Production deployment and asset verification establish delivered code, not a zero-flash guarantee on physical WebKit. The owner should repeat their fast Safari scroll recording and confirm top/bottom auto-hide is preserved, then test Home Screen mode.
