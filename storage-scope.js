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
  const UID_PERSISTED_KEY='flympus-auth-scope-last-uid';
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
  const internal=key=>typeof key==='string'&&(key===UID_SESSION_KEY||key===UID_PERSISTED_KEY||key===LEGACY_OWNER_KEY||key.startsWith(MIGRATED_PREFIX)||key.startsWith(USER_PREFIX));
  const deviceKey=key=>DEVICE_KEYS.has(String(key));
  /* The persisted UID is only a local namespace hint for cold PWA relaunches.
     It never grants server access; Firebase still verifies the real session. */
  const currentUid=()=>String(rawGet(session,UID_SESSION_KEY)||rawGet(local,UID_PERSISTED_KEY)||'').trim();
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
    if(next){
      rawSet(session,UID_SESSION_KEY,next);
      rawSet(local,UID_PERSISTED_KEY,next)
    }else{
      rawRemove(session,UID_SESSION_KEY);
      rawRemove(local,UID_PERSISTED_KEY)
    }
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
