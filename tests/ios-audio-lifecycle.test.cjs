const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('let flympusUiAudioGeneration=');
const end=html.indexOf('if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)',start);
assert(start>=0&&end>start,'iOS audio block must remain extractable');
const source=html.slice(start,end);

assert(source.includes("navigator.audioSession.type='ambient'"),
  'UI audio must end in ambient mode so non-essential sounds remain non-intrusive');
assert(!source.includes("audioSession.type='playback'"),
  'First post-refresh gesture must not be consumed by playback→ambient route recovery');
assert(!source.includes('AudioContext'),
  'Reload-sensitive UI sounds should not depend on WebAudio lifecycle');
assert(source.includes('getFlympusNavAudioPool()'),
  'Navigation sounds must use a persistent preloaded media pool');
assert(source.includes('getFlympusRefreshAudioPool()'),
  'Refresh sounds must use a persistent preloaded media pool');
assert(source.includes("a.loop=true;\n    a.muted=true;"),
  'Refresh media must be primed muted inside touchstart');
assert(source.includes("a.loop=false;\n    a.currentTime=0;\n    a.muted=false;"),
  'Refresh threshold must reveal and restart the already-authorized media element');
assert(source.includes('warmFlympusUiAudioMedia();'),
  'Tiny local WAV assets must preload before the first interaction');

assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),
  'Refresh sound must remain tied to pull distance, not reload');
assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),
  'Pull tracking must not intercept bottom-navigation touches');
assert(html.includes('b.ontouchstart=pressSound'),
  'Bottom-navigation sound must run synchronously on the original iOS touchstart');
assert(html.includes('playFlympusBottomNavSound()'),
  'Navigation gesture handler must invoke the media-backed sound immediately');

console.log('iOS media audio lifecycle tests passed');
