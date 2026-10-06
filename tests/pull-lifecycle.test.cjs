const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf("if(document.addEventListener&&!window.__flympusPullRefreshSoundBound)"),html.indexOf('let bottomNavScrollSaveTimer=null;'));
function harness(){
  const handlers=new Map(),windowHandlers=new Map(),animations=[],timers=new Map();
  const classes=()=>{const values=new Set();return {add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle(v,on){if(on)values.add(v);else values.delete(v)}}};
  const node=()=>({classList:classes(),style:{setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}},getBoundingClientRect:()=>({height:78}),animate(){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b});const animation={finished,resolve,cancelled:false,cancel(){this.cancelled=true;reject(new Error('cancelled'))}};animations.push(animation);return animation}});
  const top=node(),content=node(),dock=node(),indicator=node(),root=node(),body=node();
  const document={documentElement:root,body,visibilityState:'visible',scrollingElement:{scrollTop:0},addEventListener(type,fn){handlers.set(type,fn)}};
  const window={navigator:{standalone:true},addEventListener(type,fn){windowHandlers.set(type,fn)}};
  let reloads=0,timerId=0;
  const context={document,window,$:s=>({'.top':top,'#content':content,'#mobileBottomNav':dock,'#flympusStandaloneRefreshIndicator':indicator})[s],location:{reload(){reloads++}},performance:{now:()=>0},getComputedStyle:()=>({opacity:'1',transform:'none'}),setTimeout(fn){timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),cancelAnimationFrame(){},requestAnimationFrame(){},armFlympusRefreshSound:()=>null,stopFlympusRefreshSound(){},triggerFlympusPortableHaptic(){},fireFlympusRefreshSound(){},resetFlympusAudioSession(){}};
  vm.runInNewContext(source,context);
  const touch=(type,y)=>{const e={target:{closest:()=>null},touches:[{clientX:100,clientY:y}],cancelable:true,preventDefault(){this.prevented=true}};handlers.get(type)(e);return e};
  return {touch,handlers,windowHandlers,document,window,top,content,dock,root,body,animations,timers,reloads:()=>reloads};
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
