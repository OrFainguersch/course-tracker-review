const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('let flympusUiMediaRouteReady=false;');
const end=html.indexOf('if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)',start);
assert(start>=0&&end>start,'media-based iOS audio block must remain extractable');
const source=html.slice(start,end);

const categories=[];
const plays=[];
const created=[];
let currentCategory='auto';

const audioSession={};
Object.defineProperty(audioSession,'type',{
  get:()=>currentCategory,
  set:value=>{currentCategory=value;categories.push(value)}
});

class AudioStub{
  constructor(){
    this.src='';
    this.preload='';
    this.playsInline=false;
    this.muted=false;
    this.volume=1;
    this.currentTime=0;
    this.paused=true;
    this.loop=false;
    this.style={};
    this.listeners={};
    created.push(this);
  }
  setAttribute(){}
  addEventListener(name,fn){this.listeners[name]=fn}
  load(){}
  pause(){this.paused=true}
  play(){
    this.paused=false;
    plays.push({audio:this,currentTime:this.currentTime,muted:this.muted,volume:this.volume,category:currentCategory});
    if(this.listeners.playing)this.listeners.playing();
    return Promise.resolve();
  }
}

const body={appendChild(){}};
const documentStub={
  body,
  createElement(tag){assert.equal(tag,'audio');return new AudioStub()}
};

const context={
  window:{PointerEvent:function(){}},
  navigator:{audioSession},
  document:documentStub,
  performance:{now:()=>1000},
  Date,Math,Promise,ArrayBuffer,DataView,Uint8Array,Float32Array,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),
  setTimeout:()=>1,
  clearTimeout(){},
  console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'index.html#audio'});

(async()=>{
  assert(source.includes("navigator.audioSession.type='ambient'"),
    'UI sounds must finish in ambient mode so the silent switch remains authoritative');
  assert(!source.includes("type='playback'"),
    'The fix must not use a playback↔ambient category bounce');
  assert(source.includes("document.createElement('audio')"),
    'UI audio must use the native HTMLMediaElement route rather than WebAudio');
  assert(!source.includes('AudioContext')&&!source.includes('webkitAudioContext'),
    'The reload fix must no longer depend on AudioContext state');
  assert(source.includes('FLYMPUS_NAV_MEDIA_MARKER=.09'),
    'First nav sound must contain a short real lead-in before the audible signature');
  assert(source.includes('FLYMPUS_REFRESH_MEDIA_MARKER=5'),
    'Refresh asset must have a long non-zero lead-in that can stay armed during the pull');
  assert(source.includes('return Math.sin(Math.PI*2*600*t)*.0005'),
    'Lead-in must contain real non-zero PCM, not mute or digital silence');

  const bootPlayCount=plays.length;
  assert.equal(bootPlayCount,0,'Preloading must never play sound at boot');

  vm.runInContext('playFlympusBottomNavSound()',context);
  await Promise.resolve();
  assert.equal(plays.length,1,'First nav press must start one media element');
  assert.equal(plays[0].currentTime,0,
    'First nav press after reset must start from the route-opening lead-in');
  assert.equal(plays[0].muted,false,'First nav press must never use a muted primer');
  assert.equal(plays[0].category,'ambient','First nav press must use ambient audio');

  vm.runInContext('playFlympusBottomNavSound()',context);
  await Promise.resolve();
  assert.equal(plays.length,2,'Second nav press must also play');
  assert(Math.abs(plays[1].currentTime-.09)<.001,
    'Once the native route is healthy, later nav presses must seek straight to the sound');

  vm.runInContext('resetFlympusAudioSession();playFlympusBottomNavSound()',context);
  await Promise.resolve();
  assert.equal(plays.length,3,'First nav press after another reset must still play');
  assert.equal(plays[2].currentTime,0,
    'Every simulated reload must restore the real lead-in on the first press');

  vm.runInContext('resetFlympusAudioSession();globalThis.__g=armFlympusRefreshSound();fireFlympusRefreshSound(globalThis.__g)',context);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(vm.runInContext('__g.fired',context),true,
    'Pull threshold must latch on the first refresh gesture');
  assert.equal(vm.runInContext('__g.emitted',context),true,
    'A threshold reached before play() settles must emit as soon as the native route starts');
  assert(Math.abs(vm.runInContext('__g.audio.currentTime',context)-5)<.001,
    'Refresh sound must jump from the armed lead-in to its audible marker');
  assert(plays.slice(3).every(x=>x.muted===false),
    'Refresh arming must use unmuted non-zero media, never a muted primer');

  assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),
    'Refresh sound must remain tied to the 44px pull distance');
  assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),
    'Pull tracking must not intercept bottom-navigation touches');
  assert(html.includes('bindFlympusNavPressSound(b)'),
    'The same sound path must be used for mobile and desktop/drawer navigation');

  assert(html.includes('--dock-halo-y-nudge:-1px'),
    'Active halo must be nudged slightly upward on every viewport');
  assert(html.includes("halo:(()=>{"),
    'Reload snapshot must persist active-halo geometry');
  assert(html.includes("bottomNav.classList.add('dockHaloMeasured','dockHaloReady')"),
    'Reload hydration must restore the halo before the first post-refresh paint');

  console.log('iOS/native-media audio and dock reload lifecycle tests passed');
})().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
