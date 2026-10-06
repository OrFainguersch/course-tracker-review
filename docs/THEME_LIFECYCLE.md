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
