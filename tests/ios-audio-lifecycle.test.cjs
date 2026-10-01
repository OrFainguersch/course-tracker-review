const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('let flympusUiAudioCtx=');
const end=html.indexOf('/* Put Safari back in an ambient UI-sound session',start);
assert(start>=0&&end>start,'iOS audio lifecycle block must remain extractable');
const source=html.slice(start,end)+'\nresetFlympusAudioSession();';

const timers=[];
const categories=[];
const gainEvents=[];
let oscillatorStarts=0;
let bufferStarts=0;
let currentCategory='auto';

const audioSession={};
Object.defineProperty(audioSession,'type',{
  get:()=>currentCategory,
  set:value=>{currentCategory=value;categories.push(value)}
});

class AudioParamStub{
  constructor(trackGain=false){this.trackGain=trackGain}
  record(method,value){if(this.trackGain)gainEvents.push({method,value,category:currentCategory})}
  setValueAtTime(value){this.record('set',value)}
  linearRampToValueAtTime(value){this.record('linear',value)}
  exponentialRampToValueAtTime(value){this.record('exponential',value)}
  cancelScheduledValues(){}
}
class NodeStub{
  connect(){return this}
  disconnect(){}
}
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
  constructor(){this.currentTime=1;this.sampleRate=48000;this.state='suspended';this.destination=new NodeStub()}
  resume(){this.state='running';return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
  createGain(){return new GainStub()}
  createOscillator(){return new OscillatorStub()}
  createBuffer(){return{getChannelData:()=>new Float32Array(128)}}
  createBufferSource(){return new BufferSourceStub()}
  createBiquadFilter(){return new FilterStub()}
}

const context={
  window:{AudioContext:AudioContextStub},navigator:{audioSession},Promise,Math,
  setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'index.html#audio'});

async function flushTimers(){
  for(let pass=0;pass<5;pass++){
    while(timers.length){
      timers.shift()();
      await Promise.resolve();
    }
    await new Promise(resolve=>setImmediate(resolve));
  }
}

(async()=>{
  assert(!source.includes("session.type='transient'"),'Unreliable iOS transient category must not return');
  assert(!source.includes('new Audio('),'UI sounds must not bypass Silent mode through HTMLAudio');

  for(let reload=1;reload<=5;reload++){
    const categoryStart=categories.length;
    vm.runInContext('flympusUiNeedsFreshContext=true;resetFlympusAudioSession()',context);
    const oscillatorStart=oscillatorStarts;
    const audibleStart=gainEvents.length;

    vm.runInContext('playFlympusBottomNavSound()',context);
    assert.equal(categories.at(-1),'playback',`reload ${reload}: first gesture must force a genuine category transition`);
    assert.equal(oscillatorStarts-oscillatorStart,4,`reload ${reload}: all signature sources must start synchronously on the first touch`);
    assert.equal(gainEvents.slice(audibleStart).some(e=>e.value>0&&e.category==='playback'),false,`reload ${reload}: playback recovery phase must remain inaudible`);

    await flushTimers();
    assert.deepEqual(categories.slice(categoryStart,categoryStart+3),['ambient','playback','ambient'],`reload ${reload}: recovery must finish back in Silent-switch-aware ambient mode`);
    assert(gainEvents.slice(audibleStart).some(e=>e.value>0&&e.category==='ambient'),`reload ${reload}: first requested navigation signature must fire after recovery`);
  }

  const repeatedStart=oscillatorStarts;
  vm.runInContext('playFlympusBottomNavSound()',context);
  assert.equal(oscillatorStarts-repeatedStart,4,'Subsequent navigation taps must start exactly one four-voice signature');
  await flushTimers();
  assert.equal(currentCategory,'ambient','Repeated navigation must remain in ambient mode');

  vm.runInContext('flympusUiNeedsFreshContext=true;resetFlympusAudioSession()',context);
  const refreshStart=oscillatorStarts;
  vm.runInContext('globalThis.__refreshGraph=armFlympusRefreshSound();fireFlympusRefreshSound(globalThis.__refreshGraph)',context);
  assert.equal(oscillatorStarts-refreshStart,4,'Refresh sources must be armed synchronously during touchstart');
  await flushTimers();
  assert.equal(vm.runInContext('__refreshGraph.fired&&__refreshGraph.emitted',context),true,'Pull-distance trigger must emit the armed refresh sound');
  assert.equal(currentCategory,'ambient','Refresh sound must be emitted only after ambient mode is restored');

  assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),'Refresh sound must remain tied to pull distance, not reload');
  assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),'Pull tracking must not intercept bottom-navigation touches');
  assert(html.includes('b.ontouchstart=pressSound'),'Bottom navigation audio must run on the original iOS touchstart');
  console.log('iOS audio lifecycle tests passed');
})().catch(error=>{console.error(error);process.exitCode=1});
