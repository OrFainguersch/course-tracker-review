/* Single theme authority. This source is embedded in the HTML head and the
   worker's emergency shell by scripts/sync-theme-bootstrap.cjs. No network
   request, media-query listener, resume sample or timer decides a paint. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const PREFS_KEY='flympus-app-preferences';
  const RESOLVED_KEY='flympus-last-resolved-theme';
  const SYSTEM_KEY='flympus-system-resolved-theme';
  const THEMES=new Set(['light','dark','system']);
  const readPrefs=()=>{try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{}}catch{return{}}};
  const readTheme=key=>{try{const v=localStorage.getItem(key);return v==='light'||v==='dark'?v:''}catch{return''}};
  const writeTheme=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const modeFor=prefs=>THEMES.has(prefs?.theme)?prefs.theme:'system';
  const sampleSystem=()=>{try{return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{return'light'}};
  const initial=readPrefs();
  let mode=modeFor(initial);
  // Migrate the previous System result without sampling iOS during restoration.
  // Explicit Light/Dark writes must never overwrite this separate System value.
  let systemResolved=readTheme(SYSTEM_KEY)||(mode==='system'?readTheme(RESOLVED_KEY):'');
  let resolved=mode==='system'?(systemResolved||sampleSystem()):mode;
  if(mode==='system')systemResolved=resolved;

  function commit(){
    const changing=!!root.getAttribute('data-flympus-theme')&&root.getAttribute('data-flympus-theme')!==resolved;
    // Flush the old and new styles while transitions are disabled, in this
    // same task. No timer or animation frame may expose an intermediate palette.
    if(changing){root.classList.add('flympusThemeCommit');void root.offsetWidth}
    const dark=resolved==='dark',background=dark?'#07131f':'#f4f8fc';
    root.setAttribute('data-flympus-theme',resolved);
    root.setAttribute('data-flympus-theme-mode',mode);
    root.style.colorScheme=resolved;
    root.style.backgroundColor=background;
    root.style.setProperty('--flympus-canvas',background);
    root.style.setProperty('--flympus-ink',dark?'#eef5fb':'#0f172a');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',background);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',resolved);
    writeTheme(RESOLVED_KEY,resolved);
    if(systemResolved)writeTheme(SYSTEM_KEY,systemResolved);
    if(changing){void root.offsetWidth;root.classList.remove('flympusThemeCommit')}
    return resolved
  }
  function applyPreferences(prefs=readPrefs(),{selectionChanged=false,sampleSystemNow=false}={}){
    if(!selectionChanged)return commit();
    const nextMode=modeFor(prefs);
    // Only an explicit Settings selection may resolve System again. Routine
    // render, storage/auth hydration and lifecycle callbacks retain the result.
    if(nextMode==='system'&&(!systemResolved||sampleSystemNow))systemResolved=sampleSystem();
    mode=nextMode;
    resolved=mode==='system'?systemResolved:mode;
    return commit()
  }
  function applyLocaleAndAccessibility(prefs=readPrefs()){
    const language=prefs.language==='he'?'he':'en';
    root.setAttribute('data-flympus-language',language);
    root.setAttribute('lang',language);
    root.setAttribute('dir',language==='he'?'rtl':'ltr');
    root.classList.toggle('flympusLargeText',prefs.largerText===true);
    root.classList.toggle('flympusHapticsOff',prefs.haptics===false)
  }
  // Reassert the in-memory decision. A suspended page must not replace it with
  // defaults if storage is temporarily unavailable, or a transient OS value.
  function reassertStableTheme(){return commit()}
  applyLocaleAndAccessibility(initial);
  commit();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reassertStableTheme()},{passive:true});
  window.addEventListener('pageshow',reassertStableTheme,{passive:true});
  window.FLYMPUS_THEME=Object.freeze({applyPreferences,applyLocaleAndAccessibility,reassertStableTheme,getResolved:()=>resolved})
})();
