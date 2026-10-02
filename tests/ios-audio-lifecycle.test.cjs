const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf("const FLYMPUS_NAV_SOUND_SRC=");
const end=html.indexOf('if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)',start);
assert(start>=0&&end>start,'audio block must remain extractable');
const source=html.slice(start,end);

const mediaPlays=[];
const mediaCreated=[];
const fastStarts=[];
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
  assert(source.includes("./assets/flympus-refresh-sync.wav"),
    'Refresh must keep the selected C FLYMPUS Sync WAV');

  assert(source.includes("latencyHint:'interactive'"),
    'Navigation AudioContext must request interactive low latency');
  assert(source.includes('decodeAudioData(copy)'),
    'Selected navigation WAV must be decoded ahead of time');
  assert(source.includes('createBufferSource()'),
    'Navigation click must use an AudioBufferSourceNode');
  assert(source.includes('source.start(ctx.currentTime+.001)'),
    'Navigation click must schedule essentially immediately');

  assert.equal(mediaCreated.length,4,
    'Only two HTMLAudio nav fallbacks and two refresh players should be preloaded');
  assert.equal(mediaPlays.length,0,'Preload must not audibly play HTML media');

  vm.runInContext('unlockFlympusNavFastAudio()',context);
  await Promise.resolve();
  vm.runInContext('playFlympusBottomNavSound()',context);
  assert.equal(fastStarts.length,1,'First ready nav press must use the low-latency buffer path');
  assert.equal(mediaPlays.length,0,'Ready fast nav press must not also trigger delayed HTMLAudio');
  assert.equal(fastStarts[0].buffer?.decoded,true,'Fast path must use the decoded selected WAV');
  assert(Math.abs(fastStarts[0].startTime-10.001)<.0001,'Fast path must start 1ms ahead');
  assert.equal(category,'ambient','Fast nav sound must remain ambient');

  /* Reproduce the real iOS first-tap state: resume() has been requested by the
     gesture handler, but WebAudio has not reached "running" yet. */
  now+=100;
  const beforeFirstTapFallbackMedia=mediaPlays.length;
  const beforeFirstTapFallbackFast=fastStarts.length;
  vm.runInContext("flympusNavFastCtx.state='suspended';flympusNavFastCtx.resume=()=>Promise.resolve()",context);
  vm.runInContext('playFlympusBottomNavSound()',context);
  assert.equal(fastStarts.length,beforeFirstTapFallbackFast,
    'Suspended first tap must not be falsely consumed before AudioContext resume completes');
  assert.equal(mediaPlays.length,beforeFirstTapFallbackMedia+1,
    'Suspended first tap must use the preloaded media fallback on that same gesture');
  vm.runInContext("flympusNavFastCtx.state='running'",context);

  for(let i=0;i<12;i++){
    now+=100;
    vm.runInContext('playFlympusBottomNavSound()',context);
  }
  assert.equal(fastStarts.length,13,'Repeated nav presses must remain on the low-latency buffer path');
  assert.equal(mediaPlays.length,1,'Only the simulated suspended first tap should use HTMLAudio');

  const beforeRefreshMedia=mediaPlays.length;
  vm.runInContext('globalThis.__g=armFlympusRefreshSound()',context);
  await Promise.resolve();
  assert.equal(mediaPlays.length,beforeRefreshMedia+1,'Refresh touchstart must still arm HTMLAudio');
  const primer=mediaPlays.at(-1);
  assert(primer.src.includes('flympus-refresh-sync.wav'),'Refresh primer must use selected refresh WAV');
  assert(primer.volume<=.0001,'Refresh primer remains effectively inaudible before 44px');

  vm.runInContext('fireFlympusRefreshSound(globalThis.__g)',context);
  await Promise.resolve();
  const refresh=mediaPlays.at(-1);
  assert(refresh.src.includes('flympus-refresh-sync.wav'),'Refresh fire must keep selected refresh WAV');
  assert.equal(refresh.currentTime,0,'Refresh fire must restart from sample zero');
  assert.equal(refresh.volume,1,'Refresh fire must restore full element volume');

  assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),
    'Refresh sound threshold must stay 44px');
  assert(html.includes('const pullThreshold=96;'),
    'Actual refresh threshold must stay 96px');
  assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),
    'Pull gesture must still ignore the bottom nav');

  assert(html.includes('--dock-halo-y-nudge:-1px'),
    'Approved halo vertical centering must remain unchanged');
  assert(html.includes('class="mobileBottomHalo"')&&html.includes('function ensureBottomDockHalo()'),
    'Bottom dock must use one persistent traveling halo element');
  assert(html.includes('transition:transform .22s cubic-bezier(.22,.78,.20,1);'),
    'Persistent halo must visibly travel between destinations');
  assert(html.includes('buttonRect.width.toFixed(2)')&&html.includes('buttonRect.height.toFixed(2)'),
    'Traveling halo must keep the approved measured width and height');
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

  console.log('Low-latency nav audio, refresh audio, and traveling halo tests passed');
})().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
