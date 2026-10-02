# FLYMPUS Native Wrapper

## Rollback reference

The exact pre-native state is preserved at:

- Branch: `backup/pre-native-capacitor-2026-10-02`
- Commit: `fdcea343e2cc41a82ed95b53f803405744a78f3d`

If the native-wrapper experiment is rejected, restore from that reference rather than reconstructing the previous web state manually.

## Architecture

FLYMPUS remains web-first. The existing `index.html`, assets, responsive layouts and GitHub Pages deployment remain the source of truth.

Capacitor 8.5.2 adds native iOS/Android containers. `scripts/prepare-native-web.mjs` copies the current web source into `native-www/` before native sync.

Native-only device feedback lives in the local plugin:

`native/flympus-native-feedback`

The UI calls `FlympusNativeFeedback` only when Capacitor reports a native platform and the plugin is available. Otherwise the existing WebAudio / HTMLMediaElement / browser haptic behavior remains the automatic fallback.

## Native feedback experiment

Android uses `SoundPool` with `USAGE_ASSISTANCE_SONIFICATION` and `CONTENT_TYPE_SONIFICATION`, identifying these as UI/system-sonification sounds rather than ordinary media.

iOS uses `AudioServicesPlaySystemSound` for the short PCM UI sounds. This is the native system-sound path we are testing against the Facebook-style behavior.

Native wrappers also use platform haptic APIs first; browser/PWA builds retain their current fallback.

## Approved audio reference

- Mobile bottom bar: 10%
- Pull-to-refresh: 13%
- Desktop bottom bar: 65%

The native mobile plugin packages the approved 10% and 13% WAV assets. Desktop remains a browser layout and continues to use 65%.

## Local commands

```bash
npm install
npm run native:web
npx cap add android
npx cap add ios
npx cap sync
```

Capacitor 8 requires Node 22+. iOS builds require macOS + Xcode 26+. Android builds target SDK 36 and Java 21.

## CI

`.github/workflows/native-smoke.yml` creates fresh Android and iOS containers from the current GitHub source and compiles both. During this experiment generated `android/` and `ios/` folders are not the source of truth.
