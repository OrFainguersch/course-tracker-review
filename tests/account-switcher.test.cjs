const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../account-switcher.js'),'utf8')
  .replace('export function createAccountSwitcher','function createAccountSwitcher');

function harness(){
  const raw=new Map(),storage={
    getItem:key=>raw.get(String(key))??null,
    setItem:(key,value)=>raw.set(String(key),String(value)),
    removeItem:key=>raw.delete(String(key))
  };
  const auths=new Map(),events=[],handlers=new Map();
  const appSdk={initializeApp:(config,name)=>({name})};
  const primary={currentUser:{uid:'uid-one',email:'one@example.com',displayName:'One'}};
  let popupUser=null;
  const authSdk={
    browserLocalPersistence:{},
    browserPopupRedirectResolver:{},
    initializeAuth(app){
      const instance={currentUser:null,authStateReady:async()=>{}};
      auths.set(app.name,instance);return instance;
    },
    async updateCurrentUser(target,user){
      events.push(['update',target===primary?'primary':'secondary',user.uid]);
      target.currentUser=user;
    },
    async signInWithPopup(target){
      events.push(['popup']);
      if(!popupUser)throw Error('No popup account');
      target.currentUser=popupUser;
      return {user:popupUser}
    },
    async signOut(target){events.push(['signout']);target.currentUser=null},
    GoogleAuthProvider:class{}
  };
  const document={
    documentElement:{getAttribute:()=> 'en'},
    getElementById:()=>null,
    addEventListener:(type,fn)=>handlers.set(type,fn)
  };
  const ctx={document,localStorage:storage,console,Map,Set,Promise,JSON,String,Number,Error};
  vm.createContext(ctx);
  vm.runInContext(source,ctx,{filename:'account-switcher.js'});
  const getCurrent=()=>({user:primary.currentUser,profile:{status:'active',role:'owner',displayName:primary.currentUser?.displayName||''}});
  const switcher=ctx.createAccountSwitcher({
    authSdk,appSdk,config:{firebase:{projectId:'test'}},
    getPrimaryAuth:()=>primary,getCurrent,
    lockApp:()=>events.push(['lock']),showLoading:()=>events.push(['loading']),
    unlockApp:()=>events.push(['unlock']),onFailure:()=>events.push(['failure'])
  });
  return {switcher,auths,raw,events,primary,setPopupUser:u=>popupUser=u};
}
const u1={uid:'uid-one',email:'one@example.com',displayName:'One'};
const u2={uid:'uid-two',email:'two@example.com',displayName:'Two'};

test('additional account uses an isolated Firebase Auth, then a verified reload handoff can occur',async()=>{
  const h=harness();
  await h.switcher.remember(u1,{status:'active',role:'owner',displayName:'One'});
  assert.equal(h.auths.get('flympus-account-1').currentUser.uid,u1.uid);
  h.setPopupUser(u2);
  await h.switcher.add('google');
  assert.equal(h.primary.currentUser.uid,u2.uid);
  assert(h.events.some(x=>x[0]==='lock'));
  assert(h.events.some(x=>x[0]==='update'&&x[1]==='primary'&&x[2]===u2.uid));
  assert.equal(h.auths.get('flympus-account-1').currentUser.uid,u1.uid);
  assert.equal(h.auths.get('flympus-account-2').currentUser.uid,u2.uid);
  const metadata=JSON.parse(h.raw.get('firebase:flympus:account-slots-v1'));
  assert.equal(metadata.length,2);
  assert(!JSON.stringify(metadata).includes('token'));
  assert(!JSON.stringify(metadata).includes('refreshToken'));
  await h.switcher.remember(u2,{status:'active',role:'user',displayName:'Two'});
  await h.switcher.select(u1.uid);
  assert.equal(h.primary.currentUser.uid,u1.uid);
  assert.equal(h.events.filter(x=>x[0]==='popup').length,1,'Reusing saved account must not reopen provider popup');
});

test('an expired secondary session never replaces active primary identity',async()=>{
  const h=harness();
  await h.switcher.remember(u1,{status:'active',role:'owner',displayName:'One'});
  h.setPopupUser(u2);await h.switcher.add('google');
  await h.switcher.remember(u2,{status:'active',role:'user',displayName:'Two'});
  h.auths.get('flympus-account-1').currentUser=null;
  await h.switcher.select(u1.uid);
  assert.equal(h.primary.currentUser.uid,u2.uid);
  assert(h.events.some(x=>x[0]==='failure'));
});

test('sign out of one account forgets only that user, leaving other persisted session',async()=>{
  const h=harness();
  await h.switcher.remember(u1,{status:'active',role:'owner',displayName:'One'});
  h.setPopupUser(u2);await h.switcher.add('google');
  await h.switcher.forgetActive(u2.uid);
  const slots=JSON.parse(h.raw.get('firebase:flympus:account-slots-v1'));
  assert.equal(slots.length,1);
  assert.equal(slots[0].uid,u1.uid);
  assert.equal(h.auths.get('flympus-account-1').currentUser.uid,u1.uid);
  assert.equal(h.auths.get('flympus-account-2').currentUser,null);
});
