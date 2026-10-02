const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('let flympusUiAudioCtx=null;');
const end=html.indexOf('if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)',start);
assert(start>=0&&end>start,'persistent iOS audio block must remain extractable');
const source=html.slice(start,end);

const timers=[];
const categories=[];
const gainEvents=[];
let contextCount=0;
let resumeCount=0;
let closeCount=0;
let oscillatorStarts=0;
let bufferStarts=0;
let currentCategory='auto';

const audioSession={};
Object.defineProperty(audioSession,'type',{
  get:()=>currentCategory,
  set:value=>{currentCategory=value;categories.push(value)}
});

class AudioParamStub{
  constructor(track=false){this.track=track}
  record(method,value){if(this.track)gainEvents.push({method,value,category:currentCategory})}
  setValueAtTime(value){this.record('set',value)}
  linearRampToValueAtTime(value){this.record('linear',value)}
  exponentialRampToValueAtTime(value){this.record('exponential',value)}
  cancelScheduledValues(){}
}
class NodeStub{connect(){return this}disconnect(){}}
class GainStub extends NodeStub{constructor(){super();this.gain=new AudioParamStub(true)}}
class OscillatorStub extends NodeStub{
  constructor(){super();this.frequency=new AudioParamStub();this.type='sine'}
  start(){oscillatorStarts++}
  stop(){}
}
class BufferSourceStub extends NodeStub{
  start(){bufferStarts++}
  stop(){}
}
class FilterStub extends NodeStub{
  constructor(){super();this.frequency=new AudioParamStub();this.Q={value:0};this.type='bandpass'}
}
class AudioContextStub{
  constructor(){
    contextCount++;
    this.currentTime=1;
    this.sampleRate=48000;
    this.state='suspended';
    this.destination=new NodeStub();
  }
  resume(){resumeCount++;this.state='running';return Promise.resolve()}
  close(){closeCount++;this.state='closed';return Promise.resolve()}
  createGain(){return new GainStub()}
  createOscillator(){return new OscillatorStub()}
  createBuffer(){return{getChannelData:()=>new Float32Array(128)}}
  createBufferSource(){return new BufferSourceStub()}
  createBiquadFilter(){return new FilterStub()}
}

const context={
  window:{AudioContext:AudioContextStub},
  navigator:{audioSession},
  Promise,Math,
  setTimeout:(fn,delay=0)=>{timers.push({fn,delay});return timers.length},
  clearTimeout(){},
  console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'index.html#audio'});

async function flushAsyncTimers(){
  for(let i=0;i<30;i++){
    await Promise.resolve();
    await Promise.resolve();
    if(!timers.length)continue;
    const batch=timers.splice(0);
    batch.forEach(t=>t.fn());
  }
  await Promise.resolve();
  await Promise.resolve();
}

(async()=>{
  assert(source.includes("session.type='playback'")&&source.includes("session.type='ambient'"),
    'Recovery must force a real AudioSession category transition and finish on ambient');
  assert(source.indexOf("session.type='playback'")<source.indexOf("session.type='ambient'"),
    'Recovery transition must visit playback before returning to ambient');
  assert(source.includes('FLYMPUS_UI_AUDIO_WARMUP_MS=120'),
    'First post-reload gesture must allow the native route a short warm-up');
  assert(source.includes('holdFlympusUiAudioRoute(ctx)'),
    'First post-reload gesture must keep a non-zero carrier alive while iOS opens output');
  assert(!source.includes("createElement('audio')")&&!source.includes('new Audio('),
    'Reload-safe UI audio must not depend on HTMLMediaElement playback');

  const firstContextCount=contextCount;
  const firstResumeCount=resumeCount;
  const firstAudible=gainEvents.length;

  vm.runInContext('playFlympusBottomNavSound()',context);

  assert.equal(contextCount-firstContextCount,1,
    'First nav gesture after reset must create one persistent context');
  assert.equal(resumeCount-firstResumeCount,1,
    'First nav gesture after reset must request resume inside the physical gesture');
  assert(!gainEvents.slice(firstAudible).some(e=>e.value>=.05),
    'Audible nav gain must wait until the first route-recovery warm-up completes');

  await flushAsyncTimers();

  assert(gainEvents.slice(firstAudible).some(e=>e.value>=.05&&e.category==='ambient'),
    'First nav gesture must become audible after route recovery and only once ambient is restored');
  assert.equal(currentCategory,'ambient',
    'UI sound recovery must finish Silent-switch-aware');

  const reusedContextCount=contextCount;
  const reusedAudible=gainEvents.length;
  vm.runInContext('playFlympusBottomNavSound()',context);

  assert.equal(contextCount,reusedContextCount,
    'Repeated nav gestures in the same document must reuse the recovered context');
  assert(gainEvents.slice(reusedAudible).some(e=>e.value>=.05),
    'Repeated nav gestures must emit immediately once the route is healthy');

  vm.runInContext('resetFlympusAudioSession()',context);
  assert(closeCount>=1,'pageshow/visibility reset must discard the old persistent context');

  const reloadContextCount=contextCount;
  const reloadAudible=gainEvents.length;
  vm.runInContext('playFlympusBottomNavSound()',context);
  assert.equal(contextCount-reloadContextCount,1,
    'First nav gesture after a simulated reload must create a fresh persistent context');
  assert(!gainEvents.slice(reloadAudible).some(e=>e.value>=.05),
    'First nav sound after reload must wait for route recovery instead of being lost');
  await flushAsyncTimers();
  assert(gainEvents.slice(reloadAudible).some(e=>e.value>=.05&&e.category==='ambient'),
    'First nav sound after every reload must emit after recovery');

  vm.runInContext('resetFlympusAudioSession();globalThis.__refreshGraph=armFlympusRefreshSound();fireFlympusRefreshSound(globalThis.__refreshGraph)',context);
  const refreshBefore=gainEvents.length;
  assert.equal(vm.runInContext('__refreshGraph.fired',context),true,
    'Pull-distance trigger must latch on the first refresh gesture');
  await flushAsyncTimers();
  assert.equal(vm.runInContext('__refreshGraph.emitted',context),true,
    'First refresh gesture after reload must emit after the route is ready');
  assert(gainEvents.slice(refreshBefore).some(e=>e.value>=.055&&e.category==='ambient'),
    'First refresh gesture must produce audible output after recovery');

  assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),
    'Refresh sound must remain tied to pull distance, not reload');
  assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),
    'Pull tracking must not intercept bottom-navigation touches');
  assert(html.includes('b.ontouchstart=pressSound'),
    'Bottom-navigation audio must still start from the original iOS touch gesture');

  console.log('iOS persistent-route audio lifecycle tests passed');
})().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
