const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf("const FLYMPUS_NAV_SOUND_SRC=");
const end=html.indexOf('if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)',start);
assert(start>=0&&end>start,'clean file-audio block must remain extractable');
const source=html.slice(start,end);

const plays=[];
const created=[];
let now=1000;
let category='auto';

const audioSession={};
Object.defineProperty(audioSession,'type',{
  get:()=>category,
  set:value=>{category=value}
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
    this.style={};
    created.push(this);
  }
  setAttribute(){}
  load(){}
  pause(){this.paused=true}
  play(){
    this.paused=false;
    plays.push({
      audio:this,
      src:this.src,
      currentTime:this.currentTime,
      volume:this.volume,
      muted:this.muted,
      category
    });
    return Promise.resolve();
  }
}

const documentStub={
  body:{appendChild(){}},
  createElement(tag){assert.equal(tag,'audio');return new AudioStub()}
};

const context={
  window:{PointerEvent:function(){}},
  navigator:{audioSession},
  document:documentStub,
  performance:{now:()=>now},
  Date,Math,Promise,Array,
  setTimeout:()=>1,
  clearTimeout(){},
  console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'index.html#clean-audio'});

(async()=>{
  assert(source.includes("data:audio/wav;base64,UklGR"),
    'Navigation must keep the selected C FLYMPUS Signature WAV embedded in-memory for low latency');
  const embeddedMatch=source.match(/const FLYMPUS_NAV_SOUND_SRC='data:audio\/wav;base64,([^']+)'/);
  assert(embeddedMatch,'Embedded navigation WAV must remain extractable');
  assert(Buffer.from(embeddedMatch[1],'base64').equals(fs.readFileSync('assets/flympus-nav-signature.wav')),
    'Embedded navigation audio bytes must exactly match the selected WAV file');
  assert(source.includes("./assets/flympus-refresh-sync.wav"),
    'Refresh must use the selected C FLYMPUS Sync WAV');

  const forbidden=[
    'AudioContext','webkitAudioContext','createOscillator','createGain',
    'createBuffer','flympusWavDataUri','flympusAddTone',
    'FLYMPUS_NAV_MEDIA_MARKER','FLYMPUS_REFRESH_MEDIA_MARKER',
    'recoverFlympus','holdFlympusUiAudioRoute'
  ];
  forbidden.forEach(term=>assert(!source.includes(term),'Old audio mechanism must be gone: '+term));

  assert.equal(plays.length,0,'Preload must not audibly play at boot');
  assert.equal(created.length,8,'Boot preload must create six nav players and two refresh players');
  assert(created.slice(0,6).every(a=>a.src.startsWith('data:audio/wav;base64,UklGR')),
    'Every nav player must use the exact in-memory selected WAV');
  assert(created.slice(6).every(a=>a.src.includes('flympus-refresh-sync.wav')),
    'Every refresh player must point at the selected refresh WAV');

  vm.runInContext('playFlympusBottomNavSound()',context);
  await Promise.resolve();
  assert.equal(plays.length,1,'First nav press must play immediately');
  assert.equal(plays[0].currentTime,0,'First nav press must start at sample zero');
  assert.equal(plays[0].volume,1,'Nav sound must play at full configured element volume');
  assert.equal(plays[0].muted,false,'Nav sound must never be muted');
  assert.equal(plays[0].category,'ambient','UI sound must stay in ambient audio category');

  for(let i=0;i<24;i++){
    now+=100;
    vm.runInContext('playFlympusBottomNavSound()',context);
    await Promise.resolve();
  }
  assert.equal(plays.length,25,'Repeated nav presses must keep producing sound');
  assert(plays.every(x=>x.src.startsWith('data:audio/wav;base64,UklGR')),
    'Repeated nav presses must never switch away from the selected in-memory WAV');
  assert(plays.every(x=>x.currentTime===0),
    'Every nav press must restart the selected WAV at sample zero');

  const beforeArm=plays.length;
  vm.runInContext('globalThis.__g=armFlympusRefreshSound()',context);
  await Promise.resolve();
  assert.equal(plays.length,beforeArm+1,'Refresh touchstart must arm one real media player');
  const primer=plays.at(-1);
  assert(primer.src.includes('flympus-refresh-sync.wav'),'Refresh arming must use the selected refresh WAV itself');
  assert.equal(primer.currentTime,0,'Refresh arming must start from sample zero');
  assert(primer.volume<=.0001,'Refresh arming must remain effectively inaudible before threshold');

  vm.runInContext('fireFlympusRefreshSound(globalThis.__g)',context);
  await Promise.resolve();
  assert.equal(vm.runInContext('__g.fired',context),true,'Refresh threshold must latch');
  assert.equal(plays.length,beforeArm+2,'Refresh threshold must emit the selected WAV');
  const refresh=plays.at(-1);
  assert(refresh.src.includes('flympus-refresh-sync.wav'),'Refresh fire must use the selected refresh WAV');
  assert.equal(refresh.currentTime,0,'Audible refresh must restart at sample zero');
  assert.equal(refresh.volume,1,'Audible refresh must restore normal volume');

  vm.runInContext('resetFlympusAudioSession()',context);
  now+=500;
  vm.runInContext('playFlympusBottomNavSound()',context);
  await Promise.resolve();
  assert(plays.at(-1).src.startsWith('data:audio/wav;base64,UklGR'),
    'First nav press after lifecycle reset must still use the selected in-memory WAV');
  assert.equal(plays.at(-1).currentTime,0,
    'First nav press after lifecycle reset must still start at sample zero');

  assert(html.includes('if(!pullRefreshSoundPlayed&&pullDy>=44)'),
    'Refresh sound must remain tied to the existing 44px pull threshold');
  assert(html.includes("if(e.target?.closest?.('#mobileBottomNav'))return"),
    'Pull tracking must still ignore bottom-nav touches');
  assert(html.includes('const pullThreshold=96;'),
    'Actual refresh threshold must remain unchanged');
  assert((html.match(/bindFlympusNavPressSound\(b/g)||[]).length>=2,
    'The same clean sound binding must cover mobile bottom nav and drawer/desktop nav');

  assert(html.includes('--dock-halo-y-nudge:-1px'),
    'Dock halo vertical correction must be preserved');
  assert(html.includes("halo:(()=>{"),
    'Reload snapshot must still preserve halo geometry');
  assert(html.includes("bottomNav.classList.add('dockHaloMeasured','dockHaloReady')"),
    'Reload hydration must still restore halo before paint');

  assert(html.includes("class=\"mobileBottomHalo\"")&&html.includes("function ensureBottomDockHalo()"),
    'Bottom dock must use one persistent real halo element rather than recreating a pseudo halo');
  assert(html.includes("transition:transform .22s cubic-bezier(.22,.78,.20,1);"),
    'Persistent halo should visibly travel between icons');
  assert(html.includes("--dock-halo-y-nudge:-1px")&&html.includes("buttonRect.width.toFixed(2)")&&html.includes("buttonRect.height.toFixed(2)"),
    'Traveling halo must preserve the approved size, centering and vertical nudge');
  assert(html.includes("transition:background .08s ease,color .08s ease,transform .07s ease!important;"),
    'Bottom icon press/color feedback should remain fast');
  assert(html.includes("render({fastNavigation:!!options.fastNavigation})"),
    'Bottom-nav navigation should use the fast-navigation render path');
  assert(!html.includes("setTimeout(()=>{if(token!==window.__flympusBottomNavTaskToken)return;go(target,{}, {fastNavigation:true});"),
    'Bottom navigation must not add an extra timer before switching screens');
  assert(html.includes("if(fast){setTimeout(()=>{saveUiState();renderTopCourseSwitcher();renderPersonalIdentity();syncNotificationPreferenceControls();bind()},0)}else bind()"),
    'Non-critical binding and persistence should be deferred until after fast content replacement');
  assert(html.includes("item?.classList.toggle('active',active)")&&html.includes("syncBottomDockHalo(true)"),
    'Pressed bottom-nav destination must update visually before the heavy render');

  console.log('Clean selected-WAV audio lifecycle tests passed');
})().catch(err=>{
  console.error(err);
  process.exitCode=1;
});
