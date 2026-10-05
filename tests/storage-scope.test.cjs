const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

class StorageStub{
  constructor(){Object.defineProperty(this,'data',{value:new Map(),enumerable:false})}
  get length(){return this.data.size}
  key(index){return [...this.data.keys()][index]??null}
  getItem(key){key=String(key);return this.data.has(key)?this.data.get(key):null}
  setItem(key,value){this.data.set(String(key),String(value))}
  removeItem(key){this.data.delete(String(key))}
  clear(){this.data.clear()}
}

const localStorage=new StorageStub(),sessionStorage=new StorageStub();
localStorage.setItem('ct-review-evals:AEP-26','[{"id":"legacy"}]');
localStorage.setItem('ct-review-person-overrides','{"i1":{"name":"Legacy Admin"}}');
localStorage.setItem('flympus-app-preferences','{"theme":"dark"}');
localStorage.setItem('unrelated-origin-key','keep');

const context={window:{FLYMPUS_FIREBASE_CONFIG:{enabled:true}},Storage:StorageStub,localStorage,sessionStorage,Object,String,Set,Map,encodeURIComponent};
context.window.window=context.window;
context.window.Storage=StorageStub;
context.window.localStorage=localStorage;
context.window.sessionStorage=sessionStorage;
vm.createContext(context);
vm.runInContext(fs.readFileSync('storage-scope.js','utf8'),context,{filename:'storage-scope.js'});

const scope=context.window.FLYMPUS_STORAGE_SCOPE;
assert.equal(scope.enabled,true);
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),null,'Private legacy data must be hidden before authenticated UID resolution');
assert.equal(localStorage.getItem('flympus-app-preferences'),'{"theme":"dark"}','Device appearance preferences remain device-scoped');

assert.equal(scope.setUid('uid-admin'),true);
assert.equal(localStorage.getItem('flympus-auth-scope-last-uid'),'uid-admin','Authenticated UID scope must persist across an iOS PWA cold relaunch');
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),null,'Legacy data is not inherited merely by setting a UID');
assert.equal(scope.claimLegacy('uid-admin',{admin:false}).claimed,false,'A regular user can never claim legacy device data');
const migrated=scope.claimLegacy('uid-admin',{admin:true});
assert.equal(migrated.claimed,true);
assert.equal(migrated.count,2);
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),'[{"id":"legacy"}]','First administrator receives one-time legacy migration');

localStorage.setItem('ct-review-evals:AEP-26','[{"id":"admin-new"}]');
sessionStorage.setItem('ct-review-ui','{"screen":"reports"}');
scope.setUid('uid-user');
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),null,'Second user must not inherit administrator course data');
assert.equal(sessionStorage.getItem('ct-review-ui'),null,'Session UI state must also be UID-scoped');
assert.equal(scope.claimLegacy('uid-user',{admin:true}).reason,'claimed-by-another-user','Legacy data can only have one owner');

localStorage.setItem('ct-review-evals:AEP-26','[{"id":"user-new"}]');
sessionStorage.setItem('ct-review-ui','{"screen":"home"}');
scope.setUid('uid-admin');
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),'[{"id":"admin-new"}]');
assert.equal(sessionStorage.getItem('ct-review-ui'),'{"screen":"reports"}','Each UID must recover only its own session state');
scope.setUid('uid-user');
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),'[{"id":"user-new"}]');
assert.equal(sessionStorage.getItem('ct-review-ui'),'{"screen":"home"}');

/* Simulate iOS discarding sessionStorage while preserving localStorage between PWA launches. */
sessionStorage.removeItem('flympus-auth-scope-uid');
assert.equal(scope.currentUid(),'uid-user','Cold relaunch must recover the last authenticated UID namespace from localStorage');
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),'[{"id":"user-new"}]','Cold relaunch must immediately select only the last authenticated user namespace');

const visible=[];
for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key!==null)visible.push(key)}
assert(visible.includes('ct-review-evals:AEP-26'),'Current user sees logical private keys');
assert(!visible.some(key=>key.startsWith('flympus:user:')),'Physical UID prefixes must never leak through normal key enumeration');
assert(!visible.includes('ct-review-person-overrides'),'Unmigrated legacy keys must stay hidden from other users');
assert.equal(localStorage.getItem('unrelated-origin-key'),'keep','Unrelated origin storage remains untouched');

scope.clearUid();
assert.equal(localStorage.getItem('flympus-auth-scope-last-uid'),null,'Sign-out must remove the persisted UID scope hint');
assert.equal(localStorage.getItem('ct-review-evals:AEP-26'),null,'Sign-out removes all private runtime visibility');
console.log('UID-scoped storage tests passed');

const storageSource=fs.readFileSync('storage-scope.js','utf8');
const themeSource=fs.readFileSync('theme-controller.js','utf8');
assert(themeSource.includes('authoritative first-paint and iOS lifecycle theme controller'),'A dedicated pre-paint theme controller must own lifecycle changes');
assert(themeSource.includes('function reassertStableTheme()')&&themeSource.includes("window.addEventListener('pageshow'"),'Resume must reassert the committed theme');
assert(!storageSource.includes('installResumeThemeHold')&&!themeSource.includes('setTimeout('),'Storage scoping must not compete with the theme controller or use resume timers');

assert(storageSource.includes("const UID_PERSISTED_KEY='flympus-auth-scope-last-uid'"),'Cold PWA relaunch must have a durable UID namespace hint');
assert(storageSource.includes("rawGet(session,UID_SESSION_KEY)||rawGet(local,UID_PERSISTED_KEY)"),'Session UID must fall back to the durable namespace hint');

assert(themeSource.includes("if(now-visibleSince<1500){reassertStableTheme();return}"),'Transient iOS media-query changes during resume must be ignored');
