/* FLYMPUS service worker
   - Instant PWA cold-start from a versioned same-origin app-shell cache
   - Background revalidation so deployments replace the cached shell safely
   - Web Push delivery and notification navigation */
const FLYMPUS_SW_VERSION='2026-10-09-clock-text-0798';
const SHELL_CACHE='flympus-shell-'+FLYMPUS_SW_VERSION;
const DEFAULT_ICON='./assets/flympus-app-icon.webp';
const SHELL_URLS=[
  './',
  './index.html',
  './auth.css?v=20261008-switcher01',
  './auth.js?v=20261009-approval-sounds-0795',
  './account-switcher.js?v=20261008-switcher01',
  './assets/reports-dashboard.js?v=0767',
  './assets/reports-dashboard.css?v=0767',
  './assets/fleet-operations.css?v=20261009-clock-text-0798',
  './assets/fleet-model.js?v=20261009-approval-sounds-0795',
  './assets/duty-approval-model.js?v=20261009-approval-sounds-0795',
  './assets/operations-cloud.js?v=20261009-approval-sounds-0795',
  './assets/course-operations.js?v=20261009-approval-sounds-0795',
  './assets/course-operations.css?v=20261009-approval-sounds-0795',
  './assets/fleet-timeline-layout.js?v=20261009-clock-text-0798',
  './assets/fleet-views.js?v=20261009-clock-text-0798',
  './assets/safety-workflow.css?v=20261008-safety03',
  './assets/safety-workflow.js?v=20261008-safety01',
  './assets/safety-global-inbox.js?v=20261009-approval-sounds-0795',
  './assets/safety-ui.js?v=20261008-safety03',
  './assets/app-update-notice.js?v=20261008-update01',
  './firebase-config.js?v=20261004-auth2',
  './storage-scope.js?v=20261006-auth8',
  './assets/evaluation-voice.js?v=0742',
  './manifest.webmanifest',
  './assets/flympus-app-icon.webp',
  './assets/flympus-sidebar-uploaded-0762.webp'
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
/* THEME_SOURCE_START */
const THEME_BOOTSTRAP="/* Single theme authority. This source is embedded in the HTML head and the\n   worker's emergency shell by scripts/sync-theme-bootstrap.cjs. No network\n   request, media-query listener, resume sample or timer decides a paint. */\n(()=>{\n  'use strict';\n  const root=document.documentElement;\n  const PREFS_KEY='flympus-app-preferences';\n  const RESOLVED_KEY='flympus-last-resolved-theme';\n  const SYSTEM_KEY='flympus-system-resolved-theme';\n  const THEMES=new Set(['light','dark','system']);\n  const readPrefs=()=>{try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{}}catch{return{}}};\n  const readTheme=key=>{try{const v=localStorage.getItem(key);return v==='light'||v==='dark'?v:''}catch{return''}};\n  const writeTheme=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};\n  const modeFor=prefs=>THEMES.has(prefs?.theme)?prefs.theme:'system';\n  const sampleSystem=()=>{try{return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{return'light'}};\n  const initial=readPrefs();\n  let mode=modeFor(initial);\n  // Migrate the previous System result without sampling iOS during restoration.\n  // Explicit Light/Dark writes must never overwrite this separate System value.\n  let systemResolved=readTheme(SYSTEM_KEY)||(mode==='system'?readTheme(RESOLVED_KEY):'');\n  let resolved=mode==='system'?(systemResolved||sampleSystem()):mode;\n  if(mode==='system')systemResolved=resolved;\n\n  function commit(){\n    const changing=!!root.getAttribute('data-flympus-theme')&&root.getAttribute('data-flympus-theme')!==resolved;\n    // Flush the old and new styles while transitions are disabled, in this\n    // same task. No timer or animation frame may expose an intermediate palette.\n    if(changing){root.classList.add('flympusThemeCommit');void root.offsetWidth}\n    const dark=resolved==='dark',background=dark?'#07131f':'#f4f8fc',chromeTheme=dark?'#0d1e2f':'#0b3157';\n    root.setAttribute('data-flympus-theme',resolved);\n    root.setAttribute('data-flympus-theme-mode',mode);\n    root.style.colorScheme=resolved;\n    root.style.backgroundColor=background;\n    root.style.setProperty('--flympus-canvas',background);\n    root.style.setProperty('--flympus-ink',dark?'#eef5fb':'#0f172a');\n    /* Keep iOS/PWA launch/status chrome branded even while the page canvas is\n       light. A light theme-color is what produces the white launch flash before\n       the first application paint on some standalone iOS restores. */\n    document.querySelector('meta[name=\"theme-color\"]')?.setAttribute('content',chromeTheme);\n    document.querySelector('meta[name=\"color-scheme\"]')?.setAttribute('content',resolved);\n    writeTheme(RESOLVED_KEY,resolved);\n    if(systemResolved)writeTheme(SYSTEM_KEY,systemResolved);\n    if(changing){void root.offsetWidth;root.classList.remove('flympusThemeCommit')}\n    return resolved\n  }\n  function applyPreferences(prefs=readPrefs(),{selectionChanged=false,sampleSystemNow=false}={}){\n    if(!selectionChanged)return commit();\n    const nextMode=modeFor(prefs);\n    // Only an explicit Settings selection may resolve System again. Routine\n    // render, storage/auth hydration and lifecycle callbacks retain the result.\n    if(nextMode==='system'&&(!systemResolved||sampleSystemNow))systemResolved=sampleSystem();\n    mode=nextMode;\n    resolved=mode==='system'?systemResolved:mode;\n    return commit()\n  }\n  function applyLocaleAndAccessibility(prefs=readPrefs()){\n    const language=prefs.language==='he'?'he':'en';\n    root.setAttribute('data-flympus-language',language);\n    root.setAttribute('lang',language);\n    root.setAttribute('dir',language==='he'?'rtl':'ltr');\n    root.classList.toggle('flympusLargeText',prefs.largerText===true);\n    root.classList.toggle('flympusHapticsOff',prefs.haptics===false)\n  }\n  // Reassert the in-memory decision. A suspended page must not replace it with\n  // defaults if storage is temporarily unavailable, or a transient OS value.\n  function reassertStableTheme(){return commit()}\n  applyLocaleAndAccessibility(initial);\n  commit();\n  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reassertStableTheme()},{passive:true});\n  window.addEventListener('pageshow',reassertStableTheme,{passive:true});\n  window.FLYMPUS_THEME=Object.freeze({applyPreferences,applyLocaleAndAccessibility,reassertStableTheme,getResolved:()=>resolved})\n})();";
/* THEME_SOURCE_END */
function offlineShell(){
  // Even this no-cache emergency document resolves device preferences before
  // its body exists; a fixed navy fallback would flash for a Light user.
  return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f8fc"><meta name="color-scheme" content="light"><script>'+THEME_BOOTSTRAP+'</script><style>html,body{margin:0;min-height:100%;background:var(--flympus-canvas);color:var(--flympus-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{display:grid;place-items:center;min-height:100vh}.b{font-weight:900;font-size:28px;letter-spacing:.02em}.s{margin-top:8px;opacity:.72;font-size:13px;text-align:center}</style><main><div class="b">FLYMPUS</div><div class="s" id="opening">Opening your saved app…</div></main><script>if(document.documentElement.lang==="he")document.getElementById("opening").textContent="פותח את האפליקציה השמורה…"</script>',{
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
  /* Firebase Hosting reserves /__ for Authentication and other helpers.
     Never intercept or cache these requests; the Firebase auth handler must
     execute from Hosting exactly as served by Firebase. */
  if(url.origin===self.location.origin&&url.pathname.startsWith('/__/'))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      const cached=await cache.match('./')||await cache.match('./index.html');
      /* A user-selected update must fetch the new HTML, rather than replaying
         an earlier offline shell for another launch. Normal opens stay instant. */
      if(url.searchParams.has('flympusFresh')){
        const latest=await updateNavigationCache(request);
        return latest||cached||offlineShell();
      }
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
