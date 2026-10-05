const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

// Execute the production handler with controllable Firestore completion order.
// No Firebase credentials or live profile mutations are used by these tests.
const source=fs.readFileSync(path.join(__dirname,'..','auth.js'),'utf8');
const handler=source.slice(source.indexOf('async function handleSignedIn('),source.indexOf('async function boot('));
function setup({scopeChanged=false,migrated=0}={}){
  const events=[];
  const pending=new Map();
  const context={
    returningScopedSession:true,authStateVersion:1,auth:{currentUser:{uid:'first'}},
    ensureUserProfile(user){return new Promise((resolve,reject)=>pending.set(user.uid,{resolve,reject}))},
    normalizeProfile:profile=>profile,
    scheduleSilentAuthLoading(){},showLoading(){},
    showPending(user,profile){events.push(['pending',user.uid,profile.status])},
    showFatal(){events.push(['fatal'])},
    applyRoleContext(user){events.push(['role',user.uid])},
    unlockApp(){events.push(['unlock'])},
    location:{reload(){events.push(['reload'])}},
    console:{error(){}},
    window:{FLYMPUS_STORAGE_SCOPE:{
      setUid(uid){events.push(['scope',uid]);return scopeChanged},
      claimLegacy(uid){events.push(['migration',uid]);return {count:migrated}}
    }}
  };
  vm.createContext(context);
  vm.runInContext(handler,context);
  return {context,events,pending};
}

test('a delayed previous account cannot replace the newly verified account',async()=>{
  const app=setup();
  const first=app.context.handleSignedIn({uid:'first'},1);
  app.context.authStateVersion=2;
  app.context.auth.currentUser={uid:'second'};
  const second=app.context.handleSignedIn({uid:'second'},2);
  app.pending.get('second').resolve({status:'active',role:'user'});
  await second;
  app.pending.get('first').resolve({status:'active',role:'admin'});
  await first;
  assert.deepEqual(app.events,[['scope','second'],['role','second'],['unlock']]);
});

test('a stale profile error cannot lock a newer authenticated session',async()=>{
  const app=setup();
  const stale=app.context.handleSignedIn({uid:'first'},1);
  app.context.authStateVersion=2;
  app.context.auth.currentUser={uid:'second'};
  app.pending.get('first').reject(new Error('late network failure'));
  await stale;
  assert.deepEqual(app.events,[]);
});

test('sign-out while profile verification is pending cannot unlock the app',async()=>{
  const app=setup();
  const inFlight=app.context.handleSignedIn({uid:'first'},1);
  app.context.authStateVersion=2;
  app.context.auth.currentUser=null;
  app.pending.get('first').resolve({status:'active',role:'admin'});
  await inFlight;
  assert.deepEqual(app.events,[]);
});

test('UID scope change and legacy migration request exactly one reload',async()=>{
  const app=setup({scopeChanged:true,migrated:3});
  const inFlight=app.context.handleSignedIn({uid:'first'},1);
  app.pending.get('first').resolve({status:'active',role:'admin'});
  await inFlight;
  assert.deepEqual(app.events,[['scope','first'],['migration','first'],['reload']]);
});

test('blocked accounts never unlock or migrate local course data',async()=>{
  const app=setup({scopeChanged:true,migrated:3});
  const inFlight=app.context.handleSignedIn({uid:'first'},1);
  app.pending.get('first').resolve({status:'blocked',role:'admin'});
  await inFlight;
  assert.deepEqual(app.events,[['scope','first'],['pending','first','blocked']]);
});
