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
const eventOrder=[];
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
    eventOrder.push('media-play');
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
  resume(){
    eventOrder.push('resume');
    this.state='running';
    return Promise.resolve();
  }
  close(){this.state='closed';return Promise.resolve()}
  decodeAudioData(bytes){assert(bytes.byteLength>1000);return Promise.resolve({decoded:true})}
  createBufferSource(){
    const rec={buffer:null,startTime:null};
    fastStarts.push(rec);
    return{
      set buffer(v){rec.buffer=v},
      get buffer(){return rec.buffer},
      connect(dest){assert(dest);return this},
      start(t){rec.startTime=t;eventOrder.push('buffer-start')}
    };
  }
  createGain(){
    const rec={gain:{value:1}};
    fastGains.push(rec);
    return{gain:rec.gain,connect(dest){assert(dest);return this}};
  }
  createOscillator(){
    return{frequency:{value:0},connect(dest){assert(dest);return this},start(){},stop(){}};
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

  /* Cold/reload first press: buffer is decoded but context is suspended. The
     buffer must be queued before resume and no media fallback may add latency. */
  eventOrder.length=0;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(fastStarts.length,1,'First press must queue the decoded WebAudio click immediately');
  assert.equal(mediaPlays.length,0,'Ready first press must not route through delayed HTMLAudio');
  assert.deepEqual(eventOrder.slice(0,2),['buffer-start','resume'],
    'Decoded click must be scheduled before AudioContext resume work');
  assert.equal(fastStarts[0].buffer?.decoded,true,'First press must use the decoded selected signature WAV');
  assert.equal(fastGains.at(-1)?.gain?.value,.10,'Mobile first-press gain must remain 10 percent');
  assert(Math.abs(fastStarts[0].startTime-10.001)<.0001,'First click must be queued only 1 ms ahead');

  await Promise.resolve();
  now+=100;
  eventOrder.length=0;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(fastStarts.length,2,'Warm second press must stay on WebAudio');
  assert.equal(mediaPlays.length,0,'Warm second press must not use media fallback');
  assert.equal(eventOrder[0],'buffer-start','Warm press must start audio immediately');

  /* Foreground/reload lifecycle flag must not reintroduce the fallback delay
     when the decoded buffer is still available. */
  now+=100;
  vm.runInContext("markFlympusNavAudioNeedsWake();flympusNavFastCtx.state='suspended'",context);
  eventOrder.length=0;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(fastStarts.length,3,'First press after a wake flag must still queue WebAudio immediately');
  assert.equal(mediaPlays.length,0,'Wake-flag press must not regress to HTMLAudio when buffer is ready');
  assert.deepEqual(eventOrder.slice(0,2),['buffer-start','resume'],
    'Wake-flag press must queue audio before resume');

  /* If a user beats decode, the preloaded media file remains a safety net. */
  now+=100;
  vm.runInContext("flympusNavFastBuffer=null;flympusNavFastCtx.state='running'",context);
  const mediaBeforeDecodeRace=mediaPlays.length;
  vm.runInContext("playFlympusBottomNavSound()",context);
  assert.equal(mediaPlays.length,mediaBeforeDecodeRace+1,'Decode-race press must still have a synchronous fallback');
  assert(mediaPlays.at(-1).src.includes('flympus-nav-signature-10.wav'),'Mobile fallback must use the baked 10 percent WAV');

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
  assert(source.includes("const queued=scheduleFlympusNavFastBuffer(ctx,buffer,{wake:false});"),
    'Ready first press must queue WebAudio without the old wake delay');
  assert(html.includes("playFlympusBottomNavSound();\n    triggerFlympusPortableHaptic(7);\n    playFlympusDockPressZoom(el);"),
    'Runtime physical press must request audio before forced layout/zoom work');

  const earlyStart=html.indexOf('const handleEarlyBottomNavPress=e=>{');
  const earlyEnd=html.indexOf("if(snapMatches&&content)",earlyStart);
  const early=html.slice(earlyStart,earlyEnd);
  assert(early.indexOf('__FLYMPUS_EARLY_NAV_SOUND_AT__')<early.indexOf("const pressedItem=btn.closest"),
    'Hydration press must request audio before dock animation and layout measurement');
  assert(early.includes("addEventListener?.('pointerdown'"),
    'Hydration first-press path must cover desktop pointer input as well as touch');
  assert(html.includes("el.ontouchstart=press")&&html.includes("el.onpointerdown=e=>{if(e?.pointerType!=='touch')press(e)}"),
    'Normal first-press path must remain cross-platform');
  assert(html.includes("if(!pullRefreshSoundPlayed&&pullDy>=44)")&&html.includes('const pullThreshold=96;'),
    'Pull-to-refresh behavior must remain unchanged');

  console.log('Cross-platform first-press navigation audio timing tests passed');
})().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
