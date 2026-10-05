/* FLYMPUS authoritative first-paint and iOS lifecycle theme controller.
   It executes synchronously in <head>, before CSS can paint. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const PREFS_KEY='flympus-app-preferences';
  const RESOLVED_KEY='flympus-last-resolved-theme';
  const THEMES=new Set(['light','dark','system']);
  let systemQuery=null;
  let visibleSince=performance.now?.()||Date.now();

  const readPrefs=()=>{try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{}}catch{return{}}};
  const storedResolved=()=>{try{const value=String(localStorage.getItem(RESOLVED_KEY)||'');return value==='dark'||value==='light'?value:''}catch{return''}};
  const sampleSystem=()=>{try{return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light'}catch{return storedResolved()||'light'}};
  const modeFor=prefs=>THEMES.has(prefs?.theme)?prefs.theme:'system';
  const currentResolved=()=>{const value=root.getAttribute('data-flympus-theme');return value==='dark'||value==='light'?value:''};

  function commit(resolved,mode,{persist=true}={}){
    const theme=resolved==='dark'?'dark':'light',dark=theme==='dark';
    root.setAttribute('data-flympus-theme',theme);
    root.setAttribute('data-flympus-theme-mode',modeFor({theme:mode}));
    root.style.colorScheme=theme;
    root.style.backgroundColor=dark?'#091522':'#f4f8fc';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#07131f':'#07294c');
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',theme);
    if(persist)try{localStorage.setItem(RESOLVED_KEY,theme)}catch{}
    return theme
  }

  function applyPreferences(prefs=readPrefs(),{sampleSystemNow=false}={}){
    const mode=modeFor(prefs);
    const resolved=mode==='light'||mode==='dark'
      ?mode
      :(sampleSystemNow?sampleSystem():(storedResolved()||currentResolved()||sampleSystem()));
    return commit(resolved,mode)
  }

  function applyLocaleAndAccessibility(prefs=readPrefs()){
    const language=prefs.language==='he'?'he':'en';
    root.setAttribute('data-flympus-language',language);
    root.setAttribute('lang',language);
    root.setAttribute('dir',language==='he'?'rtl':'ltr');
    root.classList.toggle('flympusLargeText',prefs.largerText===true);
    root.classList.toggle('flympusHapticsOff',prefs.haptics===false)
  }

  function reassertStableTheme(){
    const prefs=readPrefs(),mode=modeFor(prefs);
    const stable=mode==='light'||mode==='dark'?mode:(storedResolved()||currentResolved()||'light');
    commit(stable,mode)
  }

  const initial=readPrefs();
  applyLocaleAndAccessibility(initial);
  applyPreferences(initial);

  /* iOS can emit a transient prefers-color-scheme change while restoring a
     suspended PWA. Foreground/pageshow only reassert the last committed theme;
     they never sample the OS. A genuine media-query change is accepted only
     while the document has already been continuously visible. */
  try{
    systemQuery=window.matchMedia?.('(prefers-color-scheme: dark)')||null;
    systemQuery?.addEventListener?.('change',event=>{
      if(modeFor(readPrefs())!=='system'||document.visibilityState!=='visible')return;
      const now=performance.now?.()||Date.now();
      if(now-visibleSince<1500){reassertStableTheme();return}
      commit(event.matches?'dark':'light','system')
    })
  }catch{}
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      visibleSince=performance.now?.()||Date.now();
      reassertStableTheme()
    }else{
      const current=currentResolved();
      if(current)try{localStorage.setItem(RESOLVED_KEY,current)}catch{}
    }
  },{passive:true});
  window.addEventListener('pageshow',()=>{
    visibleSince=performance.now?.()||Date.now();
    reassertStableTheme()
  },{passive:true});

  window.FLYMPUS_THEME=Object.freeze({
    applyPreferences,
    applyLocaleAndAccessibility,
    reassertStableTheme,
    getResolved:()=>currentResolved()||storedResolved()||'light'
  })
})();
