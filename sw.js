/* FLYMPUS service worker
   - Instant PWA cold-start from a versioned same-origin app-shell cache
   - Background revalidation so deployments replace the cached shell safely
   - Web Push delivery and notification navigation */
const FLYMPUS_SW_VERSION='2026-10-05-startup-4';
const SHELL_CACHE='flympus-shell-'+FLYMPUS_SW_VERSION;
const DEFAULT_ICON='./assets/flympus-app-icon.webp';
const SHELL_URLS=[
  './',
  './index.html',
  './auth.css?v=20261005-auth4',
  './auth.js?v=20261005-auth12',
  './firebase-config.js?v=20261004-auth2',
  './storage-scope.js?v=20261005-auth6',
  './manifest.webmanifest',
  './assets/flympus-app-icon.webp',
  './assets/flympus-sidebar-final.webp'
];

async function cacheShell(){
  const cache=await caches.open(SHELL_CACHE);
  await Promise.allSettled(SHELL_URLS.map(async url=>{
    try{
      const response=await fetch(url,{cache:'reload'});
      if(response?.ok)await cache.put(url,response)
    }catch{}
  }))
}
async function updateNavigationCache(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response?.ok){
      const cache=await caches.open(SHELL_CACHE);
      await cache.put('./',response.clone());
      await cache.put('./index.html',response.clone())
    }
    return response
  }catch{return null}
}
function offlineShell(){
  return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07294c"><style>html,body{margin:0;min-height:100%;background:#07294c;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{display:grid;place-items:center;min-height:100vh}.b{font-weight:900;font-size:28px;letter-spacing:.02em}.s{margin-top:8px;opacity:.72;font-size:13px;text-align:center}</style><main><div class="b">FLYMPUS</div><div class="s">Opening your saved app…</div></main>',{
    status:200,
    headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}
  })
}

function normalizePayload(event){
  if(!event?.data)return {};
  try{return event.data.json()||{}}catch{}
  try{return {body:event.data.text()}}catch{return {}}
}
function targetUrl(data={}){
  try{
    if(data.url)return new URL(String(data.url),self.registration.scope).href;
    const url=new URL('./',self.registration.scope);
    if(data.screen)url.searchParams.set('pushScreen',String(data.screen));
    if(data.courseCode)url.searchParams.set('pushCourse',String(data.courseCode));
    return url.href
  }catch{return self.registration.scope}
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    await cacheShell();
    await self.skipWaiting()
  })())
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('flympus-shell-')&&key!==SHELL_CACHE).map(key=>caches.delete(key)));
    await self.clients.claim()
  })())
});

/* The installed PWA must never wait on 4G before it can paint its own HTML.
   Navigation therefore uses the last verified static shell immediately and
   refreshes it in the background. No user/course data is cached here. */
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      const cached=await cache.match('./')||await cache.match('./index.html');
      const networkPromise=updateNavigationCache(request);
      if(cached){
        event.waitUntil(networkPromise.then(()=>{}).catch(()=>{}));
        return cached
      }
      const network=await networkPromise;
      return network||offlineShell()
    })());
    return
  }
  if(url.origin!==self.location.origin)return;
  const shellPath=new URL(url.pathname+url.search,self.registration.scope).href;
  const isShell=SHELL_URLS.some(entry=>new URL(entry,self.registration.scope).href===shellPath);
  if(!isShell)return;
  event.respondWith((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    const cached=await cache.match(request)||await cache.match(url.pathname+url.search);
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response?.ok)await cache.put(request,response.clone());
      return response
    }catch{
      return new Response('',{status:503,statusText:'Offline'})
    }
  })())
});

self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    const payload=normalizePayload(event),data=payload.data&&typeof payload.data==='object'?{...payload.data}:payload;
    const title=String(payload.title||data.title||'FLYMPUS');
    const body=String(payload.body||data.body||'');
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const foreground=windows.find(client=>client.focused===true)||windows.find(client=>client.visibilityState==='visible')||null;
    const customForegroundSound=!!foreground&&payload.silent!==true;
    const options={
      body,
      icon:String(payload.icon||DEFAULT_ICON),
      badge:String(payload.badge||DEFAULT_ICON),
      tag:String(payload.tag||data.tag||'flympus'),
      renotify:payload.renotify===true,
      requireInteraction:payload.requireInteraction===true,
      silent:payload.silent===true||customForegroundSound,
      data:{...data,url:targetUrl(data)}
    };
    if(Array.isArray(payload.actions))options.actions=payload.actions.slice(0,2);
    if(customForegroundSound){
      try{foreground.postMessage({type:'FLYMPUS_PUSH_RECEIVED',silent:false,data:{...data,title,body}})}catch{}
    }
    await self.registration.showNotification(title,options)
  })())
});

self.addEventListener('notificationclick',event=>{
  event.notification?.close?.();
  const data=event.notification?.data||{},url=targetUrl(data);
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const sameScope=windows.find(client=>String(client.url||'').startsWith(self.registration.scope));
    if(sameScope){
      try{sameScope.postMessage({type:'FLYMPUS_PUSH_NAVIGATE',screen:String(data.screen||'home'),courseCode:String(data.courseCode||''),data})}catch{}
      try{await sameScope.focus()}catch{}
      return
    }
    if(self.clients.openWindow)await self.clients.openWindow(url)
  })())
});

self.addEventListener('pushsubscriptionchange',event=>{
  event.waitUntil((async()=>{
    try{
      const cfgRes=await fetch('./push-config.json',{cache:'no-store'});
      const cfg=cfgRes.ok?await cfgRes.json():{};
      if(!cfg?.enabled||!cfg?.vapidPublicKey||!cfg?.apiBaseUrl)return;
      const key=String(cfg.vapidPublicKey),padding='='.repeat((4-key.length%4)%4),raw=atob((key+padding).replace(/-/g,'+').replace(/_/g,'/')),bytes=Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
      const subscription=await self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      await fetch(String(cfg.apiBaseUrl).replace(/\/$/,'')+'/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subscription.toJSON(),source:'pushsubscriptionchange',updatedAt:new Date().toISOString()})})
    }catch{}
  })())
});