/* FLYMPUS Authentication foundation
   - Google + Microsoft sign-in through Firebase Authentication
   - Firestore user profiles: pending/active/blocked + user/admin
   - No mail/calendar scopes are requested.
   - Production enforcement stays off until UID-scoped data migration is ready. */
const cfg=window.FLYMPUS_FIREBASE_CONFIG||{};
const params=new URLSearchParams(location.search);
const preview=params.get('authPreview')==='1';
const enabled=cfg.enabled===true;
const enforce=enabled&&cfg.enforceAuth===true;
const SDK_VERSION='12.19.0';

let firebaseApp=null;
let auth=null;
let db=null;
let authSdk=null;
let firestoreSdk=null;
let authUnsubscribe=null;
let currentUser=null;
let currentProfile=null;

const api=window.FLYMPUS_AUTH={
  status:enabled?'booting':'disabled',
  currentUser:null,
  profile:null,
  openLogin:()=>{lockApp();showLogin()},
  signInGoogle:()=>signInProvider('google'),
  signInMicrosoft:()=>signInProvider('microsoft'),
  signOut:()=>signOutCurrentUser(),
  isAdmin:()=>currentProfile?.status==='active'&&currentProfile?.role==='admin',
  isActive:()=>currentProfile?.status==='active'
};

