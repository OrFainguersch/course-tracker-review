/* FLYMPUS Safety: up to three photos per report, stored as compressed IndexedDB blobs. */
(function(root){
  'use strict';
  const MAX=3, STORE='photos';
  let dbPromise;
  function parseIds(value){
    let ids=value;
    if(typeof ids==='string'){try{ids=JSON.parse(ids)}catch{return []}}
    return Array.isArray(ids)?[...new Set(ids.filter(x=>typeof x==='string'&&/^[\w-]{6,100}$/.test(x)))].slice(0,MAX):[];
  }
  function scope(){return {uid:String(root.FLYMPUS_STORAGE_SCOPE?.currentUid?.()||'local'),course:String(root.FLYMPUS_SAFETY_COURSE?.()||'')}}
  function key(id,s){return JSON.stringify([s.uid,s.course,id])}
  function database(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!root.indexedDB)return reject(new Error('Photo storage is unavailable on this device'));
      const req=root.indexedDB.open('flympus-safety-photos-v1',1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Photo storage unavailable'));
      req.onblocked=()=>reject(new Error('Photo storage blocked'));
    }).catch(error=>{dbPromise=null;throw error});
    return dbPromise;
  }
  async function save(id,s,blob){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(blob,key(id,s));
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('Unable to save photo'));
      tx.onabort=()=>reject(tx.error||new Error('Unable to save photo'));
    });
  }
  async function read(id,s){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key(id,s));
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error||new Error('Unable to read photo'));
    });
  }
  async function remove(id,s){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).delete(key(id,s));
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('Unable to remove photo'));
    });
  }
  async function compress(file){
    if(!file||!(String(file.type||'').startsWith('image/')||/\.(jpe?g|png|webp|heic|heif)$/i.test(String(file.name||''))))throw new Error('Only image files are supported');
    if(file.size>25*1024*1024)throw new Error('Photo is too large');
    const image=await new Promise((resolve,reject)=>{
      const url=root.URL.createObjectURL(file),img=new root.Image();
      img.onload=()=>{root.URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{root.URL.revokeObjectURL(url);reject(new Error('Could not open this image'))};
      img.src=url;
    });
    const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,scale=Math.min(1,1440/Math.max(w,h));
    const canvas=root.document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Could not process this image');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not process this image')),'image/jpeg',0.76));
  }
  function dataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new root.FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('Unable to display photo'));
      reader.readAsDataURL(blob);
    });
  }
  function viewer(src){
    if(!src)return;
    root.document.querySelector('.safetyPhotoViewer')?.remove();
    const overlay=root.document.createElement('div');overlay.className='safetyPhotoViewer';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    const close=root.document.createElement('button');close.type='button';close.className='safetyPhotoViewerClose';close.textContent='×';close.setAttribute('aria-label','Close photo');
    const photo=root.document.createElement('img');photo.alt='Event photo';photo.src=src;
    const dismiss=()=>{overlay.remove();root.document.removeEventListener('keydown',onKey)};
    const onKey=e=>{if(e.key==='Escape')dismiss()};
    close.onclick=dismiss;overlay.onclick=e=>{if(e.target===overlay)dismiss()};
    overlay.append(close,photo);root.document.body.appendChild(overlay);
    root.document.addEventListener('keydown',onKey);close.focus();
  }
  function tile(id,index,s,onRemove){
    const box=root.document.createElement('div');box.className='safetyPhotoTile';
    const open=root.document.createElement('button');open.type='button';open.className='safetyPhotoOpen';open.disabled=true;
    open.textContent='…';open.setAttribute('aria-label','Open photo');
    const photo=root.document.createElement('img');photo.alt='Event photo '+(index+1);photo.hidden=true;open.appendChild(photo);box.appendChild(open);
    if(onRemove){
      const deleteButton=root.document.createElement('button');deleteButton.type='button';deleteButton.className='safetyPhotoRemove';
      deleteButton.textContent='×';deleteButton.setAttribute('aria-label','Remove photo');
      deleteButton.onclick=()=>onRemove(id);box.appendChild(deleteButton);
    }
    read(id,s).then(blob=>{if(!blob)throw new Error('Not found');return dataUrl(blob)}).then(src=>{
      const active=scope();
      if(!box.isConnected||active.uid!==s.uid||active.course!==s.course)return;
      photo.src=src;photo.hidden=false;open.textContent='';open.appendChild(photo);
      open.disabled=false;open.onclick=()=>viewer(src);
    }).catch(()=>{if(box.isConnected){open.textContent='Photo unavailable on this device';open.classList.add('safetyPhotoMissing')}});
    return box;
  }
  function bindHistory(){
    root.document.querySelectorAll('[data-safety-history-photos]').forEach(el=>{
      const s=scope();parseIds(el.dataset.photos).forEach((id,index)=>el.appendChild(tile(id,index,s)));
    });
  }
  function bindForm(form){
    const s=scope(),fileInput=form.querySelector('#safetyPhotoInput'),hidden=form.querySelector('#safetyPhotoIds');
    const choose=form.querySelector('#safetyChoosePhotos'),counter=form.querySelector('#safetyPhotoCount'),grid=form.querySelector('#safetyPhotoGrid');
    let ids=parseIds(hidden?.value),busy=false,work=Promise.resolve();
    const setBusy=value=>{
      busy=value;
      if(choose)choose.disabled=busy||ids.length>=MAX;
      const submit=form.querySelector('[type="submit"]'),discard=form.querySelector('#discardSafetyDraft');
      if(submit)submit.disabled=busy;
      if(discard)discard.disabled=busy;
    };
    const render=()=>{
      if(grid)grid.replaceChildren(...ids.map((id,index)=>tile(id,index,s,async selected=>{
        if(busy)return;
        try{await remove(selected,s)}catch{root.FLYMPUS_SAFETY_TOAST?.('Unable to remove photo','error');return}
        ids=ids.filter(x=>x!==selected);render();
      })));
      if(hidden){hidden.value=JSON.stringify(ids);hidden.dispatchEvent(new Event('change',{bubbles:true}))}
      if(counter)counter.textContent=ids.length+' / '+MAX;
      if(choose)choose.disabled=busy||ids.length>=MAX;
    };
    if(choose&&fileInput)choose.onclick=()=>fileInput.click();
    if(fileInput)fileInput.onchange=()=>{
      const files=[...fileInput.files],slots=MAX-ids.length;
      fileInput.value='';
      if(files.length>slots)root.FLYMPUS_SAFETY_TOAST?.('Maximum 3 photos per event','warning');
      setBusy(true);
      work=work.then(async()=>{
        for(const file of files.slice(0,Math.max(0,slots))){
          const active=scope();if(active.uid!==s.uid||active.course!==s.course)break;
          try{
            const blob=await compress(file);
            const id=root.crypto?.randomUUID?.()||('photo-'+Date.now()+'-'+Math.random().toString(36).slice(2));
            await save(id,s,blob);ids.push(id);render();
          }catch(err){root.FLYMPUS_SAFETY_TOAST?.(err?.message||'Unable to save photo','error')}
        }
      }).finally(()=>setBusy(false));
    };
    render();
    return {ids:()=>ids.slice(),ready:()=>work,discard:async()=>{await work;await Promise.all(ids.map(id=>remove(id,s).catch(()=>{})))}};
  }
  root.FLYMPUS_SAFETY_ATTACHMENTS=Object.freeze({MAX,parseIds,bindForm,bindHistory});
})(window);
