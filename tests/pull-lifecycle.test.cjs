const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf("if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)"),html.indexOf('let bottomNavScrollSaveTimer=null;'));
test('hidden header cannot leave a permanent cover or override the authoritative page canvas',()=>{
  assert.doesNotMatch(html,/body::before/,'A fixed body cover remains visible after the header slides out');
  assert.match(html,/html,body,\.app\{background:var\(--flympus-canvas,#f4f8fc\)!important\}/);
  assert.doesNotMatch(html,/html(?:\.flympusPullRoot)?\s*\{[^}]*background:#0d3156/s,'Scroll/pull must not recolour the root canvas');
  assert.match(html,/\.flympusPullBackdrop\{[^}]*opacity:0;/s);
  assert.match(html,/body\.flympusPullActive \.flympusPullBackdrop\{opacity:1\}/);
});
function harness({standalone=true,maxTouchPoints=5}={}){
  const handlers=new Map(),windowHandlers=new Map(),animations=[],timers=new Map();
  const classes=()=>{const values=new Set();return {add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle(v,on){if(on)values.add(v);else values.delete(v)}}};
  const node=()=>({classList:classes(),style:{setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}},getBoundingClientRect:()=>({height:78}),animate(){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b});const animation={finished,resolve,cancelled:false,cancel(){this.cancelled=true;reject(new Error('cancelled'))}};animations.push(animation);return animation}});
  const top=node(),content=node(),dock=node(),indicator=node(),root=node(),body=node();
  const document={documentElement:root,body,visibilityState:'visible',scrollingElement:{scrollTop:0},addEventListener(type,fn){handlers.set(type,fn)}};
  const window={navigator:{standalone,maxTouchPoints},matchMedia:()=>({matches:maxTouchPoints>0}),addEventListener(type,fn){windowHandlers.set(type,fn)}};
  let reloads=0,timerId=0;
  const context={document,window,$:s=>({'.top':top,'#content':content,'#mobileBottomNav':dock,'#flympusStandaloneRefreshIndicator':indicator})[s],location:{reload(){reloads++}},performance:{now:()=>0},getComputedStyle:()=>({opacity:'1',transform:'none'}),setTimeout(fn){timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),cancelAnimationFrame(){},requestAnimationFrame(){},armFlympusRefreshSound:()=>null,stopFlympusRefreshSound(){},triggerFlympusPortableHaptic(){},fireFlympusRefreshSound(){},resetFlympusAudioSession(){}};
  vm.runInNewContext(source,context);
  const touch=(type,y)=>{const e={target:{closest:()=>null},touches:[{clientX:100,clientY:y}],cancelable:true,preventDefault(){this.prevented=true}};handlers.get(type)(e);return e};
  return {context,touch,handlers,windowHandlers,document,window,top,content,dock,root,body,animations,timers,reloads:()=>reloads};
}
test('ordinary touch and upward scroll never force hidden chrome open',()=>{
  const h=harness();h.document.scrollingElement.scrollTop=80;h.top.classList.add('topHidden');h.body.classList.add('topChromeHidden');
  h.touch('touchstart',100);h.touch('touchmove',70);
  assert(h.top.classList.contains('topHidden'));assert(h.body.classList.contains('topChromeHidden'));assert(!h.window.__FLYMPUS_PULL_ACTIVE__);
});
test('claimed pull owns chrome, then releases every filled animation before a second pull',async()=>{
  const h=harness();h.top.classList.add('topHidden');h.touch('touchstart',100);
  assert(!h.window.__FLYMPUS_PULL_ACTIVE__);
  assert(h.touch('touchmove',150).prevented);assert(h.window.__FLYMPUS_PULL_ACTIVE__);assert(!h.top.classList.contains('topHidden'));
  h.touch('touchend',150);assert.equal(h.animations.length,3);
  h.animations.slice(0,3).forEach(a=>a.resolve());await new Promise(setImmediate);
  assert(h.animations.every(a=>a.cancelled));assert(!h.window.__FLYMPUS_PULL_ACTIVE__);assert.equal(h.content.style.transform,undefined);assert.equal(h.timers.size,0);assert.equal(h.reloads(),0);
  h.touch('touchstart',100);h.touch('touchmove',220);h.touch('touchend',220);
  h.animations.slice(3).forEach(a=>a.resolve());await new Promise(setImmediate);
  assert.equal(h.reloads(),1);assert(h.animations.every(a=>a.cancelled));
});
test('backgrounding cancels an armed return without a stale callback reloading the app',async()=>{
  const h=harness();h.touch('touchstart',100);h.touch('touchmove',230);h.touch('touchend',230);
  h.document.visibilityState='hidden';h.handlers.get('visibilitychange')();
  await new Promise(setImmediate);
  assert(h.animations.every(a=>a.cancelled));assert.equal(h.reloads(),0);assert(!h.window.__FLYMPUS_PULL_ACTIVE__);assert.equal(h.content.style.transform,undefined);
});
test('touch Safari claims pull after a long page reaches the top and blocks native overscroll',()=>{
  const h=harness({standalone:false,maxTouchPoints:5});
  h.document.scrollingElement.scrollTop=500;
  h.touch('touchstart',100);
  h.document.scrollingElement.scrollTop=0;
  const reachedTop=h.touch('touchmove',240);
  assert(reachedTop.prevented);
  assert(h.window.__FLYMPUS_PULL_ACTIVE__);
});
test('touch chrome still hides on down-scroll and returns on up-scroll without moving document content',()=>{
  const h=harness({standalone:false,maxTouchPoints:5});
  const setter=html.slice(html.indexOf('function setBottomDockHidden(hidden)'),html.indexOf('function updateBottomDockFromScroll()'));
  vm.runInNewContext('let bottomDockLastSwitchTime=0,bottomDockTransitionLockUntil=0,bottomDockVelocity=0,bottomDockDirection=0,bottomDockDirectionTravel=0;'+setter,h.context);
  for(let i=0;i<8;i++){
    vm.runInNewContext('setBottomDockHidden(true)',h.context);
    assert(h.top.classList.contains('topHidden'));assert(h.dock.classList.contains('dockHidden'));
    assert.equal(h.content.style.transform,undefined);
    vm.runInNewContext('setBottomDockHidden(false)',h.context);
    assert(!h.top.classList.contains('topHidden'));assert(!h.dock.classList.contains('dockHidden'));
  }
});
