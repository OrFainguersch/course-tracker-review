/* FLYMPUS Authentication foundation
   - Google + Microsoft sign-in through Firebase Authentication
   - Firestore user profiles: pending/active/blocked + user/admin
   - No mail/calendar scopes are requested.
   - Production enforcement stays off until UID-scoped data migration is ready. */
const cfg=window.FLYMPUS_FIREBASE_CONFIG||{};
const params=new URLSearchParams(location.search);
const preview=params.get('authPreview')==='1';
const setupMode=params.get('authSetup')==='1';
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
  openUserManagement:()=>openUserManagement(),
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
    const scopeChanged=window.FLYMPUS_STORAGE_SCOPE?.clearUid?.()===true;
    if(scopeChanged){location.reload();return}
    if(enforce||preview||setupMode)showLogin({setupPreview:preview&&!enabled});else unlockApp()
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
    '<small>'+esc(user.email||'')+'</small>'+
    (profile.role==='admin'?'<button class="flympusSignedInAdmin" type="button" data-auth-user-management>User Management</button>':'')+
    '<button class="flympusSignedInSignOut" type="button" data-auth-profile-signout>Sign out of FLYMPUS</button>';
  box.querySelector('[data-auth-profile-signout]')?.addEventListener('click',signOutCurrentUser);
  box.querySelector('[data-auth-user-management]')?.addEventListener('click',openUserManagement)
}
function removeAuthenticatedChrome(){
  document.getElementById('flympusSignedInAccount')?.remove()
}
function userManagementRoot(){
  let el=document.getElementById('flympusUserManagementRoot');
  if(el)return el;
  el=document.createElement('div');
  el.id='flympusUserManagementRoot';
  el.hidden=true;
  el.innerHTML='<div class="flympusUserManagementBackdrop" data-user-management-close></div><section class="flympusUserManagementPanel" role="dialog" aria-modal="true" aria-labelledby="flympusUserManagementTitle"><header><div><p>ADMINISTRATION</p><h1 id="flympusUserManagementTitle">User Management</h1><span>Application access is separate from course membership and course roles.</span></div><button type="button" class="flympusUserManagementClose" data-user-management-close aria-label="Close User Management">×</button></header><div class="flympusUserManagementBody" data-user-management-body></div></section>';
  document.body.appendChild(el);
  el.querySelectorAll('[data-user-management-close]').forEach(btn=>btn.addEventListener('click',closeUserManagement));
  return el
}
function closeUserManagement(){
  const el=document.getElementById('flympusUserManagementRoot');
  if(el)el.hidden=true;
  document.documentElement.classList.remove('flympusUserManagementOpen')
}
function userProviderLabel(profile){
  const providers=Array.isArray(profile?.providerIds)?profile.providerIds:[];
  if(providers.includes('microsoft.com'))return 'Microsoft';
  if(providers.includes('google.com'))return 'Google';
  return providers.length?providers.join(', '):'Unknown'
}
function managementStatusLabel(status){return status==='active'?'Active':status==='blocked'?'Blocked':'Pending'}
function managementRoleLabel(role){return role==='admin'?'Admin':'User'}
function managementActionButton(action,uid,label,tone=''){
  return '<button type="button" class="flympusUserAction '+esc(tone)+'" data-user-action="'+esc(action)+'" data-user-uid="'+esc(uid)+'">'+esc(label)+'</button>'
}
function renderUserManagement(users,error=''){
  const el=userManagementRoot(),body=el.querySelector('[data-user-management-body]');
  const normalized=(users||[]).map(x=>normalizeProfile(x));
  const counts={pending:0,active:0,blocked:0};normalized.forEach(x=>counts[x.status]++);
  const tabs=['pending','active','blocked'];
  body.innerHTML=(error?statusBlock('error','Could not load users',error):'')+
    '<div class="flympusUserSummary">'+tabs.map(status=>'<div><strong>'+counts[status]+'</strong><span>'+managementStatusLabel(status)+'</span></div>').join('')+'</div>'+
    tabs.map(status=>{
      const rows=normalized.filter(user=>user.status===status).sort((a,b)=>String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||'')));
      return '<section class="flympusUserGroup"><div class="flympusUserGroupHead"><h2>'+managementStatusLabel(status)+' users</h2><span>'+rows.length+'</span></div><div class="flympusUserList">'+(rows.length?rows.map(user=>{
        const self=user.uid===currentUser?.uid;
        let actions='';
        if(self)actions='<span class="flympusCurrentAdmin">Current account</span>';
        else if(status==='pending')actions=managementActionButton('approve',user.uid,'Approve','primary')+managementActionButton('block',user.uid,'Block','danger');
        else if(status==='active')actions=managementActionButton(user.role==='admin'?'make-user':'make-admin',user.uid,user.role==='admin'?'Make User':'Make Admin')+managementActionButton('block',user.uid,'Block','danger');
        else actions=managementActionButton('reactivate',user.uid,'Reactivate','primary')+managementActionButton(user.role==='admin'?'make-user':'make-admin',user.uid,user.role==='admin'?'Make User':'Make Admin');
        return '<article class="flympusUserCard"><div class="flympusUserAvatar">'+esc(String(user.displayName||user.email||'?').trim().slice(0,1).toUpperCase())+'</div><div class="flympusUserIdentity"><b>'+esc(user.displayName||'Unnamed user')+'</b><span>'+esc(user.email||'No email')+'</span><div class="flympusUserMeta"><i>'+esc(userProviderLabel(user))+'</i><i class="status '+esc(user.status)+'">'+esc(managementStatusLabel(user.status))+'</i><i class="role">'+esc(managementRoleLabel(user.role))+'</i></div></div><div class="flympusUserActions">'+actions+'</div></article>'
      }).join(''):'<div class="flympusUserEmpty">No '+esc(status)+' users.</div>')+'</div></section>'
    }).join('');
  body.querySelectorAll('[data-user-action]').forEach(btn=>btn.addEventListener('click',()=>updateManagedUser(btn.dataset.userUid,btn.dataset.userAction,btn)))
}
async function loadManagedUsers(){
  if(!api.isAdmin()||!db||!firestoreSdk)throw new Error('Administrator access is required.');
  const snapshot=await firestoreSdk.getDocs(firestoreSdk.collection(db,'users'));
  return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))
}
async function openUserManagement(){
  if(!api.isAdmin())return;
  const el=userManagementRoot(),body=el.querySelector('[data-user-management-body]');
  el.hidden=false;document.documentElement.classList.add('flympusUserManagementOpen');
  body.innerHTML='<div class="flympusUserManagementLoading"><div class="flympusAuthSpinner"></div><span>Loading users…</span></div>';
  try{renderUserManagement(await loadManagedUsers())}
  catch(err){renderUserManagement([],String(err?.message||'Firestore rejected this request.'))}
}
async function confirmManagedUserAction(action){
  const copy={
    approve:['Approve this user?','This account will be able to access FLYMPUS.'],
    block:['Block this user?','This account will immediately lose application access.'],
    reactivate:['Reactivate this user?','This account will regain application access.'],
    'make-admin':['Make this user an administrator?','Administrators can approve users and change application access.'],
    'make-user':['Remove administrator access?','The account remains active but loses User Management permissions.']
  }[action]||['Update this user?','The account permissions will be changed.'];
  if(typeof window.siteConfirm==='function')return window.siteConfirm(copy[1],{title:copy[0],confirmLabel:'Confirm',tone:action==='block'?'danger':'primary'});
  return false
}
async function updateManagedUser(uid,action,button){
  if(!api.isAdmin()||!uid||uid===currentUser?.uid)return;
  if(!(await confirmManagedUserAction(action)))return;
  const changes={updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid};
  if(action==='approve'||action==='reactivate')changes.status='active';
  if(action==='block')changes.status='blocked';
  if(action==='make-admin')changes.role='admin';
  if(action==='make-user')changes.role='user';
  button.disabled=true;
  try{
    await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',uid),changes);
    renderUserManagement(await loadManagedUsers())
  }catch(err){
    console.error('FLYMPUS user-management update failed',err);
    button.disabled=false;
    const body=userManagementRoot().querySelector('[data-user-management-body]');
    body.insertAdjacentHTML('afterbegin',statusBlock('error','Update failed',String(err?.message||'Firestore rejected this update.')))
  }
}
async function handleSignedIn(user){
  showLoading('Verifying FLYMPUS access…');
  try{
    const profile=normalizeProfile(await ensureUserProfile(user));
    const scopeChanged=window.FLYMPUS_STORAGE_SCOPE?.setUid?.(user.uid)===true;
    if(scopeChanged){location.reload();return}
    if(profile.status!=='active'){showPending(user,profile);return}
    if(profile.role==='admin'){
      const migration=window.FLYMPUS_STORAGE_SCOPE?.claimLegacy?.(user.uid,{admin:true});
      if(Number(migration?.count||0)>0){location.reload();return}
    }
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
        const scopeChanged=window.FLYMPUS_STORAGE_SCOPE?.clearUid?.()===true;
        if(scopeChanged){location.reload();return}
        if(enforce||setupMode)showLogin();else{api.status='signed-out';unlockApp()}
      }
    },err=>showFatal('Authentication failed',friendlyAuthError(err)))
  }catch(err){
    console.error('FLYMPUS authentication boot failed',err);
    showFatal('Authentication unavailable','Could not load the Firebase authentication service. Check the connection and Firebase setup.')
  }
}
boot();
