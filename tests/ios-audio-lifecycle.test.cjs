const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');

function wavPcm16Data(buf){
  assert.equal(buf.toString('ascii',0,4),'RIFF');
  assert.equal(buf.toString('ascii',8,12),'WAVE');
  let p=12;
  while(p+8<=buf.length){
    const id=buf.toString('ascii',p,p+4),len=buf.readUInt32LE(p+4),start=p+8;
    if(id==='data')return buf.subarray(start,start+len);
    p=start+len+(len&1);
  }
  throw new Error('WAV data chunk missing');
}
function assertPcmScaled(originalPath,scaledPath,gain){
  const a=wavPcm16Data(fs.readFileSync(originalPath)),b=wavPcm16Data(fs.readFileSync(scaledPath));
  assert.equal(a.length,b.length,scaledPath+' PCM length must match source');
  for(let i=0;i+1<a.length;i+=2){
    const expected=Math.max(-32768,Math.min(32767,Math.round(a.readInt16LE(i)*gain)));
    assert.equal(b.readInt16LE(i),expected,scaledPath+' must bake the requested amplitude into every PCM sample');
  }
}
assertPcmScaled('assets/flympus-nav-signature.wav','assets/flympus-nav-signature-31.wav',.31);
assertPcmScaled('assets/flympus-refresh-sync.wav','assets/flympus-refresh-sync-27.wav',.27);
const start=html.indexOf("const FLYMPUS_NAV_SOUND_SRC=");
const end=html.indexOf('if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)',start);
assert(start>=0&&end>start,'audio block must remain extractable');
const source=html.slice(start,end);

const mediaPlays=[];
const mediaCreated=[];
const fastStarts=[];
const fastGains=[];
let now=1000;
let category='auto';

const audioSession={};
Object.defineProperty(audioSession,'type',{get:()=>category,set:v=>{category=v}});

class AudioStub{
  constructor(){
    this.src='';this.preload='';this.playsInline=false;this.muted=false;
    this.volume=1;this.currentTime=0;this.paused=true;this.style={};
    mediaCreated.push(this);
  }
  setAttribute(){}
  load(){}
  pause(){this.paused=true}
  play(){
    this.paused=false;
    mediaPlays.push({audio:this,src:this.src,currentTime:this.currentTime,volume:this.volume,muted:this.muted,category});
    return Promise.resolve();
  }
}

class AudioContextStub{
  constructor(options={}){
    this.options=options;
    this.state='suspended';
    this.currentTime=10;
    this.destination={};
  }
  resume(){this.state='running';return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
  decodeAudioData(bytes){assert(bytes.byteLength>1000);return Promise.resolve({decoded:true})}
  createBufferSource(){
    const rec={buffer:null,connected:false,startTime:null};
    fastStarts.push(rec);
    return{
      set buffer(v){rec.buffer=v},
      get buffer(){return rec.buffer},
      connect(dest){assert(dest);rec.connected=true},
      start(t){rec.startTime=t}
    };
  }
  createGain(){
    const rec={gain:{value:1},connected:false};
    fastGains.push(rec);
    return{
      gain:rec.gain,
      connect(dest){assert(dest);rec.connected=true}
    };
  }
}

const documentStub={
  body:{appendChild(){}},
  createElement(tag){assert.equal(tag,'audio');return new AudioStub()},
  addEventListener(){}
};

const context={
  window:{PointerEvent:function(){},AudioContext:AudioContextStub},
  navigator:{audioSession},
  document:documentStub,
  performance:{now:()=>now},
  Date,Math,Promise,Array,ArrayBuffer,Uint8Array,
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  setTimeout:()=>1,
  clearTimeout(){},
  console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'index.html#audio'});

