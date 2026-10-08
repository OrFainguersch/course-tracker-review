/* FLYMPUS account switching. Named Firebase Apps keep independently persisted
   sessions; the default app alone supplies application authorization and data.
   No secret or OAuth token is ever put in the FLYMPUS account-picker metadata. */
export function createAccountSwitcher({authSdk,appSdk,config,getPrimaryAuth,getCurrent,lockApp,showLoading,unlockApp,onFailure}){
  const KEY='firebase:flympus:account-slots-v1',MAX=5;
  const authBySlot=new Map();
  let busy=false;
  const tr=key=>document.documentElement?.getAttribute('data-flympus-language')==='he'?({
    'Other accounts':'חשבונות נוספים','Add another account':'הוסף חשבון נוסף',
    'Continue with Google':'המשך עם Google','Continue with Microsoft':'המשך עם Microsoft',
    'Session expired':'פג תוקף ההתחברות','Session expired. Add the account again to sign in.':'פג תוקף ההתחברות. יש להוסיף שוב את החשבון.',
    'Switching account…':'מחליף חשבון…','Too many accounts on this device.':'יותר מדי חשבונות במכשיר הזה.',
    'Account switching failed.':'מעבר החשבון נכשל.','Switch to account':'עבור לחשבון'
  }[key]||key):key;
  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function slots(){
    try{
      const input=JSON.parse(localStorage.getItem(KEY)||'[]'),usedIds=new Set(),usedUids=new Set();
      return (Array.isArray(input)?input:[]).filter(x=>{
        const id=Number(x?.id),uid=String(x?.uid||'');
        if(!Number.isInteger(id)||id<1||id>99||!uid||uid.length>160||usedIds.has(id)||usedUids.has(uid))return false;
        usedIds.add(id);usedUids.add(uid);return true
      }).slice(0,MAX).map(x=>({
        id:Number(x.id),uid:String(x.uid),email:String(x.email||'').slice(0,254),
        name:String(x.name||'').slice(0,120),provider:x.provider==='microsoft'?'microsoft':'google'
      }))
    }catch{return []}
  }
  const save=list=>{try{localStorage.setItem(KEY,JSON.stringify(list.slice(0,MAX)))}catch{}};
  function nextId(list){for(let id=1;id<=99;id++)if(!list.some(x=>x.id===id))return id;throw Error(tr('Too many accounts on this device.'))}
  function slotAuth(slot){
    if(authBySlot.has(slot.id))return authBySlot.get(slot.id);
    const named=appSdk.initializeApp(config.firebase,'flympus-account-'+slot.id);
    const instance=authSdk.initializeAuth(named,{
      persistence:authSdk.browserLocalPersistence,
      popupRedirectResolver:authSdk.browserPopupRedirectResolver
    });
    authBySlot.set(slot.id,instance);
    return instance
  }
  function provider(kind){
    if(kind==='microsoft'){
      if(config.microsoftEnabled!==true)throw Error('Microsoft sign-in is unavailable.');
      const value=new authSdk.OAuthProvider('microsoft.com');
      const tenant=String(config.microsoftTenant||'common').trim();
      if(tenant)value.setCustomParameters({tenant});
      return value
    }
    return new authSdk.GoogleAuthProvider()
  }
  function accountMarkup(list){
    return list.map(slot=>{
      const available=slotAuth(slot).currentUser?.uid===slot.uid;
      const initials=String(slot.name||slot.email||'?').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();
      return '<button class="accountSwitcherRow" type="button" data-switch-account="'+esc(slot.uid)+'" '+(busy?'disabled':'')+' aria-label="'+esc(tr('Switch to account')+' '+slot.email)+'">'
        +'<span class="accountSwitcherAvatar" aria-hidden="true">'+esc(initials)+'</span>'
        +'<span class="accountSwitcherText"><b>'+esc(slot.name||slot.email)+'</b><small dir="auto">'+esc(slot.email)+'</small></span>'
        +(available?'<span class="accountSwitcherCheck" aria-hidden="true">✓</span>':'<span class="accountSwitcherExpired">'+esc(tr('Session expired'))+'</span>')
        +'</button>'
    }).join('')
  }
  function choices(){return slots().filter(x=>x.uid!==String(getPrimaryAuth()?.currentUser?.uid||''))}
  async function refresh(){
    const menu=document.getElementById('accountSwitchList'),login=document.getElementById('flympusAuthSavedAccounts');
    if(!menu&&!login)return;
    const list=choices();
    if(!list.length){if(menu){menu.hidden=true;menu.innerHTML=''}if(login)login.innerHTML='';return}
    await Promise.all(list.map(async x=>{try{await slotAuth(x).authStateReady()}catch{}}));
    /* A switch or a sign-out could happen while the async storage read ran. */
    const current=choices();
    if(menu){menu.hidden=!current.length;menu.innerHTML=current.length?'<div class="accountSwitcherLabel">'+esc(tr('Other accounts'))+'</div>'+accountMarkup(current):''}
    if(login)login.innerHTML=accountMarkup(current)
  }
  function loginPickerHtml(){
    return slots().length?'<div class="flympusAuthSavedAccountSection"><b>'+esc(tr('Other accounts'))+'</b><div id="flympusAuthSavedAccounts"></div></div>':''
  }
  function message(text='',isError=false){
    const el=document.getElementById('accountSwitcherMessage');
    if(el){el.textContent=text?tr(text):'';el.hidden=!text;el.classList.toggle('error',!!isError)}
  }
  async function remember(user,profile){
    if(!user?.uid||profile?.status!=='active')return;
    const list=slots(),existing=list.find(x=>x.uid===user.uid);
    if(!existing&&list.length>=MAX)return;
    const slot=existing||{id:nextId(list),uid:user.uid};
    const secondary=slotAuth(slot);
    await secondary.authStateReady();
    if(secondary.currentUser?.uid!==user.uid)await authSdk.updateCurrentUser(secondary,user);
    slot.email=String(user.email||'').slice(0,254);
    slot.name=String(profile.preferredName||profile.displayName||user.displayName||slot.email).slice(0,120);
    slot.provider=(user.providerData||[]).some(x=>x.providerId==='microsoft.com')?'microsoft':'google';
    if(!existing)list.push(slot);
    save(list);
    void refresh()
  }
  async function activate(slot,user){
    const primary=getPrimaryAuth();
    if(!primary||!user||user.uid!==slot.uid)throw Error('Session expired. Add the account again to sign in.');
    if(primary.currentUser?.uid===user.uid)return;
    const current=getCurrent();
    if(current?.user?.uid&&current?.profile?.status==='active')await remember(current.user,current.profile);
    /* Lock the still-mounted previous user's screen before changing auth.
       The primary onAuthStateChanged verifies Firestore status, changes the
       UID namespace, then reloads; secondary auth has no app data access. */
    lockApp();
    showLoading('Switching account…');
    await authSdk.updateCurrentUser(primary,user);
  }
  async function select(uid){
    if(busy)return;
    const slot=slots().find(x=>x.uid===String(uid||''));
    if(!slot)return;
    busy=true;
    try{
      const secondary=slotAuth(slot);
      await secondary.authStateReady();
      await activate(slot,secondary.currentUser)
    }catch(error){
      console.error('Account switch error',error);
      onFailure(error);
      const current=getCurrent();
      if(getPrimaryAuth()?.currentUser?.uid===current?.user?.uid&&current?.profile?.status==='active')unlockApp()
      message(error?.message||'Account switching failed.',true)
    }finally{busy=false;void refresh()}
  }
  async function add(kind='google'){
    if(busy)return;
    const list=slots();
    if(list.length>=MAX){message('Too many accounts on this device.',true);return}
    busy=true;
    const fresh={id:nextId(list),uid:''};
    let temp=null,persisted=false;
    try{
      temp=slotAuth(fresh);
      /* Sign in on SECONDARY Auth so default user and data remain untouched. */
      const result=await authSdk.signInWithPopup(temp,provider(kind),authSdk.browserPopupRedirectResolver);
      const user=result?.user;
      if(!user?.uid||!user.email)throw Error('The provider did not return an account.');
      const existing=list.find(x=>x.uid===user.uid);
      if(existing){
        const known=slotAuth(existing);
        await known.authStateReady();
        await authSdk.updateCurrentUser(known,user);
        await authSdk.signOut(temp);
        await activate(existing,known.currentUser)
      }else{
        Object.assign(fresh,{
          uid:user.uid,email:String(user.email).slice(0,254),
          name:String(user.displayName||user.email).slice(0,120),
          provider:kind
        });
        save([...list,fresh]);persisted=true;
        await activate(fresh,user)
      }
    }catch(error){
      console.error('Add another FLYMPUS account failed',error);
      onFailure(error);
      message(error?.message||'Account switching failed.',true);
      if(persisted)save(slots().filter(s=>s.id!==fresh.id));
      if(temp?.currentUser){try{await authSdk.signOut(temp)}catch{}}
      const current=getCurrent();
      if(getPrimaryAuth()?.currentUser?.uid===current?.user?.uid&&current?.profile?.status==='active')unlockApp()
    }finally{busy=false;void refresh()}
  }
  async function forgetActive(uid){
    const slot=slots().find(x=>x.uid===uid);
    if(!slot)return;
    try{await authSdk.signOut(slotAuth(slot))}catch(error){console.warn('Mirrored account signout failed',error)}
    save(slots().filter(x=>x.uid!==uid))
  }
  function bind(){
    document.getElementById('accountAddAnother')?.addEventListener('click',event=>{
      event.stopPropagation();
      const panel=document.getElementById('accountAddProviders');
      if(panel)panel.hidden=!panel.hidden;
      message()
    });
    document.querySelectorAll('[data-account-add-provider]').forEach(el=>el.addEventListener('click',event=>{
      event.stopPropagation();void add(el.dataset.accountAddProvider)
    }));
    document.addEventListener('click',event=>{
      const target=event.target?.closest?.('[data-switch-account]');
      if(target){event.stopPropagation();void select(target.dataset.switchAccount)}
    });
  }
  bind();
  return Object.freeze({refresh,remember,select,add,forgetActive,loginPickerHtml})
}
