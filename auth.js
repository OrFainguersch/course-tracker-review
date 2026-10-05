/* FLYMPUS Authentication foundation
   - Google sign-in through Firebase Authentication
   - Microsoft sign-in remains staged behind an explicit feature flag
   - Firestore user profiles: pending/active/blocked + user/admin
   - No mail/calendar scopes are requested.
   - Production access is enforced after UID-scoped data migration. */
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
let userManagementScrollY=0;
let lastManagedDirectory={users:[],invitations:[]};
let lastManagedError='';
let userManagementPreviousBodyTop='';
let returningScopedSession=!!window.FLYMPUS_STORAGE_SCOPE?.currentUid?.();
let silentAuthLoadingTimer=null;
let silentAuthLoadingCopy='Starting secure authentication…';
let signInPromise=null;

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

const AUTH_HE_UI=Object.freeze({
  'FLYMPUS ACCOUNT':'חשבון FLYMPUS','SECURE SIGN IN':'כניסה מאובטחת','ACCOUNT ACCESS':'גישה לחשבון','AUTHENTICATION':'אימות',
  'Opening FLYMPUS':'פותח את FLYMPUS','Checking your account…':'בודק את החשבון שלך…','Starting secure authentication…':'מפעיל אימות מאובטח…','Verifying FLYMPUS access…':'מאמת הרשאת גישה ל־FLYMPUS…',
  'Sign in to continue':'התחבר כדי להמשיך','Continue with Google':'המשך עם Google','Continue with Microsoft':'המשך עם Microsoft',
  'Use the work or personal account assigned to you. FLYMPUS requests identity only — not access to your Gmail or Outlook mailbox.':'השתמש בחשבון העבודה או בחשבון האישי שהוקצה לך. FLYMPUS מבקש זיהוי בלבד — ללא גישה לתיבת Gmail או Outlook שלך.',
  'Your account email identifies you in FLYMPUS. Application and course permissions are managed separately.':'כתובת המייל מזהה אותך ב־FLYMPUS. הרשאות האפליקציה והרשאות הקורס מנוהלות בנפרד.',
  'Authentication preview':'תצוגת אימות','The Google sign-in experience is ready.':'מסך ההתחברות באמצעות Google מוכן.','Sign-in failed':'ההתחברות נכשלה',
  'Approval required':'נדרש אישור','Access unavailable':'הגישה אינה זמינה','Account blocked':'החשבון חסום','Pending administrator approval':'ממתין לאישור מנהל',
  'Your identity is verified. An administrator still needs to approve access to FLYMPUS.':'הזהות שלך אומתה. מנהל עדיין צריך לאשר לך גישה ל־FLYMPUS.',
  'This FLYMPUS account is currently blocked.':'חשבון FLYMPUS הזה חסום כרגע.','You do not have access to course data until approval is granted.':'אין לך גישה לנתוני הקורס עד לקבלת אישור.',
  'Contact a FLYMPUS administrator if you believe this is incorrect.':'אם לדעתך מדובר בטעות, פנה למנהל FLYMPUS.','Signed-in user':'משתמש מחובר','Sign out':'התנתק','Try again':'נסה שוב',
  'Signed in':'מחובר','Administrator':'מנהל','User':'משתמש','User Management':'ניהול משתמשים','Sign out of FLYMPUS':'התנתקות מ־FLYMPUS',
  'ADMINISTRATION':'ניהול מערכת','Application access is separate from course membership and course roles.':'הרשאת הגישה לאפליקציה נפרדת מהשיוך לקורס ומהתפקיד בקורס.','Close User Management':'סגור ניהול משתמשים',
  'Add user':'הוסף משתמש','Pre-authorize an email before the person signs in for the first time.':'אשר מראש כתובת מייל לפני שהמשתמש מתחבר בפעם הראשונה.',
  'Name (optional)':'שם (אופציונלי)','Email address':'כתובת מייל','App role':'הרשאת אפליקציה','Regular user':'משתמש רגיל',
  'No email is sent. The email is simply authorized to sign in to FLYMPUS.':'לא נשלח מייל. הכתובת פשוט מאושרת מראש להתחברות ל־FLYMPUS.',
  'Invited':'הוזמן','Pending':'ממתין','Active':'פעיל','Blocked':'חסום','Invited users':'משתמשים שהוזמנו','Pending users':'משתמשים ממתינים','Active users':'משתמשים פעילים','Blocked users':'משתמשים חסומים',
  'Current account':'החשבון הנוכחי','Approve':'אשר','Block':'חסום','Reactivate':'הפעל מחדש','Make User':'הפוך למשתמש רגיל','Make Admin':'הפוך למנהל','Remove invite':'בטל הזמנה','Not signed in yet':'טרם התחבר',
  'Unnamed user':'משתמש ללא שם','No email':'ללא מייל','Unknown':'לא ידוע','Loading users…':'טוען משתמשים…','Could not load users':'לא ניתן לטעון משתמשים','Administrator access is required.':'נדרשת הרשאת מנהל.',
  'Enter a valid email address.':'הזן כתובת מייל תקינה.','This is your current account.':'זה החשבון הנוכחי שלך.','Could not add user':'לא ניתן להוסיף משתמש',
  'Remove this invitation?':'לבטל את ההזמנה הזאת?','The email will no longer be pre-authorized for FLYMPUS.':'כתובת המייל לא תהיה עוד מאושרת מראש ל־FLYMPUS.','Remove':'בטל',
  'Approve this user?':'לאשר את המשתמש הזה?','This account will be able to access FLYMPUS.':'החשבון יוכל לגשת ל־FLYMPUS.','Block this user?':'לחסום את המשתמש הזה?','This account will immediately lose application access.':'החשבון יאבד מיד את הגישה לאפליקציה.',
  'Reactivate this user?':'להפעיל מחדש את המשתמש הזה?','This account will regain application access.':'החשבון יקבל מחדש גישה לאפליקציה.','Make this user an administrator?':'להפוך את המשתמש הזה למנהל?','Administrators can approve users and change application access.':'מנהלים יכולים לאשר משתמשים ולשנות הרשאות גישה לאפליקציה.',
  'Remove administrator access?':'להסיר הרשאת מנהל?','The account remains active but loses User Management permissions.':'החשבון יישאר פעיל אך יאבד הרשאות ניהול משתמשים.','Update this user?':'לעדכן את המשתמש הזה?','The account permissions will be changed.':'הרשאות החשבון ישתנו.','Confirm':'אישור','Update failed':'העדכון נכשל',
  'Personal profile':'פרופיל אישי','You can change your personal photo here. Your name, email and course role are managed by course administration.':'כאן ניתן לשנות את התמונה האישית. השם, המייל והתפקיד בקורס מנוהלים על ידי הנהלת הקורס.',
  'Choose photo':'בחר תמונה','Edit photo':'ערוך תמונה','Remove photo':'הסר תמונה',"The photo is compressed and stored with this device's FLYMPUS data.":'התמונה נדחסת ונשמרת עם נתוני FLYMPUS במכשיר הזה.',
  'Notifications':'התראות','Personal':'אישי','No new notifications':'אין התראות חדשות','Your personal updates, assignments and items that need your attention will appear here across all courses.':'עדכונים אישיים, שיוכים ופריטים שדורשים את תשומת לבך יופיעו כאן מכל הקורסים.',
  'Notification preferences':'העדפות התראות','Choose which personal notifications you want to receive across all courses.':'בחר אילו התראות אישיות ברצונך לקבל מכל הקורסים.',
  'Assignments & role changes':'שיוכים ושינויי תפקיד','When you are assigned to a course or your course role changes.':'כאשר משייכים אותך לקורס או משנים את התפקיד שלך בקורס.','Course updates':'עדכוני קורס','Important changes to courses you are assigned to.':'שינויים חשובים בקורסים שאליהם אתה משויך.',
  'Evaluations & drafts':'הערכות וטיוטות','Items that require completion, revision or follow-up.':'פריטים שדורשים השלמה, תיקון או מעקב.','Checks, tests & certifications':'בדיקות, מבחנים והסמכות','Qualification events and certification-related updates.':'אירועי כשירות ועדכונים הקשורים להסמכה.',
  'Required actions & deadlines':'פעולות נדרשות ומועדים','Time-sensitive items that need your attention.':'פריטים תלויי־זמן שדורשים את תשומת לבך.'
});
function authLanguage(){return document.documentElement?.getAttribute('data-flympus-language')==='he'?'he':'en'}
function tr(value){const text=String(value??'');return authLanguage()==='he'?(AUTH_HE_UI[text]||text):text}
function canonicalEmail(value){return String(value||'').trim().toLowerCase()}
function validManagedEmail(value){const email=canonicalEmail(value);return /^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(email)}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function setStaticText(selector,en){const el=document.querySelector(selector);if(el)el.textContent=tr(en)}
function setLeadingText(el,en){if(!el)return;const node=[...el.childNodes].find(x=>x.nodeType===3);if(node)node.nodeValue=tr(en);else el.insertBefore(document.createTextNode(tr(en)),el.firstChild)}
function syncAuthAdjacentChromeLanguage(){
  setStaticText('.notificationHead b','Notifications');setStaticText('.notificationHead span','Personal');setStaticText('.notificationEmpty b','No new notifications');setStaticText('.notificationEmpty p','Your personal updates, assignments and items that need your attention will appear here across all courses.');
  setStaticText('#notificationPreferences>summary','Notification preferences');setStaticText('.notificationPrefsHint','Choose which personal notifications you want to receive across all courses.');
  const copies={assignments:['Assignments & role changes','When you are assigned to a course or your course role changes.'],courseUpdates:['Course updates','Important changes to courses you are assigned to.'],evaluations:['Evaluations & drafts','Items that require completion, revision or follow-up.'],checks:['Checks, tests & certifications','Qualification events and certification-related updates.'],requiredActions:['Required actions & deadlines','Time-sensitive items that need your attention.']};
  Object.entries(copies).forEach(([key,copy])=>{const row=document.querySelector('[data-notification-pref="'+key+'"]')?.closest?.('.notificationPrefRow');const b=row?.querySelector?.('.notificationPrefCopy b'),small=row?.querySelector?.('.notificationPrefCopy small');if(b)b.textContent=tr(copy[0]);if(small)small.textContent=tr(copy[1])});
  setStaticText('.personalProfileIdentity small','Personal profile');const profileCopy=document.querySelector('.personalProfileBody>p:not(.personalPhotoNote)');if(profileCopy)profileCopy.textContent=tr('You can change your personal photo here. Your name, email and course role are managed by course administration.');
  setLeadingText(document.getElementById('choosePersonalPhotoAction'),'Choose photo');setStaticText('#editPersonalPhoto','Edit photo');setStaticText('#removePersonalPhoto','Remove photo');setStaticText('.personalPhotoNote',"The photo is compressed and stored with this device's FLYMPUS data.");
  document.getElementById('topNotificationBtn')?.setAttribute('aria-label',tr('Notifications'));document.getElementById('topPersonalProfileBtn')?.setAttribute('aria-label',tr('Personal profile'))
}
function root(){let el=document.getElementById('flympusAuthRoot');if(el)return el;el=document.createElement('div');el.id='flympusAuthRoot';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','FLYMPUS sign in');el.hidden=true;document.body.appendChild(el);return el}
function shell(body){const el=root();el.dir=authLanguage()==='he'?'rtl':'ltr';el.innerHTML='<div class="flympusAuthShell"><div class="flympusAuthBrand"><img src="./assets/flympus-sidebar-final.webp" alt="FLYMPUS — Train. Track. Progress."></div><section class="flympusAuthCard"><div class="flympusAuthCardBody">'+body+'</div></section></div>';el.hidden=false;return el}
function cancelSilentAuthLoading(){
  if(silentAuthLoadingTimer!==null){clearTimeout(silentAuthLoadingTimer);silentAuthLoadingTimer=null}
}
function scheduleSilentAuthLoading(copy='Starting secure authentication…'){
  silentAuthLoadingCopy=copy;
  if(silentAuthLoadingTimer!==null)return;
  silentAuthLoadingTimer=setTimeout(()=>{
    silentAuthLoadingTimer=null;
    if(api.status==='active'||api.status==='signed-out'||api.status==='pending'||api.status==='blocked'||api.status==='error')return;
    lockApp();
    showLoading(silentAuthLoadingCopy)
  },2200)
}
function lockApp(){document.documentElement.classList.add(preview&&!enabled?'flympusAuthPreview':'flympusAuthLocked');document.documentElement.classList.remove('flympusAuthBooting','flympusAuthReturning')}
function unlockApp(){cancelSilentAuthLoading();document.documentElement.classList.remove('flympusAuthBooting','flympusAuthReturning','flympusAuthLocked','flympusAuthPreview');const el=document.getElementById('flympusAuthRoot');if(el)el.hidden=true}
function statusBlock(kind,title,copy){const icon=kind==='error'?'!':kind==='pending'?'…':'✓';return '<div class="flympusAuthStatus '+esc(kind)+'"><span class="flympusAuthStatusIcon">'+icon+'</span><div><b>'+esc(title)+'</b><span>'+esc(copy)+'</span></div></div>'}
function showLoading(copy='Checking your account…'){api.status='loading';shell('<div class="flympusAuthSpinner" aria-hidden="true"></div><p class="flympusAuthEyebrow">'+esc(tr('SECURE SIGN IN'))+'</p><h1 class="flympusAuthTitle">'+esc(tr('Opening FLYMPUS'))+'</h1><p class="flympusAuthCopy">'+esc(tr(copy))+'</p>')}
function providerButtons(disabled=false){const microsoftButton=cfg.microsoftEnabled===true?'<button class="flympusAuthProvider" type="button" data-auth-provider="microsoft" '+(disabled?'disabled':'')+'><span class="flympusAuthProviderMark flympusMicrosoftMark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>'+esc(tr('Continue with Microsoft'))+'</span><span class="flympusAuthProviderArrow" aria-hidden="true">›</span></button>':'';return '<div class="flympusAuthProviders"><button class="flympusAuthProvider" type="button" data-auth-provider="google" '+(disabled?'disabled':'')+'><span class="flympusAuthProviderMark" aria-hidden="true">G</span><span>'+esc(tr('Continue with Google'))+'</span><span class="flympusAuthProviderArrow" aria-hidden="true">›</span></button>'+microsoftButton+'</div>'}
function bindProviderButtons(){document.querySelectorAll('[data-auth-provider]').forEach(btn=>btn.onclick=()=>signInProvider(btn.dataset.authProvider))}
function setProviderBusy(busy){
  document.querySelectorAll('[data-auth-provider]').forEach(btn=>{
    btn.disabled=!!busy;
    btn.setAttribute('aria-busy',busy?'true':'false')
  })
}
async function waitForSignedInUser(timeoutMs=4500){
  if(auth?.currentUser)return true;
  if(!auth||!authSdk?.onAuthStateChanged)return false;
  return new Promise(resolve=>{
    let done=false,timer=null,unsubscribe=null;
    const finish=value=>{
      if(done)return;
      done=true;
      if(timer!==null)clearTimeout(timer);
      try{unsubscribe?.()}catch{}
      resolve(!!value)
    };
    unsubscribe=authSdk.onAuthStateChanged(auth,user=>{if(user)finish(true)});
    timer=setTimeout(()=>finish(!!auth.currentUser),Math.max(250,Number(timeoutMs)||4500))
  })
}
function showLogin({setupPreview=false,error=''}={}){cancelSilentAuthLoading();api.status=setupPreview?'preview':'signed-out';lockApp();const setup=setupPreview?statusBlock('pending',tr('Authentication preview'),tr('The Google sign-in experience is ready.')):'';const err=error?statusBlock('error',tr('Sign-in failed'),error):'';shell('<p class="flympusAuthEyebrow">'+esc(tr('FLYMPUS ACCOUNT'))+'</p><h1 class="flympusAuthTitle">'+esc(tr('Sign in to continue'))+'</h1><p class="flympusAuthCopy">'+esc(tr('Use the work or personal account assigned to you. FLYMPUS requests identity only — not access to your Gmail or Outlook mailbox.'))+'</p>'+providerButtons(setupPreview)+setup+err+'<p class="flympusAuthFine">'+esc(tr('Your account email identifies you in FLYMPUS. Application and course permissions are managed separately.'))+'</p>');if(!setupPreview)bindProviderButtons()}
function showPending(user,profile){cancelSilentAuthLoading();api.status=profile?.status==='blocked'?'blocked':'pending';lockApp();const blocked=profile?.status==='blocked';shell('<p class="flympusAuthEyebrow">'+esc(tr('ACCOUNT ACCESS'))+'</p><h1 class="flympusAuthTitle">'+esc(tr(blocked?'Access unavailable':'Approval required'))+'</h1><p class="flympusAuthCopy">'+esc(tr(blocked?'This FLYMPUS account is currently blocked.':'Your identity is verified. An administrator still needs to approve access to FLYMPUS.'))+'</p>'+statusBlock(blocked?'error':'pending',tr(blocked?'Account blocked':'Pending administrator approval'),tr(blocked?'Contact a FLYMPUS administrator if you believe this is incorrect.':'You do not have access to course data until approval is granted.'))+'<div class="flympusAuthAccount"><b>'+esc(user.displayName||tr('Signed-in user'))+'</b><span>'+esc(user.email||'')+'</span></div><div class="flympusAuthActions"><button class="flympusAuthAction" type="button" data-auth-signout>'+esc(tr('Sign out'))+'</button></div>');document.querySelector('[data-auth-signout]')?.addEventListener('click',signOutCurrentUser)}
function showFatal(title,copy){cancelSilentAuthLoading();api.status='error';lockApp();shell('<p class="flympusAuthEyebrow">'+esc(tr('AUTHENTICATION'))+'</p><h1 class="flympusAuthTitle">'+esc(tr(title))+'</h1>'+statusBlock('error','FLYMPUS could not complete sign-in',copy)+'<div class="flympusAuthActions"><button class="flympusAuthAction" type="button" data-auth-retry>'+esc(tr('Try again'))+'</button></div>');document.querySelector('[data-auth-retry]')?.addEventListener('click',()=>location.reload())}
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
  if(code==='auth/web-storage-unsupported')return 'This device could not access persistent sign-in storage. Close FLYMPUS completely and try again.';
  return String(err?.message||'Authentication could not be completed.')
}
async function signInProvider(kind){
  if(!enabled||!auth||!authSdk){showLogin({setupPreview:!enabled});return}
  if(signInPromise)return signInPromise;
  if(kind==='microsoft'&&cfg.microsoftEnabled!==true){
    showLogin({error:'Microsoft sign-in is temporarily unavailable. Continue with Google.'});
    return
  }
  const attempt=(async()=>{
    setProviderBusy(true);
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
      /* Keep provider authorization on Firebase's supported popup path.
         Session durability is handled separately by explicit local persistence,
         so OAuth redirect URIs remain the Firebase-managed values. */
      await authSdk.signInWithPopup(auth,provider,authSdk.browserPopupRedirectResolver)
    }catch(err){
      const code=String(err?.code||'');
      /* iOS can report cancelled-popup-request while the already-open Firebase
         web-auth sheet is still completing successfully. Treat that as a
         transient concurrency signal, not as a failed sign-in banner. */
      if(code==='auth/cancelled-popup-request'){
        console.warn('FLYMPUS duplicate popup request suppressed');
        if(await waitForSignedInUser())return;
        showLogin();
        return
      }
      console.error('FLYMPUS sign-in failed',err);
      showLogin({error:friendlyAuthError(err)})
    }finally{
      setProviderBusy(false)
    }
  })();
  signInPromise=attempt;
  try{return await attempt}
  finally{if(signInPromise===attempt)signInPromise=null}
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
  const ref=firestoreSdk.doc(db,'users',user.uid),existing=await firestoreSdk.getDoc(ref);if(existing.exists())return existing.data();
  const email=canonicalEmail(user.email);let invitation=null;
  try{const snap=await firestoreSdk.getDoc(firestoreSdk.doc(db,'invitations',email));if(snap.exists())invitation=snap.data()}catch(err){console.warn('FLYMPUS invitation lookup failed; continuing as pending',err)}
  const preauthorized=invitation?.status==='active'&&canonicalEmail(invitation?.email)===email;
  const profile={uid:user.uid,email,displayName:user.displayName||invitation?.displayName||'',photoURL:user.photoURL||'',providerIds:(user.providerData||[]).map(x=>String(x?.providerId||'')).filter(Boolean),role:preauthorized&&invitation?.role==='admin'?'admin':'user',status:preauthorized?'active':'pending',createdAt:firestoreSdk.serverTimestamp()};
  await firestoreSdk.setDoc(ref,profile);return profile
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
  const host=document.querySelector('.personalProfileBody');if(!host)return;let box=document.getElementById('flympusSignedInAccount');if(!box){box=document.createElement('div');box.id='flympusSignedInAccount';box.className='flympusSignedInAccount';host.appendChild(box)}
  box.innerHTML='<div class="flympusSignedInAccountHead"><b>'+esc(tr('Signed in'))+'</b><span class="flympusSignedInRole">'+esc(tr(profile.role==='admin'?'Administrator':'User'))+'</span></div><small>'+esc(user.email||'')+'</small>'+(profile.role==='admin'?'<button class="flympusSignedInAdmin" type="button" data-auth-user-management>'+esc(tr('User Management'))+'</button>':'')+'<button class="flympusSignedInSignOut" type="button" data-auth-profile-signout>'+esc(tr('Sign out of FLYMPUS'))+'</button>';
  box.querySelector('[data-auth-profile-signout]')?.addEventListener('click',signOutCurrentUser);box.querySelector('[data-auth-user-management]')?.addEventListener('click',openUserManagement);syncAuthAdjacentChromeLanguage()
}
function removeAuthenticatedChrome(){document.getElementById('flympusSignedInAccount')?.remove()}
function closeTransientHeaderMenus(){[['#topCourseDropdown','#topCourseSwitch'],['#topNotificationDropdown','#topNotificationBtn'],['#topPersonalProfileDropdown','#topPersonalProfileBtn']].forEach(([menuSel,buttonSel])=>{const menu=document.querySelector(menuSel),button=document.querySelector(buttonSel);if(menu&&!menu.hidden)menu.hidden=true;button?.setAttribute?.('aria-expanded','false')})}
function bindBottomNavigationOverlayDismissal(){if(window.__FLYMPUS_BOTTOM_DISMISS_BOUND__)return;window.__FLYMPUS_BOTTOM_DISMISS_BOUND__=true;const dismiss=event=>{if(event.target?.closest?.('#mobileBottomNav,[data-mobile-nav],.mobileBottomHapticSwitch'))closeTransientHeaderMenus()};document.addEventListener('touchstart',dismiss,true);document.addEventListener('pointerdown',dismiss,true);document.addEventListener('click',dismiss,true)}
function userManagementRoot(){
  let el=document.getElementById('flympusUserManagementRoot');if(el)return el;el=document.createElement('div');el.id='flympusUserManagementRoot';el.hidden=true;
  el.innerHTML='<div class="flympusUserManagementBackdrop" data-user-management-close></div><section class="flympusUserManagementPanel" role="dialog" aria-modal="true" aria-labelledby="flympusUserManagementTitle"><header><div><p data-user-management-eyebrow></p><h1 id="flympusUserManagementTitle"></h1><span data-user-management-subtitle></span></div><button type="button" class="flympusUserManagementClose" data-user-management-close aria-label="">×</button></header><div class="flympusUserManagementBody" data-user-management-body></div></section>';document.body.appendChild(el);
  el.querySelectorAll('[data-user-management-close]').forEach(btn=>btn.addEventListener('click',closeUserManagement));let lastTouchY=0;el.addEventListener('touchstart',event=>{lastTouchY=Number(event.touches?.[0]?.clientY||0)},{passive:true});el.addEventListener('touchmove',event=>{const touch=event.touches?.[0];if(!touch)return;const scroller=event.target?.closest?.('.flympusUserManagementBody');if(!scroller){if(event.cancelable)event.preventDefault();return}const nextY=Number(touch.clientY||0),dy=nextY-lastTouchY;lastTouchY=nextY;const max=Math.max(0,scroller.scrollHeight-scroller.clientHeight);if((dy>0&&scroller.scrollTop<=0)||(dy<0&&scroller.scrollTop>=max)){if(event.cancelable)event.preventDefault()}},{passive:false});syncUserManagementStaticLanguage(el);return el
}
function syncUserManagementStaticLanguage(el=document.getElementById('flympusUserManagementRoot')){if(!el)return;el.dir=authLanguage()==='he'?'rtl':'ltr';const eyebrow=el.querySelector('[data-user-management-eyebrow]'),title=el.querySelector('#flympusUserManagementTitle'),subtitle=el.querySelector('[data-user-management-subtitle]'),close=el.querySelector('.flympusUserManagementClose');if(eyebrow)eyebrow.textContent=tr('ADMINISTRATION');if(title)title.textContent=tr('User Management');if(subtitle)subtitle.textContent=tr('Application access is separate from course membership and course roles.');close?.setAttribute('aria-label',tr('Close User Management'))}
function closeUserManagement(){const el=document.getElementById('flympusUserManagementRoot');if(el)el.hidden=true;document.documentElement.classList.remove('flympusUserManagementOpen');if(document.body)document.body.style.top=userManagementPreviousBodyTop;window.scrollTo(0,userManagementScrollY)}
function userProviderLabel(profile){const providers=Array.isArray(profile?.providerIds)?profile.providerIds:[];if(providers.includes('microsoft.com'))return 'Microsoft';if(providers.includes('google.com'))return 'Google';return providers.length?providers.join(', '):tr('Unknown')}
function managementStatusLabel(status){if(status==='invited')return tr('Invited');return status==='active'?tr('Active'):status==='blocked'?tr('Blocked'):tr('Pending')}
function managementGroupLabel(status){return tr(status==='invited'?'Invited users':status==='active'?'Active users':status==='blocked'?'Blocked users':'Pending users')}
function managementRoleLabel(role){return role==='admin'?tr('Administrator'):tr('User')}
function managementActionButton(action,uid,label,tone=''){return '<button type="button" class="flympusUserAction '+esc(tone)+'" data-user-action="'+esc(action)+'" data-user-uid="'+esc(uid)+'">'+esc(tr(label))+'</button>'}
function managementInviteActionButton(action,email,label,tone=''){return '<button type="button" class="flympusUserAction '+esc(tone)+'" data-invite-action="'+esc(action)+'" data-invite-email="'+esc(email)+'">'+esc(tr(label))+'</button>'}
function managementEmptyLabel(status){return authLanguage()==='he'?(status==='invited'?'אין משתמשים שהוזמנו.':status==='active'?'אין משתמשים פעילים.':status==='blocked'?'אין משתמשים חסומים.':'אין משתמשים ממתינים.'):'No '+status+' users.'}
function invitationCard(invite){const name=String(invite.displayName||'').trim(),email=canonicalEmail(invite.email),role=invite.role==='admin'?'admin':'user',actions=managementInviteActionButton(role==='admin'?'invite-user':'invite-admin',email,role==='admin'?'Make User':'Make Admin')+managementInviteActionButton('remove-invite',email,'Remove invite','danger');return '<article class="flympusUserCard invited"><div class="flympusUserAvatar">'+esc(String(name||email||'?').slice(0,1).toUpperCase())+'</div><div class="flympusUserIdentity"><b>'+esc(name||email)+'</b><span>'+esc(email)+'</span><div class="flympusUserMeta"><i>'+esc(tr('Not signed in yet'))+'</i><i class="status invited">'+esc(managementStatusLabel('invited'))+'</i><i class="role">'+esc(managementRoleLabel(role))+'</i></div></div><div class="flympusUserActions">'+actions+'</div></article>'}
function renderUserManagement(directory,error=''){
  const el=userManagementRoot(),body=el.querySelector('[data-user-management-body]');syncUserManagementStaticLanguage(el);const users=Array.isArray(directory)?directory:(directory?.users||[]),invitations=Array.isArray(directory?.invitations)?directory.invitations:[];lastManagedDirectory={users:[...users],invitations:[...invitations]};lastManagedError=error;
  const normalized=users.map(x=>normalizeProfile(x)),counts={invited:invitations.length,pending:0,active:0,blocked:0};normalized.forEach(x=>counts[x.status]++);const tabs=['invited','pending','active','blocked'];
  const addForm='<section class="flympusUserInviteBox"><div class="flympusUserInviteHead"><h2>'+esc(tr('Add user'))+'</h2><p>'+esc(tr('Pre-authorize an email before the person signs in for the first time.'))+'</p></div><form class="flympusUserInviteForm" data-user-invite-form><label><span>'+esc(tr('Name (optional)'))+'</span><input name="displayName" autocomplete="name"></label><label class="email"><span>'+esc(tr('Email address'))+'</span><input name="email" type="email" inputmode="email" autocomplete="email" required></label><label><span>'+esc(tr('App role'))+'</span><select name="role"><option value="user">'+esc(tr('Regular user'))+'</option><option value="admin">'+esc(tr('Administrator'))+'</option></select></label><button class="flympusUserAddButton" type="submit">'+esc(tr('Add user'))+'</button><small>'+esc(tr('No email is sent. The email is simply authorized to sign in to FLYMPUS.'))+'</small></form></section>';
  const groupHtml=status=>{if(status==='invited'){const rows=invitations.slice().sort((a,b)=>String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||'')));return '<section class="flympusUserGroup"><div class="flympusUserGroupHead"><h2>'+esc(managementGroupLabel(status))+'</h2><span>'+rows.length+'</span></div><div class="flympusUserList">'+(rows.length?rows.map(invitationCard).join(''):'<div class="flympusUserEmpty">'+esc(managementEmptyLabel(status))+'</div>')+'</div></section>'}
    const rows=normalized.filter(user=>user.status===status).sort((a,b)=>String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||'')));return '<section class="flympusUserGroup"><div class="flympusUserGroupHead"><h2>'+esc(managementGroupLabel(status))+'</h2><span>'+rows.length+'</span></div><div class="flympusUserList">'+(rows.length?rows.map(user=>{const self=user.uid===currentUser?.uid;let actions='';if(self)actions='<span class="flympusCurrentAdmin">'+esc(tr('Current account'))+'</span>';else if(status==='pending')actions=managementActionButton('approve',user.uid,'Approve','primary')+managementActionButton('block',user.uid,'Block','danger');else if(status==='active')actions=managementActionButton(user.role==='admin'?'make-user':'make-admin',user.uid,user.role==='admin'?'Make User':'Make Admin')+managementActionButton('block',user.uid,'Block','danger');else actions=managementActionButton('reactivate',user.uid,'Reactivate','primary')+managementActionButton(user.role==='admin'?'make-user':'make-admin',user.uid,user.role==='admin'?'Make User':'Make Admin');return '<article class="flympusUserCard"><div class="flympusUserAvatar">'+esc(String(user.displayName||user.email||'?').trim().slice(0,1).toUpperCase())+'</div><div class="flympusUserIdentity"><b>'+esc(user.displayName||tr('Unnamed user'))+'</b><span>'+esc(user.email||tr('No email'))+'</span><div class="flympusUserMeta"><i>'+esc(userProviderLabel(user))+'</i><i class="status '+esc(user.status)+'">'+esc(managementStatusLabel(user.status))+'</i><i class="role">'+esc(managementRoleLabel(user.role))+'</i></div></div><div class="flympusUserActions">'+actions+'</div></article>'}).join(''):'<div class="flympusUserEmpty">'+esc(managementEmptyLabel(status))+'</div>')+'</div></section>'};
  body.innerHTML=(error?statusBlock('error',tr('Could not load users'),error):'')+addForm+'<div class="flympusUserSummary">'+tabs.map(status=>'<div><strong>'+counts[status]+'</strong><span>'+esc(managementStatusLabel(status))+'</span></div>').join('')+'</div>'+tabs.map(groupHtml).join('');
  body.querySelector('[data-user-invite-form]')?.addEventListener('submit',event=>{event.preventDefault();addManagedUser(event.currentTarget)});body.querySelectorAll('[data-user-action]').forEach(btn=>btn.addEventListener('click',()=>updateManagedUser(btn.dataset.userUid,btn.dataset.userAction,btn)));body.querySelectorAll('[data-invite-action]').forEach(btn=>btn.addEventListener('click',()=>updateManagedInvitation(btn.dataset.inviteEmail,btn.dataset.inviteAction,btn)))
}
async function loadManagedUsers(){if(!api.isAdmin()||!db||!firestoreSdk)throw new Error(tr('Administrator access is required.'));const snapshot=await firestoreSdk.getDocs(firestoreSdk.collection(db,'users'));return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))}
async function loadManagedInvitations(){if(!api.isAdmin()||!db||!firestoreSdk)throw new Error(tr('Administrator access is required.'));const snapshot=await firestoreSdk.getDocs(firestoreSdk.collection(db,'invitations'));return snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).filter(x=>x.status==='active')}
async function loadManagedDirectory(){const [users,invitations]=await Promise.all([loadManagedUsers(),loadManagedInvitations()]);const existingEmails=new Set(users.map(x=>canonicalEmail(x.email)).filter(Boolean));return{users,invitations:invitations.filter(x=>!existingEmails.has(canonicalEmail(x.email)))}}
async function openUserManagement(){if(!api.isAdmin())return;closeTransientHeaderMenus();const el=userManagementRoot(),body=el.querySelector('[data-user-management-body]');userManagementScrollY=Math.max(0,Number(window.scrollY||document.scrollingElement?.scrollTop||0));userManagementPreviousBodyTop=document.body?.style?.top||'';if(document.body)document.body.style.top='-'+userManagementScrollY+'px';el.hidden=false;document.documentElement.classList.add('flympusUserManagementOpen');body.innerHTML='<div class="flympusUserManagementLoading"><div class="flympusAuthSpinner"></div><span>'+esc(tr('Loading users…'))+'</span></div>';try{renderUserManagement(await loadManagedDirectory())}catch(err){renderUserManagement({users:[],invitations:[]},String(err?.message||'Firestore rejected this request.'))}}
async function addManagedUser(form){
  if(!api.isAdmin()||!db||!firestoreSdk)return;const fd=new FormData(form),email=canonicalEmail(fd.get('email')),displayName=String(fd.get('displayName')||'').trim(),role=String(fd.get('role'))==='admin'?'admin':'user';if(!validManagedEmail(email)){renderUserManagement(lastManagedDirectory,tr('Enter a valid email address.'));return}const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{const directory=await loadManagedDirectory(),existing=directory.users.find(x=>canonicalEmail(x.email)===email);if(existing?.uid===currentUser?.uid){renderUserManagement(directory,tr('This is your current account.'));return}if(existing){await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',existing.uid),{role,status:'active',updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid});renderUserManagement(await loadManagedDirectory());return}const ref=firestoreSdk.doc(db,'invitations',email),old=await firestoreSdk.getDoc(ref),payload={email,displayName,role,status:'active',updatedAt:firestoreSdk.serverTimestamp(),invitedBy:currentUser.uid};if(!old.exists())payload.createdAt=firestoreSdk.serverTimestamp();await firestoreSdk.setDoc(ref,payload,{merge:true});form.reset();renderUserManagement(await loadManagedDirectory())}catch(err){console.error('FLYMPUS add-user failed',err);if(button)button.disabled=false;renderUserManagement(lastManagedDirectory,String(err?.message||tr('Could not add user')))}
}
async function updateManagedInvitation(email,action,button){if(!api.isAdmin()||!validManagedEmail(email))return;const ref=firestoreSdk.doc(db,'invitations',canonicalEmail(email));button.disabled=true;try{if(action==='remove-invite'){const ok=typeof window.siteConfirm==='function'?await window.siteConfirm(tr('The email will no longer be pre-authorized for FLYMPUS.'),{title:tr('Remove this invitation?'),confirmLabel:tr('Remove'),tone:'danger'}):false;if(!ok){button.disabled=false;return}await firestoreSdk.deleteDoc(ref)}else{const role=action==='invite-admin'?'admin':'user';await firestoreSdk.setDoc(ref,{role,updatedAt:firestoreSdk.serverTimestamp(),invitedBy:currentUser.uid},{merge:true})}renderUserManagement(await loadManagedDirectory())}catch(err){console.error('FLYMPUS invitation update failed',err);button.disabled=false;renderUserManagement(lastManagedDirectory,String(err?.message||tr('Update failed')))}}
async function confirmManagedUserAction(action){const copy={approve:['Approve this user?','This account will be able to access FLYMPUS.'],block:['Block this user?','This account will immediately lose application access.'],reactivate:['Reactivate this user?','This account will regain application access.'],'make-admin':['Make this user an administrator?','Administrators can approve users and change application access.'],'make-user':['Remove administrator access?','The account remains active but loses User Management permissions.']}[action]||['Update this user?','The account permissions will be changed.'];if(typeof window.siteConfirm==='function')return window.siteConfirm(tr(copy[1]),{title:tr(copy[0]),confirmLabel:tr('Confirm'),tone:action==='block'?'danger':'primary'});return false}
async function updateManagedUser(uid,action,button){if(!api.isAdmin()||!uid||uid===currentUser?.uid)return;if(!(await confirmManagedUserAction(action)))return;const changes={updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid};if(action==='approve'||action==='reactivate')changes.status='active';if(action==='block')changes.status='blocked';if(action==='make-admin')changes.role='admin';if(action==='make-user')changes.role='user';button.disabled=true;try{await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',uid),changes);renderUserManagement(await loadManagedDirectory())}catch(err){console.error('FLYMPUS user-management update failed',err);button.disabled=false;renderUserManagement(lastManagedDirectory,String(err?.message||tr('Update failed')))}}
function bindAuthLanguageSync(){if(window.__FLYMPUS_AUTH_LANGUAGE_BOUND__)return;window.__FLYMPUS_AUTH_LANGUAGE_BOUND__=true;syncAuthAdjacentChromeLanguage();if(typeof MutationObserver!=='function')return;const observer=new MutationObserver(records=>{if(!records.some(x=>x.attributeName==='data-flympus-language'))return;syncAuthAdjacentChromeLanguage();if(currentUser&&currentProfile)syncAuthenticatedChrome(currentUser,currentProfile);const manager=document.getElementById('flympusUserManagementRoot');if(manager&&!manager.hidden)renderUserManagement(lastManagedDirectory,lastManagedError)});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-flympus-language']})}
async function handleSignedIn(user){
  if(returningScopedSession)scheduleSilentAuthLoading('Verifying FLYMPUS access…');
  else showLoading('Verifying FLYMPUS access…');
  try{
    const profile=normalizeProfile(await ensureUserProfile(user));
    const scopeChanged=window.FLYMPUS_STORAGE_SCOPE?.setUid?.(user.uid)===true;
    if(profile.status!=='active'){showPending(user,profile);return}
    let migratedLegacyCount=0;
    if(profile.role==='admin'){
      const migration=window.FLYMPUS_STORAGE_SCOPE?.claimLegacy?.(user.uid,{admin:true});
      migratedLegacyCount=Number(migration?.count||0)
    }
    /* A new UID scope and a legacy claim used to trigger two consecutive
       reloads. Apply both mutations first, then rehydrate the app once. */
    if(scopeChanged||migratedLegacyCount>0){location.reload();return}
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
    else document.documentElement.classList.remove('flympusAuthBooting','flympusAuthReturning','flympusAuthLocked','flympusAuthPreview');
    return
  }
  if(!firebaseConfigReady()){
    showFatal('Firebase setup required','The FLYMPUS Firebase web configuration is incomplete.');
    return
  }
  if(enforce&&!returningScopedSession)lockApp();
  if(returningScopedSession)scheduleSilentAuthLoading('Starting secure authentication…');
  else showLoading('Starting secure authentication…');
  try{
    const [appModule,authModule,firestoreModule]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-firestore.js')
    ]);
    authSdk=authModule;firestoreSdk=firestoreModule;
    firebaseApp=appModule.initializeApp(cfg.firebase);
    /* Prefer localStorage persistence explicitly. Firebase 12.19 may fall back
       to in-memory state when IndexedDB is unavailable during an iOS lifecycle
       transition; that is safe but would look like a logout after a cold PWA
       relaunch. localStorage is already required and verified by FLYMPUS. */
    /* Use exactly one durable persistence layer. Firebase can migrate a user
       between entries when a persistence array is supplied; on iOS that makes
       auth state depend on IndexedDB lifecycle as well as localStorage. FLYMPUS
       only needs LOCAL persistence, so keep the user in localStorage and let
       Firebase own the popup resolver on this Auth instance. */
    auth=authModule.initializeAuth(firebaseApp,{
      persistence:authModule.browserLocalPersistence,
      popupRedirectResolver:authModule.browserPopupRedirectResolver
    });
    db=firestoreModule.getFirestore(firebaseApp);
    try{
      localStorage.removeItem('firebase:flympus:idp-session');
      localStorage.removeItem('firebase:flympus:idp-return')
    }catch{}
    /* Firebase restores persisted browser auth asynchronously. Do not attach the
       signed-out branch until that initial restoration is complete: on iOS,
       rapid refreshes can otherwise expose a transient null user and our
       fail-closed handler would incorrectly clear the verified UID scope. */
    if(typeof auth.authStateReady==='function')await auth.authStateReady();
    authUnsubscribe=authModule.onAuthStateChanged(auth,user=>{
      if(user)handleSignedIn(user);
      else{
        cancelSilentAuthLoading();returningScopedSession=false;
        currentUser=null;currentProfile=null;api.currentUser=null;api.profile=null;
        clearRoleContext();removeAuthenticatedChrome();
        /* A passive Firebase null is not an explicit FLYMPUS sign-out. Keep the
           last verified UID namespace intact while the login gate is locked.
           Only signOutCurrentUser() may clear the durable UID hint. This avoids
           destroying/reloading the local scope when iOS momentarily loses the
           Firebase session during a lifecycle transition. */
        if(enforce||setupMode)showLogin();else{api.status='signed-out';unlockApp()}
      }
    },err=>showFatal('Authentication failed',friendlyAuthError(err)))
  }catch(err){
    console.error('FLYMPUS authentication boot failed',err);
    showFatal('Authentication unavailable','Could not load the Firebase authentication service. Check the connection and Firebase setup.')
  }
}
bindBottomNavigationOverlayDismissal();
bindAuthLanguageSync();
boot();