(async()=>{
  await Promise.resolve();
  await Promise.resolve();

  const embeddedMatch=source.match(/const FLYMPUS_NAV_SOUND_SRC='data:audio\/wav;base64,([^']+)'/);
  assert(embeddedMatch,'Embedded navigation WAV must remain extractable');
  assert(Buffer.from(embeddedMatch[1],'base64').equals(fs.readFileSync('assets/flympus-nav-signature.wav')),
    'Fast navigation sound must use the exact selected C FLYMPUS Signature WAV bytes');
  assert(source.includes("./assets/flympus-refresh-sync-27.wav"),
    'Refresh must keep the selected FLYMPUS Sync waveform with 27 percent baked amplitude');

  assert(source.includes("latencyHint:'interactive'"),
    'Navigation AudioContext must request interactive low latency');
  assert(source.includes('decodeAudioData(copy)'),
    'Selected navigation WAV must be decoded ahead of time');
  assert(source.includes('createBufferSource()'),
    'Navigation click must use an AudioBufferSourceNode');
  assert(source.includes('source.start(ctx.currentTime+.001)'),
    'Navigation click must schedule essentially immediately');
  assert(source.includes('const FLYMPUS_NAV_SOUND_VOLUME=.31')&&source.includes('const FLYMPUS_REFRESH_SOUND_VOLUME=.27'),
    'Bottom-nav and refresh target levels must remain 31 and 27 percent');
  assert(source.includes("FLYMPUS_NAV_FALLBACK_SOUND_SRC='./assets/flympus-nav-signature-31.wav")&&source.includes("FLYMPUS_REFRESH_SOUND_SRC='./assets/flympus-refresh-sync-27.wav"),
    'HTMLAudio paths must use physically attenuated WAV files so browsers cannot bypass the requested levels');
  assert(source.includes('currentTime is frozen while suspended'),
    'First post-refresh click must be scheduled before AudioContext resume');

  assert.equal(mediaCreated.length,4,
    'Only two HTMLAudio nav fallbacks and two refresh players should be preloaded');
  assert.equal(mediaPlays.length,0,'Preload must not audibly play HTML media');

  vm.runInContext('unlockFlympusNavFastAudio()',context);
  await Promise.resolve();
  vm.runInContext('playFlympusBottomNavSound()',context);
  assert.equal(fastStarts.length,1,'First ready nav press must use the low-latency buffer path');
  assert.equal(mediaPlays.length,0,'Ready fast nav press must not also trigger delayed HTMLAudio');
  assert.equal(fastStarts[0].buffer?.decoded,true,'Fast path must use the decoded selected WAV');
  assert.equal(fastGains[0]?.gain?.value,.31,'WebAudio navigation click must use the 31 percent gain');
  assert(Math.abs(fastStarts[0].startTime-10.001)<.0001,'Fast path must start 1ms ahead');
  assert.equal(category,'ambient','Fast nav sound must remain ambient');

  /* Reproduce the first post-refresh state: decoded buffer is ready while the
     AudioContext is still suspended. The click must be queued before resume. */
  now+=100;
  const beforeFirstTapMedia=mediaPlays.length;
  const beforeFirstTapFast=fastStarts.length;
  vm.runInContext("flympusNavFastCtx.state='suspended'",context);
  vm.runInContext('playFlympusBottomNavSound()',context);
  assert.equal(fastStarts.length,beforeFirstTapFast+1,
    'Suspended first post-refresh tap must queue WebAudio immediately');
  assert.equal(mediaPlays.length,beforeFirstTapMedia,
    'Suspended first post-refresh tap must not wait on HTMLAudio startup');
  assert.equal(fastGains.at(-1)?.gain?.value,.31,
    'Queued first post-refresh click must keep the requested 31 percent gain');

  for(let i=0;i<12;i++){
    now+=100;
    vm.runInContext('playFlympusBottomNavSound()',context);
  }
  assert.equal(fastStarts.length,beforeFirstTapFast+13,'Repeated nav presses must remain on the low-latency buffer path');
  assert.equal(mediaPlays.length,beforeFirstTapMedia,'Normal nav presses must not add HTMLAudio playback once WebAudio is available');

  const beforeRefreshMedia=mediaPlays.length;
  vm.runInContext('globalThis.__g=armFlympusRefreshSound()',context);
  await Promise.resolve();
  assert.equal(mediaPlays.length,beforeRefreshMedia+1,'Refresh touchstart must still arm HTMLAudio');
  const primer=mediaPlays.at(-1);
  assert(primer.src.includes('flympus-refresh-sync-27.wav'),'Refresh primer must use the physically attenuated 27 percent WAV');
  assert.equal(primer.muted,true,'Refresh primer must be fully muted before a real pull reaches 44px');
  assert.equal(primer.volume,1,'Physically attenuated refresh media must remain at unity element volume');

  vm.runInContext('fireFlympusRefreshSound(globalThis.__g)',context);
  await Promise.resolve();
  const refresh=mediaPlays.at(-1);
  assert(refresh.src.includes('flympus-refresh-sync-27.wav'),'Refresh fire must use the physically attenuated 27 percent WAV');
  assert.equal(refresh.currentTime,0,'Refresh fire must restart from sample zero');
  assert.equal(refresh.volume,1,'Physically attenuated refresh media must remain at unity element volume');
  assert.equal(refresh.muted,false,'Refresh fire must unmute only at the actual pull threshold');

  assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),
    'Refresh sound threshold must stay 44px');
  assert(html.includes('const pullThreshold=96;'),
    'Actual refresh threshold must stay 96px');
  assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),
    'Pull gesture must still ignore the bottom nav');
  assert(!html.includes("document.addEventListener('touchstart',unlock"),
    'Arbitrary screen touchstart must never unlock or trigger navigation audio');
  assert(html.includes('Only a bottom-nav press may touch its AudioContext'),
    'Code must document the strict audio boundary: bottom-nav only for nav audio');

  assert(html.includes('REFERENCE BASELINE · 2026-10-02 · commit 0666b046'),
    'Approved slot-centered halo state must remain pinned to concrete reference commit 0666b046');
  assert(html.includes('Previous audio/post-refresh reference: commit 64960d03'),
    'Earlier audio/post-refresh reference must remain documented');
  assert(html.includes('CROSS-PLATFORM BASELINE: halo geometry, press zoom, navigation timing and'),
    'Reference behavior must explicitly remain cross-platform rather than iPhone-only');
  assert(html.includes("el.ontouchstart=press")&&html.includes("el.onpointerdown=e=>{if(e?.pointerType!=='touch')press(e)}"),
    'Bottom-nav press behavior must support touch devices and non-touch pointer browsers');
  assert(html.includes('--dock-halo-y-nudge:-1px'),
    'Approved halo vertical centering must remain unchanged');
  assert(html.includes('class="mobileBottomHalo"')&&html.includes('function ensureBottomDockHalo()'),
    'Bottom dock must use one persistent traveling halo element');
  assert(html.includes('transition:transform .22s cubic-bezier(.22,.78,.20,1);'),
    'Persistent halo must visibly travel between destinations');
  assert(html.includes('function bottomDockLayoutBox(el,dock)')&&html.includes('width=buttonBox.width')&&html.includes('height=buttonBox.height'),
    'Traveling halo must derive size from untransformed layout metrics');
  assert(html.includes('x=itemBox.x+(itemBox.width-width)/2'),
    'Traveling halo must be centered horizontally on the actual navigation slot');
  assert(html.includes('class="mobileBottomHapticSwitch"')&&html.includes('flympusDirectHapticOverlayHtml()'),
    'iOS bottom-nav taps must use a real transparent WebKit switch target for direct native haptics');
  assert(html.includes("s.ontouchstart=e=>b.ontouchstart?.(e)"),
    'The iOS haptic overlay must forward touchstart to the existing immediate sound/navigation path');
  assert(html.includes("closest?.('.mobileBottomIconButton,.mobileBottomHapticSwitch')"),
    'Bottom-nav touchend protection must not cancel the native iOS haptic switch default action');
  assert(html.includes('triggerFlympusPortableHaptic(9)'),
    'Pull threshold must request haptic feedback where the Vibration API exists');
  assert(html.includes("render({fastNavigation:!!options.fastNavigation})"),
    'Bottom navigation must keep the fast render path');
  assert(html.includes("const flympusBottomScreenTemplates=new Map()"),
    'Bottom-bar root screens must have an in-memory pre-render cache');
  assert(html.includes("requestIdleCallback")&&html.includes("prewarmFlympusBottomScreens()"),
    'Bottom-bar screens must pre-render during idle time');
  assert(html.includes("mountFlympusFastScreen(state.screen)"),
    'Fast bottom navigation must mount the prepared screen instead of rebuilding it when available');
  assert(html.includes("function scheduleFlympusBottomNavigation(target)")&&html.includes("requestAnimationFrame(afterPaint)")&&html.includes("setTimeout(commit,0)"),
    'Physical bottom-nav presses must yield one paint before screen DOM work so audio and halo motion are not blocked');
  assert(html.includes("scheduleFlympusBottomNavigation(target);"),
    'Bottom-nav activation must use the post-paint navigation scheduler');
  assert(html.includes('handleEarlyBottomNavPress')&&html.includes('__FLYMPUS_EARLY_NAV_TARGET__'),
    'Reload hydration must capture the first physical bottom-nav press instead of dropping it');
  assert(html.includes("['roster','planned','home','record','reports'].includes(earlyNavTarget)"),
    'Queued hydration tap must be consumed as soon as the real runtime becomes ready');
  assert(html.includes('function playFlympusDockPressZoom(el)')&&html.includes("playFlympusDockPressZoom(el);"),
    'Physical bottom-nav taps must trigger the Facebook-reference press zoom without delaying navigation');
  assert(html.includes('34%{transform:scale(1.018)}')&&html.includes('32%{scale:1.115}'),
    'Normal press punch must be clearly visible while remaining below the repeat-active emphasis');
  assert(html.includes('scale:1.036!important')&&html.includes('32%{scale:1.016}'),
    'Normal pressed item zoom must remain geometry-safe and visibly stronger than the previous reference');
  assert(html.includes('32%{transform:scale(1.024)}')&&html.includes('30%{scale:1.145}'),
    'Already-active destination must receive the stronger Facebook-like repeat pulse');
  assert(html.includes("const repeatActive=item.classList.contains('active')")&&html.includes("dock.classList.add('dockPressRepeat')"),
    'Runtime must distinguish a repeat tap on the already-active bottom destination');
  assert(html.includes('VISUAL ONLY: do not change layout, hit targets, halo measurements'),
    'Press zoom must remain explicitly visual-only so approved halo geometry stays untouched');
  assert(html.includes('offset* values are layout geometry')&&html.includes('clientTop'),
    'Halo geometry must remain immune to press transforms while preserving the approved vertical baseline');

  console.log('Low-latency nav audio, refresh audio, and traveling halo tests passed');
})().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
