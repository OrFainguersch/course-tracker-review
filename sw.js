/* FLYMPUS Web Push service worker
   Scope: GitHub Pages PWA. No fetch caching is installed here on purpose;
   this worker is dedicated to push delivery and notification navigation. */
const FLYMPUS_SW_VERSION='2026-10-04-push-2';
const DEFAULT_ICON='./assets/flympus-app-icon.webp';

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
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

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
      /* Avoid a double ding while FLYMPUS is visible: the page plays the
         selected Avionics Pulse tail. Background delivery keeps OS sound. */
      silent:payload.silent===true||customForegroundSound,
      data:{
        ...data,
        url:targetUrl(data)
      }
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
