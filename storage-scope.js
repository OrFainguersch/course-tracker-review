/* FLYMPUS UID-scoped browser persistence.
   Loaded before application code so private runtime state is never read from
   another signed-in user's namespace on a shared browser/device. */
(()=>{
  'use strict';
  const cfg=window.FLYMPUS_FIREBASE_CONFIG||{};
  const authEnabled=cfg.enabled===true;
  const local=window.localStorage,session=window.sessionStorage;
  const proto=window.Storage?.prototype;
  if(!proto||!local||!session)return;

  const native={
    get:proto.getItem,
    set:proto.setItem,
    remove:proto.removeItem,
    key:proto.key,
    clear:proto.clear,
    length:Object.getOwnPropertyDescriptor(proto,'length')?.get
  };
  if(!native.length)return;

  const UID_SESSION_KEY='flympus-auth-scope-uid';
  const LEGACY_OWNER_KEY='flympus-auth-legacy-owner-uid';
  const MIGRATED_PREFIX='flympus-auth-legacy-migrated:';
  const USER_PREFIX='flympus:user:';
  const DEVICE_KEYS=new Set([
    'flympus-app-preferences',
    'flympus-last-resolved-theme',
    'flympus-last-visible-theme-at',
    'flympus-device-test',
    'ct-review-standalone-migration-dismissed'
  ]);

  const rawGet=(store,key)=>native.get.call(store,key);
  const rawSet=(store,key,value)=>native.set.call(store,key,String(value));
  const rawRemove=(store,key)=>native.remove.call(store,key);
  const rawKeys=store=>{
    const out=[],length=native.length.call(store);
    for(let i=0;i<length;i++){const key=native.key.call(store,i);if(key!==null)out.push(key)}
    return out
  };
  const owned=key=>typeof key==='string'&&(key.startsWith('ct-review-')||key.startsWith('flympus-'));
  const internal=key=>typeof key==='string'&&(key===UID_SESSION_KEY||key===LEGACY_OWNER_KEY||key.startsWith(MIGRATED_PREFIX)||key.startsWith(USER_PREFIX));
  const deviceKey=key=>DEVICE_KEYS.has(String(key));
  const currentUid=()=>String(rawGet(session,UID_SESSION_KEY)||'').trim();
  const prefixFor=uid=>USER_PREFIX+encodeURIComponent(uid)+':';
  const physicalKey=key=>prefixFor(currentUid())+String(key);
  const shouldScope=(store,key)=>authEnabled&&owned(String(key))&&!internal(String(key))&&!(store===local&&deviceKey(key));

  function visibleKeys(store){
    if(!authEnabled)return rawKeys(store);
    const uid=currentUid(),prefix=uid?prefixFor(uid):'';
    const result=[];
    rawKeys(store).forEach(key=>{
      if(store===local&&deviceKey(key)){result.push(key);return}
      if(internal(key)){
        if(prefix&&key.startsWith(prefix))result.push(key.slice(prefix.length));
        return
      }
      if(owned(key))return;
      result.push(key)
    });
    return [...new Set(result)]
  }

  proto.getItem=function(key){
    const logical=String(key);
    if(!shouldScope(this,logical))return rawGet(this,logical);
    const uid=currentUid();
    return uid?rawGet(this,physicalKey(logical)):null
  };
  proto.setItem=function(key,value){
    const logical=String(key);
    if(!shouldScope(this,logical))return rawSet(this,logical,value);
    const uid=currentUid();
    if(!uid)return;
    return rawSet(this,physicalKey(logical),value)
  };
  proto.removeItem=function(key){
    const logical=String(key);
    if(!shouldScope(this,logical))return rawRemove(this,logical);
    const uid=currentUid();
    if(!uid)return;
    return rawRemove(this,physicalKey(logical))
  };
  proto.key=function(index){
    if(!authEnabled)return native.key.call(this,index);
    return visibleKeys(this)[Number(index)]??null
  };
  proto.clear=function(){
    if(!authEnabled)return native.clear.call(this);
    visibleKeys(this).forEach(key=>{
      if(owned(key)&&!(this===local&&deviceKey(key)))this.removeItem(key)
    })
  };

  function setUid(uid){
    const next=String(uid||'').trim(),previous=currentUid();
    if(next)rawSet(session,UID_SESSION_KEY,next);else rawRemove(session,UID_SESSION_KEY);
    return previous!==next
  }
  function clearUid(){return setUid('')}
  function claimLegacy(uid,{admin=false}={}){
    const normalized=String(uid||'').trim();
    if(!authEnabled||!normalized||admin!==true)return{claimed:false,count:0,reason:'not-authorized'};
    const owner=String(rawGet(local,LEGACY_OWNER_KEY)||'').trim();
    if(owner&&owner!==normalized)return{claimed:false,count:0,reason:'claimed-by-another-user'};
    if(!owner)rawSet(local,LEGACY_OWNER_KEY,normalized);
    const doneKey=MIGRATED_PREFIX+encodeURIComponent(normalized);
    if(rawGet(local,doneKey)==='1')return{claimed:true,count:0,reason:'already-migrated'};
    const prefix=prefixFor(normalized);
    let count=0;
    rawKeys(local).forEach(key=>{
      if(!owned(key)||internal(key)||deviceKey(key))return;
      const target=prefix+key;
      if(rawGet(local,target)!==null)return;
      const value=rawGet(local,key);
      if(value!==null){rawSet(local,target,value);count++}
    });
    rawSet(local,doneKey,'1');
    return{claimed:true,count,reason:'migrated'}
  }
  function inspect(){
    const uid=currentUid(),prefix=uid?prefixFor(uid):'';
    return Object.freeze({enabled:authEnabled,uid,privateLocalKeys:prefix?rawKeys(local).filter(k=>k.startsWith(prefix)).length:0,legacyOwner:rawGet(local,LEGACY_OWNER_KEY)||''})
  }


  /* iOS can briefly expose the wrong System appearance while a suspended PWA
     returns from the app switcher. Hold the last visible resolved theme through
     that unstable window and accept a System change only after two matches. */
  function installResumeThemeHold(){
    const doc=window.document;
    if(!doc?.documentElement||typeof window.MutationObserver!=='function'||typeof window.setTimeout!=='function')return;
    const root=doc.documentElement;
    let token=0,observer=null;
    const sampleSystem=()=>{
      try{return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light'}
      catch{return String(root.getAttribute('data-flympus-theme')||'light')}
    };
    const readPrefs=()=>{try{return JSON.parse(rawGet(local,'flympus-app-preferences')||'{}')||{}}catch{return{}}};
    const commit=(theme,persist=false)=>{
      const resolved=theme==='dark'?'dark':'light',dark=resolved==='dark';
      root.setAttribute('data-flympus-theme',resolved);
      root.style.colorScheme=resolved;
      root.style.backgroundColor=dark?'#091522':'#f4f8fc';
      doc.querySelector?.('meta[name="theme-color"]')?.setAttribute('content',dark?'#07131f':'#07294c');
      doc.querySelector?.('meta[name="color-scheme"]')?.setAttribute('content',resolved);
      if(persist){
        rawSet(local,'flympus-last-resolved-theme',resolved);
        rawSet(local,'flympus-last-visible-theme-at',Date.now())
      }
    };
    const begin=()=>{
      if(doc.visibilityState==='hidden')return;
      const prefs=readPrefs();
      const mode=['light','dark','system'].includes(prefs.theme)?prefs.theme:'system';
      const stored=String(rawGet(local,'flympus-last-resolved-theme')||'');
      const current=String(root.getAttribute('data-flympus-theme')||'');
      const stable=mode==='dark'?'dark':mode==='light'?'light':(stored==='dark'||stored==='light'?stored:(current==='dark'||current==='light'?current:sampleSystem()));
      const my=++token;
      observer?.disconnect?.();
      root.classList.add('flympusResumeVisualSync');
      commit(stable,false);
      observer=new window.MutationObserver(()=>{
        if(my!==token)return;
        const now=String(root.getAttribute('data-flympus-theme')||'');
        if(now!==stable)commit(stable,false)
      });
      observer.observe(root,{attributes:true,attributeFilter:['data-flympus-theme']});
      if(mode!=='system'){
        window.setTimeout(()=>{
          if(my!==token)return;
          observer?.disconnect?.();
          commit(stable,true);
          (window.requestAnimationFrame||window.setTimeout)(()=>root.classList.remove('flympusResumeVisualSync'))
        },0);
        return
      }
      window.setTimeout(()=>{
        if(my!==token)return;
        const first=sampleSystem();
        window.setTimeout(()=>{
          if(my!==token)return;
          const second=sampleSystem(),resolved=first===second?second:stable;
          observer?.disconnect?.();
          commit(resolved,true);
          (window.requestAnimationFrame||window.setTimeout)(()=>root.classList.remove('flympusResumeVisualSync'))
        },180)
      },650)
    };
    doc.addEventListener?.('visibilitychange',()=>{if(doc.visibilityState==='visible')begin()},true);
    window.addEventListener?.('pageshow',begin,true);
    window.addEventListener?.('focus',()=>{if(doc.visibilityState!=='hidden')begin()},true)
  }
  installResumeThemeHold();

  window.FLYMPUS_STORAGE_SCOPE=Object.freeze({
    enabled:authEnabled,
    setUid,
    clearUid,
    currentUid,
    claimLegacy,
    inspect,
    isDeviceKey:deviceKey
  });
})();
