/* Run on the existing FLYMPUS origin. No network calls, cache clearing,
   authentication export or source-data deletion. Every account stays scoped. */
(function(root){
  'use strict';
  const FORMAT='flympus-device-backup-v1',PHOTO_DB='flympus-safety-photos-v1';
  const DEVICE_KEYS=new Set(['flympus-app-preferences','flympus-last-resolved-theme','flympus-system-resolved-theme',
    'flympus-last-visible-theme-at','flympus-device-test','ct-review-standalone-migration-dismissed']);
  const prefix=uid=>'flympus:user:'+encodeURIComponent(uid)+':';
  function logicalKey(key){
    if(key.startsWith('flympus:user:'))return key.slice(key.indexOf(':',13)+1);
    return key;
  }
  function allowedKey(key){
    const logical=logicalKey(String(key));
    return /^(ct-review-|flympus-)/.test(logical)&&!/^flympus-auth-/.test(logical);
  }
  function validate(payload){
    if(payload?.format!==FORMAT||!payload.uid||!payload.origin||!Array.isArray(payload.photos))throw new Error('Invalid FLYMPUS backup');
    for(const store of ['local','session']){
      if(!payload[store]||typeof payload[store]!=='object'||Array.isArray(payload[store]))throw new Error('Invalid storage snapshot');
      for(const [key,value] of Object.entries(payload[store]))
        if(!allowedKey(key)||typeof value!=='string')throw new Error('Backup contains an unsupported storage key');
    }
    const photoKeys=new Set();
    for(const photo of payload.photos){
      let parts;try{parts=JSON.parse(photo.key)}catch{}
      if(!Array.isArray(parts)||parts.length!==3||parts.some(x=>typeof x!=='string')||
         !/^[\w-]{6,100}$/.test(parts[2])||photoKeys.has(photo.key)||typeof photo.base64!=='string'||
         !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo.base64)||
         !/^image\//.test(photo.type||''))throw new Error('Invalid Safety photo record');
      photoKeys.add(photo.key);
    }
    return payload;
  }
  function plan(source,target,uid){
    validate(source);validate(target);
    if(source.uid!==uid||target.uid!==uid)throw new Error('Sign in to the same Firebase account on both origins');
    const result={missing:[],identical:[],conflicts:[],archived:[]};
    for(const store of ['local','session'])for(const [key,value] of Object.entries(source[store])){
      const item={store,key,value};
      const own=key.startsWith(prefix(uid));
      const device=store==='local'&&DEVICE_KEYS.has(key);
      if(!own&&!device){result.archived.push(item);continue}
      if(!Object.hasOwn(target[store],key))result.missing.push(item);
      else if(target[store][key]===value)result.identical.push(item);
      else result.conflicts.push(item);
    }
    return result;
  }
  async function digest(text){
    const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function encode(payload){validate(payload);return JSON.stringify({payload,sha256:await digest(JSON.stringify(payload))},null,2)}
  async function decode(text){
    const envelope=JSON.parse(text);
    if(!envelope.sha256||await digest(JSON.stringify(envelope.payload))!==envelope.sha256)throw new Error('Backup checksum failed');
    return validate(envelope.payload);
  }
  function identity(){
    const auth=root.FLYMPUS_AUTH,uid=String(auth?.currentUser?.uid||'');
    if(auth?.status!=='active'||!uid||root.FLYMPUS_STORAGE_SCOPE?.currentUid?.()!==uid)
      throw new Error('Open FLYMPUS and wait for your account to be verified before backing up or comparing');
    return uid;
  }
  // A fresh same-origin realm gives native Storage methods, avoiding the app's
  // logical-key wrapper so hidden legacy namespaces are preserved in the file.
  function nativeStorage(){
    const iframe=root.document.createElement('iframe');iframe.hidden=true;root.document.body.appendChild(iframe);
    const proto=iframe.contentWindow.Storage.prototype;
    const api={get:proto.getItem,set:proto.setItem,remove:proto.removeItem,key:proto.key,
      length:Object.getOwnPropertyDescriptor(proto,'length').get};
    iframe.remove();return api;
  }
  function snapshot(store,api){
    const value=Object.create(null);
    for(let i=0;i<api.length.call(store);i++){
      const key=api.key.call(store,i);if(allowedKey(key))value[key]=api.get.call(store,key);
    }
    return value;
  }
  async function photos(){
    if(!root.indexedDB)throw new Error('Cannot verify Safety photo storage on this browser');
    if(typeof root.indexedDB.databases==='function'){
      const databases=await root.indexedDB.databases();
      const unknown=databases.filter(x=>/^flympus/i.test(x.name||'')&&x.name!==PHOTO_DB);
      if(unknown.length)throw new Error('An additional FLYMPUS database needs a separate backup');
      if(!databases.some(x=>x.name===PHOTO_DB))return [];
    }
    const db=await new Promise((resolve,reject)=>{
      let missing=false;const request=root.indexedDB.open(PHOTO_DB);
      request.onupgradeneeded=()=>{missing=true;request.transaction.abort()};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>missing?resolve(null):reject(request.error);
      request.onblocked=()=>reject(new Error('Close other FLYMPUS tabs before retrying the photo backup'));
    });
    if(!db)return [];
    let rows;
    try{
      if(!db.objectStoreNames.contains('photos'))throw new Error('Unexpected Safety database structure');
      rows=await new Promise((resolve,reject)=>{
        const result=[],tx=db.transaction('photos','readonly'),request=tx.objectStore('photos').openCursor();
        request.onsuccess=()=>{const cursor=request.result;if(cursor){result.push({key:cursor.key,blob:cursor.value});cursor.continue()}};
        tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
    }finally{db.close()}
    return Promise.all(rows.map(async row=>({key:row.key,type:row.blob.type,base64:await new Promise((resolve,reject)=>{
      const reader=new root.FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(reader.error);reader.readAsDataURL(row.blob);
    })})));
  }
  function forms(){
    return Array.from(root.document.querySelectorAll('.app form')).map(form=>({id:form.id,fields:
      Array.from(form.querySelectorAll('input[name],textarea[name],select[name]'))
        .filter(x=>!['password','file','hidden'].includes(x.type)&&!/token|password|secret/i.test(x.name))
        .map(x=>({name:x.name,value:x.value,checked:!!x.checked,
          ...(x.multiple?{selectedValues:Array.from(x.selectedOptions||[],option=>option.value)}:{})}))}));
  }
  async function capture(){
    const uid=identity(),api=nativeStorage(),photoRecords=await photos();
    if(identity()!==uid)throw new Error('Account changed during backup; retry');
    return validate({format:FORMAT,uid,origin:root.location.origin,createdAt:new Date().toISOString(),
      local:snapshot(root.localStorage,api),session:snapshot(root.sessionStorage,api),photos:photoRecords,unsavedForms:forms()});
  }
  function download(text,name){
    const url=root.URL.createObjectURL(new root.Blob([text],{type:'application/json'}));
    const link=root.document.createElement('a');link.href=url;link.download=name;root.document.body.appendChild(link);link.click();link.remove();
    root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);
  }
  async function exportBackup(){
    const payload=await capture(),text=await encode(payload);
    await decode(text); // Verify round-trip, schema and checksum before downloading.
    download(text,'FLYMPUS-'+root.location.hostname+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
    return {localKeys:Object.keys(payload.local).length,sessionKeys:Object.keys(payload.session).length,photos:payload.photos.length};
  }
  async function compareBackup(text){
    const source=await decode(text),target=await capture(),result=plan(source,target,identity());
    const targetPhotos=new Map(target.photos.map(x=>[x.key,x]));
    const photoResult={missing:[],identical:[],conflicts:[],archived:[]};
    for(const photo of source.photos){
      if(JSON.parse(photo.key)[0]!==source.uid){photoResult.archived.push(photo);continue}
      const old=targetPhotos.get(photo.key);
      if(!old)photoResult.missing.push(photo);
      else if(old.type===photo.type&&old.base64===photo.base64)photoResult.identical.push(photo);
      else photoResult.conflicts.push(photo);
    }
    const counts=group=>Object.fromEntries(Object.entries(group).map(([key,value])=>[key,value.length]));
    return {storage:counts(result),photos:counts(photoResult),sourceOrigin:source.origin,targetOrigin:target.origin,
      unsavedForms:source.unsavedForms?.length||0};
  }
  async function applyMissingStorage(items,adapter,afterWrite=async()=>{}){
    const added=[];
    try{
      for(const item of items){
        const existing=adapter.get(item.key);
        if(existing===item.value)continue;
        if(existing!==null)throw new Error('Target changed after comparison; export and compare again');
        adapter.set(item.key,item.value);added.push(item);
        if(adapter.get(item.key)!==item.value)throw new Error('Storage write could not be verified');
      }
      await afterWrite();return added.length;
    }catch(error){
      for(const item of added.reverse()){
        if(adapter.get(item.key)===item.value)adapter.remove(item.key);
      }
      throw error;
    }
  }
  async function restorePhotos(records){
    if(!records.length)return;
    const db=await new Promise((resolve,reject)=>{
      const request=root.indexedDB.open(PHOTO_DB,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('photos'))request.result.createObjectStore('photos')};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Photo restore is blocked; keep both backup files and retry after closing other tabs'));
    });
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos');
        for(const record of records){
          const bytes=Uint8Array.from(root.atob(record.base64),x=>x.charCodeAt(0));
          // add(), never put(): a concurrent existing photo aborts the entire
          // transaction rather than overwriting any destination photo.
          store.add(new root.Blob([bytes],{type:record.type}),record.key);
        }
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
    }finally{db.close()}
  }
  async function restoreMissing(text,confirmation){
    if(confirmation!=='SOURCE_AND_TARGET_BACKUPS_SAVED')throw new Error('Save and verify both origin backups before importing');
    if(!['flympus.firebaseapp.com','flympus.web.app'].includes(root.location.hostname))
      throw new Error('Migration writes are allowed only on the Firebase destination');
    const source=await decode(text),target=await capture(),uid=identity(),result=plan(source,target,uid);
    const conflicts=result.conflicts.filter(x=>x.store==='local'&&x.key.startsWith(prefix(uid)));
    const targetPhotos=new Map(target.photos.map(x=>[x.key,x]));
    const records=source.photos.filter(x=>JSON.parse(x.key)[0]===uid);
    for(const photo of records){
      const old=targetPhotos.get(photo.key);
      if(old&&(old.type!==photo.type||old.base64!==photo.base64))conflicts.push({key:photo.key});
    }
    if(conflicts.length)throw new Error('Conflicting records must be reconciled before import; no data was written');
    const missingPhotos=records.filter(x=>!targetPhotos.has(x.key));
    const items=result.missing.filter(x=>x.store==='local'&&x.key.startsWith(prefix(uid)));
    if(identity()!==uid)throw new Error('Account changed before import');
    const native=nativeStorage(),store=root.localStorage;
    const storageAdded=await applyMissingStorage(items,{get:key=>native.get.call(store,key),
      set:(key,value)=>native.set.call(store,key,value),remove:key=>native.remove.call(store,key)},async()=>{
      if(identity()!==uid)throw new Error('Account changed during import');
      await restorePhotos(missingPhotos);
    });
    return {storageAdded,photosAdded:missingPhotos.length,legacyAndOtherAccountEntriesArchived:result.archived.length,
      sessionAndPreferencesNotImported:true,unsavedFormsRequireManualRecovery:source.unsavedForms?.length||0};
  }
  const api={FORMAT,allowedKey,validate,plan,encode,decode,capture,exportBackup,compareBackup,restoreMissing,applyMissingStorage};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FLYMPUS_LOCAL_BACKUP=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