function esc(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))
}
function root(){
  let el=document.getElementById('flympusAuthRoot');
  if(el)return el;
  el=document.createElement('div');
  el.id='flympusAuthRoot';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  el.setAttribute('aria-label','FLYMPUS sign in');
  el.hidden=true;
  document.body.appendChild(el);
  return el
}
function shell(body){
  const el=root();
  el.innerHTML='<div class="flympusAuthShell"><div class="flympusAuthBrand"><img src="./assets/flympus-sidebar-final.webp" alt="FLYMPUS — Train. Track. Progress."></div><section class="flympusAuthCard"><div class="flympusAuthCardBody">'+body+'</div></section></div>';
  el.hidden=false;
  return el
}
function lockApp(){
  document.documentElement.classList.add(preview&&!enabled?'flympusAuthPreview':'flympusAuthLocked');
  document.documentElement.classList.remove('flympusAuthBooting');
}
function unlockApp(){
  document.documentElement.classList.remove('flympusAuthBooting','flympusAuthLocked','flympusAuthPreview');
  const el=document.getElementById('flympusAuthRoot');if(el)el.hidden=true
}
function statusBlock(kind,title,copy){
  const icon=kind==='error'?'!':kind==='pending'?'…':'✓';
  return '<div class="flympusAuthStatus '+esc(kind)+'"><span class="flympusAuthStatusIcon">'+icon+'</span><div><b>'+esc(title)+'</b><span>'+esc(copy)+'</span></div></div>'
}
function showLoading(copy='Checking your account…'){
  api.status='loading';
  shell('<div class="flympusAuthSpinner" aria-hidden="true"></div><p class="flympusAuthEyebrow">SECURE SIGN IN</p><h1 class="flympusAuthTitle">Opening FLYMPUS</h1><p class="flympusAuthCopy">'+esc(copy)+'</p>')
}
function providerButtons(disabled=false){
  return '<div class="flympusAuthProviders">'+
    '<button class="flympusAuthProvider" type="button" data-auth-provider="google" '+(disabled?'disabled':'')+'><span class="flympusAuthProviderMark" aria-hidden="true">G</span><span>Continue with Google</span><span class="flympusAuthProviderArrow" aria-hidden="true">›</span></button>'+
    '<button class="flympusAuthProvider" type="button" data-auth-provider="microsoft" '+(disabled?'disabled':'')+'><span class="flympusAuthProviderMark flympusMicrosoftMark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>Continue with Microsoft</span><span class="flympusAuthProviderArrow" aria-hidden="true">›</span></button>'+
  '</div>'
}
function bindProviderButtons(){
  document.querySelectorAll('[data-auth-provider]').forEach(btn=>btn.onclick=()=>signInProvider(btn.dataset.authProvider))
}
function showLogin({setupPreview=false,error=''}={}){
  api.status=setupPreview?'preview':'signed-out';
  lockApp();
  const setup=setupPreview?statusBlock('pending','Authentication preview','The login experience is ready. Connect the free Firebase project to activate Google and Microsoft sign-in.'):'';
  const err=error?statusBlock('error','Sign-in failed',error):'';
  shell('<p class="flympusAuthEyebrow">FLYMPUS ACCOUNT</p>'+
    '<h1 class="flympusAuthTitle">Sign in to continue</h1>'+
    '<p class="flympusAuthCopy">Use the work or personal account assigned to you. FLYMPUS requests identity only — not access to your Gmail or Outlook mailbox.</p>'+
    providerButtons(setupPreview)+setup+err+
    '<p class="flympusAuthFine">Your account email identifies you in FLYMPUS. Application and course permissions are managed separately.</p>');
  if(!setupPreview)bindProviderButtons()
}
function showPending(user,profile){
  api.status=profile?.status==='blocked'?'blocked':'pending';
  lockApp();
  const blocked=profile?.status==='blocked';
  shell('<p class="flympusAuthEyebrow">ACCOUNT ACCESS</p>'+
    '<h1 class="flympusAuthTitle">'+(blocked?'Access unavailable':'Approval required')+'</h1>'+
    '<p class="flympusAuthCopy">'+(blocked?'This FLYMPUS account is currently blocked.':'Your identity is verified. An administrator still needs to approve access to FLYMPUS.')+'</p>'+
    statusBlock(blocked?'error':'pending',blocked?'Account blocked':'Pending administrator approval',blocked?'Contact a FLYMPUS administrator if you believe this is incorrect.':'You do not have access to course data until approval is granted.')+
    '<div class="flympusAuthAccount"><b>'+esc(user.displayName||'Signed-in user')+'</b><span>'+esc(user.email||'')+'</span></div>'+
    '<div class="flympusAuthActions"><button class="flympusAuthAction" type="button" data-auth-signout>Sign out</button></div>');
  document.querySelector('[data-auth-signout]')?.addEventListener('click',signOutCurrentUser)
}
function showFatal(title,copy){
  api.status='error';
  lockApp();
  shell('<p class="flympusAuthEyebrow">AUTHENTICATION</p><h1 class="flympusAuthTitle">'+esc(title)+'</h1>'+
    statusBlock('error','FLYMPUS could not complete sign-in',copy)+
    '<div class="flympusAuthActions"><button class="flympusAuthAction" type="button" data-auth-retry>Try again</button></div>');
  document.querySelector('[data-auth-retry]')?.addEventListener('click',()=>location.reload())
}
function firebaseConfigReady(){
  const f=cfg.firebase||{};
  return ['apiKey','authDomain','projectId','appId'].every(k=>typeof f[k]==='string'&&f[k].trim())
}
function friendlyAuthError(err){
  const code=String(err?.code||'');
  if(code==='auth/popup-closed-by-user')return 'The sign-in window was closed before authentication finished.';
  if(code==='auth/popup-blocked')return 'The browser blocked the sign-in window. Allow the popup for FLYMPUS and try again.';
  if(code==='auth/cancelled-popup-request')return 'Another sign-in attempt is already open.';
  if(code==='auth/account-exists-with-different-credential')return 'This email already belongs to a FLYMPUS account using a different sign-in provider.';
  if(code==='auth/unauthorized-domain')return 'This FLYMPUS address has not yet been added to Firebase Authorized domains.';
  if(code==='auth/operation-not-allowed')return 'This sign-in provider has not yet been enabled in Firebase.';
  return String(err?.message||'Authentication could not be completed.')
}
async function signInProvider(kind){
  if(!enabled||!auth||!authSdk){showLogin({setupPreview:!enabled});return}
  try{
    api.status='signing-in';
    let provider;
    if(kind==='microsoft'){
      provider=new authSdk.OAuthProvider('microsoft.com');
      const tenant=String(cfg.microsoftTenant||'common').trim();
      if(tenant)provider.setCustomParameters({tenant})
    }else{
      provider=new authSdk.GoogleAuthProvider()
    }
    /* GitHub Pages cannot proxy Firebase redirect helpers. Popup auth avoids
       Safari/Firefox third-party-storage redirect failures documented by Firebase. */
    await authSdk.signInWithPopup(auth,provider)
  }catch(err){
    console.error('FLYMPUS sign-in failed',err);
    showLogin({error:friendlyAuthError(err)})
  }
}
async function signOutCurrentUser(){
  try{
    if(auth&&authSdk)await authSdk.signOut(auth)
  }catch(err){
    console.error('FLYMPUS sign-out failed',err)
  }finally{
    currentUser=null;currentProfile=null;
    api.currentUser=null;api.profile=null;
    clearRoleContext();
    removeAuthenticatedChrome();
    if(enforce||preview)showLogin({setupPreview:preview&&!enabled});else unlockApp()
  }
}
async function ensureUserProfile(user){
  if(!db||!firestoreSdk)throw new Error('Cloud Firestore is not available.');
  if(!user?.uid||!user?.email)throw new Error('The selected account did not provide an email address.');
  const ref=firestoreSdk.doc(db,'users',user.uid);
  const existing=await firestoreSdk.getDoc(ref);
  if(existing.exists())return existing.data();
  const profile={
    uid:user.uid,
    email:user.email,
    displayName:user.displayName||'',
    photoURL:user.photoURL||'',
    providerIds:(user.providerData||[]).map(x=>String(x?.providerId||'')).filter(Boolean),
    role:'user',
    status:'pending',
    createdAt:firestoreSdk.serverTimestamp()
  };
  await firestoreSdk.setDoc(ref,profile);
  return profile
}
function normalizeProfile(profile={}){
  const role=profile.role==='admin'?'admin':'user';
  const status=['active','pending','blocked'].includes(profile.status)?profile.status:'pending';
  return {...profile,role,status}
}
function applyRoleContext(user,profile){
  currentUser=user;currentProfile=profile;
  api.currentUser=user;api.profile=profile;api.status='active';
  document.documentElement.setAttribute('data-flympus-app-role',profile.role);
  syncAuthenticatedChrome(user,profile);
  try{
    document.dispatchEvent(new CustomEvent('flympus:auth-ready',{detail:{
      uid:user.uid,
      email:user.email||'',
      displayName:user.displayName||'',
      role:profile.role,
      status:profile.status
    }}))
  }catch{}
}
function clearRoleContext(){
  document.documentElement.removeAttribute('data-flympus-app-role');
  try{document.dispatchEvent(new CustomEvent('flympus:auth-signed-out'))}catch{}
}
function syncAuthenticatedChrome(user,profile){
  const host=document.querySelector('.personalProfileBody');if(!host)return;
  let box=document.getElementById('flympusSignedInAccount');
  if(!box){box=document.createElement('div');box.id='flympusSignedInAccount';box.className='flympusSignedInAccount';host.appendChild(box)}
  box.innerHTML='<div class="flympusSignedInAccountHead"><b>Signed in</b><span class="flympusSignedInRole">'+esc(profile.role==='admin'?'Administrator':'User')+'</span></div>'+
    '<small>'+esc(user.email||'')+'</small><button class="flympusSignedInSignOut" type="button">Sign out of FLYMPUS</button>';
  box.querySelector('button')?.addEventListener('click',signOutCurrentUser)
}
function removeAuthenticatedChrome(){
  document.getElementById('flympusSignedInAccount')?.remove()
}
async function handleSignedIn(user){
  showLoading('Verifying FLYMPUS access…');
  try{
    const profile=normalizeProfile(await ensureUserProfile(user));
    if(profile.status!=='active'){showPending(user,profile);return}
    applyRoleContext(user,profile);
    unlockApp()
  }catch(err){
    console.error('FLYMPUS profile verification failed',err);
    showFatal('Account verification failed',String(err?.message||'Firestore user access is not configured yet.'))
  }
}
async function boot(){
  if(!enabled){
    api.status='disabled';
    if(preview){showLogin({setupPreview:true})}
    else document.documentElement.classList.remove('flympusAuthBooting','flympusAuthLocked','flympusAuthPreview');
    return
  }
  if(!firebaseConfigReady()){
    showFatal('Firebase setup required','The FLYMPUS Firebase web configuration is incomplete.');
    return
  }
  if(enforce)lockApp();
  showLoading('Starting secure authentication…');
  try{
    const [appModule,authModule,firestoreModule]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-firestore.js')
    ]);
    authSdk=authModule;firestoreSdk=firestoreModule;
    firebaseApp=appModule.initializeApp(cfg.firebase);
    auth=authModule.getAuth(firebaseApp);
    db=firestoreModule.getFirestore(firebaseApp);
    try{await authModule.setPersistence(auth,authModule.browserLocalPersistence)}catch{}
    authUnsubscribe=authModule.onAuthStateChanged(auth,user=>{
      if(user)handleSignedIn(user);
      else{
        currentUser=null;currentProfile=null;api.currentUser=null;api.profile=null;
        clearRoleContext();removeAuthenticatedChrome();
        if(enforce)showLogin();else{api.status='signed-out';unlockApp()}
      }
    },err=>showFatal('Authentication failed',friendlyAuthError(err)))
  }catch(err){
    console.error('FLYMPUS authentication boot failed',err);
    showFatal('Authentication unavailable','Could not load the Firebase authentication service. Check the connection and Firebase setup.')
  }
}
boot();
