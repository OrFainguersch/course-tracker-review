const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');

function wavPcm16Data(buf){
  assert.equal(buf.toString('ascii',0,4),'RIFF');
  assert.equal(buf.toString('ascii',8,12),'WAVE');
  let p=12;
  while(p+8<=buf.length){
    const id=buf.toString('ascii',p,p+4),len=buf.readUInt32LE(p+4),dataStart=p+8;
    if(id==='data')return buf.subarray(dataStart,dataStart+len);
    p=dataStart+len+(len&1);
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

assertPcmScaled('assets/flympus-nav-signature.wav','assets/flympus-nav-signature-10.wav',.10);
assertPcmScaled('assets/flympus-nav-signature.wav','assets/flympus-nav-signature-65.wav',.65);
assertPcmScaled('assets/flympus-refresh-sync.wav','assets/flympus-refresh-sync-13.wav',.13);

const start=html.indexOf("const FLYMPUS_NAV_SOUND_SRC=");
const end=html.indexOf('function isFlympusIOSHapticTarget',start);
assert(start>=0&&end>start,'navigation audio block must remain extractable');
const source=html.slice(start,end);

const mediaPlays=[];
const mediaCreated=[];
const fastStarts=[];
const fastGains=[];
let now=1000;
let category='auto';
let desktop=false;
let prefs={navigationSounds:true};

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
    mediaPlays.push({src:this.src,currentTime:this.currentTime,volume:this.volume,muted:this.muted,category});
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
    const rec={buffer:null,startTime:null};
    fastStarts.push(rec);
    return{
      set buffer(v){rec.buffer=v},
      get buffer(){return rec.buffer},
      connect(dest){assert(dest);return this},
      start(t){rec.startTime=t}
    };
  }
  createGain(){
    const rec={gain:{value:1}};
    fastGains.push(rec);
    return{gain:rec.gain,connect(dest){assert(dest);return this}};
  }
  createOscillator(){
    return{
      frequency:{value:0},
      connect(dest){assert(dest);return this},
      start(){},
      stop(){}
    };
  }
}

const documentStub={
  body:{appendChild(){}},
  createElement(tag){assert.equal(tag,'audio');return new AudioStub()}
};
const context={
  window:{
    AudioContext:AudioContextStub,
    matchMedia:query=>({matches:desktop&&String(query).includes('min-width')})
  },
  navigator:{audioSession},
  document:documentStub,
  performance:{now:()=>now},
  getFlympusAppPreferences:()=>prefs,
  Date,Math,Promise,Array,ArrayBuffer,Uint8Array,Object,
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'index.html#nav-audio'});

(async()=>{
  vm.runInContext('getFlympusNavAudioPool();primeFlympusNavFastAudio()',context);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(mediaCreated.length,2,'Mobile navigation fallback pool must preload two media elements');
  assert.equal(mediaPlays.length,0,'Preloading must remain silent');
  assert.equal(category,'ambient','Navigation audio session must stay ambient');

  /* This reproduces the recording: runtime is ready, WebAudio was created by
     preload but remains suspended, and the first visible bottom-bar touch is
     the user gesture that must both sound and unlock the fast path. */
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(mediaPlays.length,1,'Cold/reload first press must synchronously play the media fallback');
  assert(mediaPlays[0].src.includes('flympus-nav-signature-10.wav'),'Mobile first-press fallback must use the baked 10 percent WAV');
  assert.equal(mediaPlays[0].volume,1,'Baked fallback must stay at unity element volume on iOS');
  assert.equal(fastStarts.length,0,'Cold first press must not depend on an asynchronously resumed WebAudio click');

  await Promise.resolve();
  await Promise.resolve();
  now+=100;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(mediaPlays.length,1,'Second press must not replay the fallback once WebAudio is awake');
  assert.equal(fastStarts.length,1,'Second press must use the decoded low-latency WebAudio path');
  assert.equal(fastStarts[0].buffer?.decoded,true,'Fast path must use the decoded selected signature WAV');
  assert.equal(fastGains.at(-1)?.gain?.value,.10,'Mobile fast navigation gain must remain 10 percent');
  assert(Math.abs(fastStarts[0].startTime-10.001)<.0001,'Warm WebAudio navigation click must start essentially immediately');

  /* Simulate the post-refresh / foreground lifecycle state. The first press
     after mark-needs-wake must again be audible synchronously, even if the
     context is suspended, and must not create a duplicate WebAudio click. */
  now+=100;
  const mediaBeforeResume=mediaPlays.length,fastBeforeResume=fastStarts.length;
  vm.runInContext("markFlympusNavAudioNeedsWake();flympusNavFastCtx.state='suspended';playFlympusBottomNavSound()",context);
  assert.equal(mediaPlays.length,mediaBeforeResume+1,'First press after reload/foreground must sound on the same gesture');
  assert.equal(fastStarts.length,fastBeforeResume,'Wake press must not double-play through WebAudio');
  await Promise.resolve();
  await Promise.resolve();

  now+=100;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(fastStarts.length,fastBeforeResume+1,'WebAudio must be ready again on the following press');

  /* A long-idle route wake uses the same safe rule: one synchronous fallback,
     then the fast path resumes. */
  now+=11000;
  const mediaBeforeIdle=mediaPlays.length,fastBeforeIdle=fastStarts.length;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(mediaPlays.length,mediaBeforeIdle+1,'First press after long idle must remain audible');
  assert.equal(fastStarts.length,fastBeforeIdle,'Idle wake must not double-play');
  await Promise.resolve();
  now+=100;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(fastStarts.length,fastBeforeIdle+1,'Fast path must resume after the idle wake press');

  prefs={navigationSounds:false};
  now+=100;
  const silentMedia=mediaPlays.length,silentFast=fastStarts.length;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(mediaPlays.length,silentMedia,'Navigation sound preference must suppress fallback audio');
  assert.equal(fastStarts.length,silentFast,'Navigation sound preference must suppress WebAudio');

  assert(source.includes("const FLYMPUS_NAV_MOBILE_FALLBACK_SOUND_SRC='./assets/flympus-nav-signature-10.wav"),
    'Mobile fallback must stay physically attenuated to 10 percent');
  assert(source.includes("const FLYMPUS_NAV_DESKTOP_FALLBACK_SOUND_SRC='./assets/flympus-nav-signature-65.wav"),
    'Desktop fallback must stay physically attenuated to 65 percent');
  assert(source.includes("const FLYMPUS_REFRESH_SOUND_SRC='./assets/flympus-refresh-sync-13.wav"),
    'Refresh fallback must keep the selected 13 percent WAV');
  assert(source.includes('const fallbackStarted=playFlympusNavFileFallback();')&&
         source.includes("if(wake||ctx.state!=='running')"),
    'Cold/reload wake path must synchronously use media fallback before WebAudio handoff');
  assert(html.includes('handleEarlyBottomNavPress')&&html.includes('ensureEarlyNavAudio()'),
    'Hydration-window bottom-nav presses must keep their own first-touch audio path');
  assert(html.includes("el.ontouchstart=press")&&html.includes("playFlympusBottomNavSound();"),
    'Runtime bottom-nav audio must stay attached directly to physical touchstart');
  assert(html.includes("if(!pullRefreshSoundPlayed&&pullDy>=44)")&&html.includes('const pullThreshold=96;'),
    'Pull-to-refresh sound and refresh thresholds must remain unchanged');

  console.log('iOS first-touch navigation audio lifecycle tests passed');
})().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
