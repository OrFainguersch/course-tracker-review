const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('let flympusUiAudioGestureSerial=0;');
const end=html.indexOf('if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)',start);
assert(start>=0&&end>start,'gesture-scoped iOS audio block must remain extractable');
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
  setTimeout:fn=>{timers.push(fn);return timers.length},
  clearTimeout(){},
  console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'index.html#audio'});

assert(source.includes("navigator.audioSession.type='ambient'"),
  'UI sounds must remain in ambient mode');
assert(!source.includes("type='playback'"),
  'Audio must not use playback-category recovery that consumes the first gesture');
assert(!source.includes("createElement('audio')")&&!source.includes('new Audio('),
  'Reload-safe UI audio must not depend on HTMLMediaElement playback');
assert(source.includes('createFlympusGestureAudioContext()'),
  'Each physical gesture must receive a fresh AudioContext');

for(let reload=1;reload<=5;reload++){
  vm.runInContext('resetFlympusAudioSession()',context);
  const contextsBefore=contextCount;
  const resumesBefore=resumeCount;
  const audibleBefore=gainEvents.length;

  vm.runInContext('playFlympusBottomNavSound()',context);

  assert.equal(contextCount-contextsBefore,1,
    `reload ${reload}: first nav gesture must create its own fresh context`);
  assert.equal(resumeCount-resumesBefore,1,
    `reload ${reload}: first nav gesture must synchronously request resume`);
  assert(gainEvents.slice(audibleBefore).some(e=>e.value>=.05),
    `reload ${reload}: first nav gesture must schedule an audible signature immediately`);
  assert.equal(currentCategory,'ambient',
    `reload ${reload}: first nav sound must remain Silent-switch-aware`);
}

const refreshContextsBefore=contextCount;
const refreshAudibleBefore=gainEvents.length;
vm.runInContext('globalThis.__refreshGraph=armFlympusRefreshSound();fireFlympusRefreshSound(globalThis.__refreshGraph)',context);

assert.equal(contextCount-refreshContextsBefore,1,
  'First refresh gesture after reload must create a fresh gesture context');
assert.equal(vm.runInContext('__refreshGraph.fired&&__refreshGraph.emitted',context),true,
  'Pull-distance trigger must emit on the first refresh gesture');
assert(gainEvents.slice(refreshAudibleBefore).some(e=>e.value>=.055),
  'First refresh gesture must schedule audible output without a primer gesture');
assert.equal(currentCategory,'ambient',
  'Refresh sound must remain in ambient mode');

assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),
  'Refresh sound must remain tied to pull distance, not reload');
assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),
  'Pull tracking must not intercept bottom-navigation touches');
assert(html.includes('b.ontouchstart=pressSound'),
  'Bottom-navigation audio must run on original iOS touchstart');

console.log('iOS fresh-gesture audio lifecycle tests passed');
