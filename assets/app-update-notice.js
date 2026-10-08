/* FLYMPUS PWA update notice. Never reload a form without an explicit tap. */
(function(){
  'use strict';
  const meta=document.querySelector('meta[name="flympus-deploy-commit"]');
  const loaded=String(meta?.content||'').trim();
  if(!/^[a-f0-9]{40}$/i.test(loaded))return; // GitHub Pages or development (no production manifest)
  let checking=false,lastCheck=0,offered='';
  const minInterval=45000;
  try{
    const u=new URL(location.href);
    if(u.searchParams.has('flympusFresh')){
      u.searchParams.delete('flympusFresh');
      history.replaceState(history.state,'',u.pathname+u.search+u.hash);
    }
  }catch{}
  function offer(version){
    if(offered===version||document.querySelector('#flympusAppUpdateNotice'))return;
    try{if(sessionStorage.getItem('flympus-update-dismissed')===version)return}catch{}
    offered=version;
    const style=document.createElement('style');
    style.textContent='#flympusAppUpdateNotice{position:fixed;z-index:100000;bottom:calc(106px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 24px));padding:12px 14px;border-radius:15px;box-shadow:0 8px 34px #051b3670;background:#103960;color:white;font:600 12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;display:flex;gap:12px;align-items:center;justify-content:space-between}#flympusAppUpdateNotice button{border:0;border-radius:9px;padding:8px 11px;background:#fff;color:#123b5e;font:700 12px -apple-system,BlinkMacSystemFont,sans-serif;white-space:nowrap}#flympusAppUpdateNotice .dismiss{background:transparent;color:#fff;padding:6px;min-width:22px}';
    const banner=document.createElement('div');
    banner.id='flympusAppUpdateNotice';banner.setAttribute('role','status');
    const label=document.createElement('span');label.textContent='A new FLYMPUS version is ready';
    const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Update';
    refresh.onclick=()=>{
      const u=new URL(location.href);
      u.searchParams.set('flympusFresh',version.slice(0,12));
      location.assign(u.href);
    };
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='dismiss';dismiss.textContent='✕';dismiss.setAttribute('aria-label','Later');
    dismiss.onclick=()=>{try{sessionStorage.setItem('flympus-update-dismissed',version)}catch{}banner.remove();style.remove()};
    banner.append(label,refresh,dismiss);document.head.appendChild(style);document.body.appendChild(banner);
  }
  async function check(){
    if(document.visibilityState==='hidden'||checking||Date.now()-lastCheck<minInterval)return;
    checking=true;lastCheck=Date.now();
    try{
      const response=await fetch('./deploy-info.json?versionCheck='+Date.now(),{cache:'no-store'});
      if(response.ok){
        const info=await response.json(),latest=String(info?.commit||'');
        if(/^[a-f0-9]{40}$/i.test(latest)&&latest!==loaded)offer(latest);
      }
    }catch{}finally{checking=false}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(check,1800),{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void check()},{passive:true});
  window.addEventListener('pageshow',()=>void check(),{passive:true});
})();
