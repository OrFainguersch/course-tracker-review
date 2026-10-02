# FLYMPUS Audio Reference

This file is the source-of-truth note for UI sound levels across every platform that runs the FLYMPUS site.

## Approved reference levels

- Mobile bottom bar: **10%**
- Pull-to-refresh: **13%**
- Desktop bottom bar only: **65%**

## Platform inheritance rule

Audio levels follow the site's layout tier rather than a hard-coded operating-system list:

- Layouts below the desktop breakpoint (currently **900 px**) use the **mobile bottom-bar 10%** reference. This covers phone layouts, mobile browsers, installed mobile PWAs/web apps, and tablet layouts while they are using the mobile UI.
- Layouts at or above the desktop breakpoint use the **desktop bottom-bar 65%** reference. This covers desktop/laptop layouts and any larger-screen layout using the desktop dock.
- The custom pull-to-refresh sound uses **13% wherever the custom pull-to-refresh interaction is enabled**.

This means a newly supported browser, OS, device class, wrapper, or PWA should inherit one of these existing layout tiers instead of introducing a new volume value unless the product reference is intentionally changed.

## Implementation requirements

1. `window.__FLYMPUS_AUDIO_REFERENCE__` is the canonical runtime reference:
   - `mobileBottomNav: 0.10`
   - `desktopBottomNav: 0.65`
   - `pullToRefresh: 0.13`
   - `desktopBreakpointPx: 900`
2. WebAudio gain must derive from this reference.
3. The first-tap / hydration fallback must select the same mobile-vs-desktop tier.
4. iOS/WebKit may ignore `HTMLMediaElement.volume`, so fallback WAV files keep attenuation baked into PCM and must match the reference:
   - `flympus-nav-signature-10.wav`
   - `flympus-nav-signature-65.wav`
   - `flympus-refresh-sync-13.wav`
5. A future audio change must update the runtime reference and the matching baked fallback asset together. Do not alter navigation timing, halo behavior, haptics, or pull thresholds as part of a volume-only change.

Last confirmed reference: **2026-10-02**.
