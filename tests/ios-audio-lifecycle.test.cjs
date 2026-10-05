const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');

function wavPcm16Data(buf){
  assert.equal(buf.toString('ascii',0,4),'RIFF');assert.equal(buf.toString('ascii',8,12),'WAVE');
  let p=12;while(p+8<=buf.length){const id=buf.toString('ascii',p,p+4),len=buf.readUInt32LE(p+4),s=p+8;if(id==='data')return buf.subarray(s,s+len);p=s+len+(len&1)}
  throw new Error('WAV data chunk missing');
}
function assertPcmScaled(aPath,bPath,gain){
  const a=wavPcm16Data(fs.readFileSync(aPath)),b=wavPcm16Data(fs.readFileSync(bPath));assert.equal(a.length,b.length);
  for(let i=0;i+1<a.length;i+=2){const scaled=Math.round(a.readInt16LE(i)*gain),ex=scaled===0?0:Math.max(-32768,Math.min(32767,scaled));assert.equal(b.readInt16LE(i),ex,bPath+' PCM amplitude mismatch')}
}
assertPcmScaled('assets/flympus-nav-signature.wav','assets/flympus-nav-signature-10.wav',.10);
assertPcmScaled('assets/flympus-nav-signature.wav','assets/flympus-nav-signature-65.wav',.65);
assertPcmScaled('assets/flympus-refresh-sync.wav','assets/flympus-refresh-sync-13.wav',.13);

const claimStart=html.indexOf("if(!window.__FLYMPUS_CLAIM_NAV_SOUND_GESTURE__)");
const claimEnd=html.indexOf("/* Reload reference behavior:",claimStart);
assert(claimStart>=0&&claimEnd>claimStart);
const claimSource=html.slice(claimStart,claimEnd);
const start=html.indexOf("const FLYMPUS_NAV_SOUND_SRC=");
const end=html.indexOf('function isFlympusIOSHapticTarget',start);
assert(start>=0&&end>start);
const source=html.slice(start,end);

let now=1000,category='auto',desktop=false,resumeMode='immediate',deferredResolve=null;
let prefs={navigationSounds:true};
const mediaPlays=[],fastStarts=[],fastStops=[],fastGains=[],order=[];
const audioSession={};Object.defineProperty(audioSession,'type',{get:()=>category,set:v=>category=v});
class AudioStub{
  constructor(){this.src='';this.style={};this.readyState=4;this.currentTime=0;this.volume=1;this.muted=false}
  setAttribute(){}load(){}pause(){}
  play(){mediaPlays.push(this.src);order.push('media-play');return Promise.resolve()}
}
class Ctx{
  constructor(){this.state='suspended';this.currentTime=10;this.destination={}}
  resume(){order.push('resume');if(resumeMode==='immediate'){this.state='running';return Promise.resolve()}return new Promise(r=>{deferredResolve=()=>{this.state='running';r()}})}
  close(){this.state='closed';return Promise.resolve()}
  decodeAudioData(bytes){assert(bytes.byteLength>1000);return Promise.resolve({decoded:true})}
  createBufferSource(){
    const ctx=this,rec={buffer:null,startTime:null,stateAtStart:null,stopped:false};fastStarts.push(rec);
    return{onended:null,set buffer(v){rec.buffer=v},get buffer(){return rec.buffer},connect(){return this},
      start(t){rec.startTime=t;rec.stateAtStart=ctx.state;order.push('buffer-start')},
      stop(){rec.stopped=true;fastStops.push(rec);order.push('buffer-stop')}}
  }
  createGain(){const rec={gain:{value:1}};fastGains.push(rec);return{gain:rec.gain,connect(){return this}}}
  createOscillator(){return{frequency:{value:0},connect(){return this},start(){},stop(){}}}
}
const doc={body:{appendChild(){}},visibilityState:'visible',createElement:()=>new AudioStub(),querySelector:()=>null};
const win={AudioContext:Ctx,PointerEvent:function(){},matchMedia:q=>({matches:desktop&&String(q).includes('min-width')})};
const context={window:win,navigator:{audioSession},document:doc,performance:{now:()=>now},getFlympusAppPreferences:()=>prefs,
  Date,Math,Promise,Array,ArrayBuffer,Uint8Array,Object,Set,WeakSet,atob:s=>Buffer.from(s,'base64').toString('binary'),console};
win.window=win;vm.createContext(context);vm.runInContext(claimSource,context);vm.runInContext(source,context);
const ev=(type='touchstart',extra={})=>({type,isTrusted:true,timeStamp:now,...extra});

(async()=>{
  vm.runInContext('getFlympusNavAudioPool();primeFlympusNavFastAudio()',context);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();

  context.e=ev();order.length=0;vm.runInContext('playFlympusBottomNavSound(e)',context);
  assert.deepEqual(order.slice(0,2),['resume','buffer-start']);
  assert.equal(mediaPlays.length,0);assert.equal(fastStarts.length,1);
  assert.equal(fastStarts[0].stateAtStart,'running','No BufferSource may start while suspended');
  assert.equal(fastGains.at(-1).gain.value,.10);assert(Math.abs(fastStarts[0].startTime-10.001)<.0001);

  now+=100;const same=ev();context.e=same;
  const f0=fastStarts.length,m0=mediaPlays.length;
  vm.runInContext('playFlympusBottomNavSound(e);playFlympusBottomNavSound(e)',context);
  assert.equal(fastStarts.length,f0+1,'One physical event must produce at most one click');
  assert.equal(mediaPlays.length,m0);

  now+=100;resumeMode='deferred';
  vm.runInContext("flympusNavFastCtx.state='suspended';markFlympusNavAudioNeedsWake()",context);
  context.e=ev();const f1=fastStarts.length,m1=mediaPlays.length;order.length=0;
  vm.runInContext('playFlympusBottomNavSound(e)',context);
  assert.equal(fastStarts.length,f1,'Deferred resume must not queue WebAudio');
  assert.equal(mediaPlays.length,m1+1,'Deferred resume must use same-gesture media fallback');
  deferredResolve?.();await Promise.resolve();await Promise.resolve();
  assert.equal(fastStarts.length,f1,'Later resume completion must not emit a ghost click');

  now+=100;resumeMode='immediate';context.e=ev();vm.runInContext('playFlympusBottomNavSound(e)',context);
  assert.equal(fastStarts.length,f1+1,'Next real press may use running WebAudio');

  now+=100;const f2=fastStarts.length,m2=mediaPlays.length;
  context.e={type:'touchstart',isTrusted:false,timeStamp:now};vm.runInContext('playFlympusBottomNavSound(e)',context);
  assert.equal(fastStarts.length,f2);assert.equal(mediaPlays.length,m2);

  doc.visibilityState='hidden';now+=100;context.e=ev();vm.runInContext('playFlympusBottomNavSound(e)',context);
  assert.equal(fastStarts.length,f2);assert.equal(mediaPlays.length,m2);doc.visibilityState='visible';

  vm.runInContext('cancelFlympusPendingNavSources()',context);
  assert(fastStops.length>=1,'Lifecycle cancellation must stop tracked sources');

  prefs={navigationSounds:false};now+=100;context.e=ev();const f3=fastStarts.length,m3=mediaPlays.length;
  vm.runInContext('playFlympusBottomNavSound(e)',context);assert.equal(fastStarts.length,f3);assert.equal(mediaPlays.length,m3);

  assert(source.includes("const FLYMPUS_NAV_MOBILE_FALLBACK_SOUND_SRC='./assets/flympus-nav-signature-10.wav"));
  assert(source.includes("const FLYMPUS_NAV_DESKTOP_FALLBACK_SOUND_SRC='./assets/flympus-nav-signature-65.wav"));
  assert(source.includes("const FLYMPUS_REFRESH_SOUND_SRC='./assets/flympus-refresh-sync-13.wav"));
  assert(source.includes("if(!ctx||!buffer||ctx.state!=='running')return false"));
  assert(html.includes("playFlympusBottomNavSound(e);\n    triggerFlympusPortableHaptic(7);"));
  assert(html.includes("window.__FLYMPUS_CLAIM_NAV_SOUND_GESTURE__?.(e)"));
  assert(html.includes("cancelFlympusPendingNavSources();markFlympusNavAudioNeedsWake()"));
  assert(html.includes("if((ctx.state!=='running'||!flympusNavFastBuffer)&&getFlympusAppPreferences().navigationSounds!==false)")&&
    html.includes("playFlympusNavFileFallback();"),
    'First unavailable WebAudio path must play fallback in bottom-nav capture phase');
  console.log('Cross-platform trusted-gesture navigation audio lifecycle tests passed');
})().catch(err=>{console.error(err);process.exitCode=1});
