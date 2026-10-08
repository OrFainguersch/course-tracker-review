/* FLYMPUS Authentication foundation
   - Google sign-in through Firebase Authentication
   - Microsoft sign-in remains staged behind an explicit feature flag
   - Firestore user profiles: pending/active/blocked + user/admin
   - No mail/calendar scopes are requested; invitation email delivery, when configured, uses a dedicated authenticated backend endpoint.
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
let managedDirectoryCache=null;
let managedDirectoryPromise=null;
let managedNameEditUid='';
let primaryOwnerUid='';
let userManagementCloseTimer=null;
let returningScopedSession=!!window.FLYMPUS_STORAGE_SCOPE?.currentUid?.();
let silentAuthLoadingTimer=null;
let silentAuthLoadingCopy='Starting secure authentication…';
let signInPromise=null;
let authStateVersion=0;
let accountSwitcher=null;
const VERIFIED_ACTIVE_KEY='flympus-auth-verified-active-v1';

function verifiedActiveRecord(){
  try{
    const value=JSON.parse(localStorage.getItem(VERIFIED_ACTIVE_KEY)||'null');
    return value&&typeof value==='object'?value:null
  }catch{return null}
}
function markVerifiedActive(user,profile){
  if(!user?.uid||profile?.status!=='active')return;
  try{
    localStorage.setItem(VERIFIED_ACTIVE_KEY,JSON.stringify({
      uid:String(user.uid),
      status:'active',
      role:normalizeAppRole(profile.role),
      verifiedAt:Date.now()
    }))
  }catch{}
}
function clearVerifiedActive(){
  try{localStorage.removeItem(VERIFIED_ACTIVE_KEY)}catch{}
}
function trustedVisualResumeFor(uid=returningScopedSession?window.FLYMPUS_STORAGE_SCOPE?.currentUid?.():''){
  const record=verifiedActiveRecord();
  return !!(uid&&record?.uid===String(uid)&&record?.status==='active'&&document.documentElement.classList.contains('flympusAuthResuming'))
}

const APP_ROLE_ORDER=Object.freeze(['user','training_manager','admin','owner']);
const APP_ROLE_DEFINITIONS=Object.freeze({
  owner:Object.freeze({
    label:'Owner',
    description:'Complete control of FLYMPUS. An Owner may appoint another Owner, an Administrator, a Training Manager or a User, and may manage every role below Owner. The Primary Owner remains protected.',
    capabilities:Object.freeze(['users.manage','courses.create','courses.manageAll','courses.manageAssigned','packages.manageGlobal','packages.overrideCourse','roster.manage','evaluations.write'])
  }),
  admin:Object.freeze({
    label:'Administrator',
    description:'Manages lower-level accounts and all training operations. An Administrator may appoint a Training Manager or a User, but cannot appoint another Administrator or an Owner.',
    capabilities:Object.freeze(['users.manage','courses.create','courses.manageAll','courses.manageAssigned','packages.manageGlobal','packages.overrideCourse','roster.manage','evaluations.write'])
  }),
  training_manager:Object.freeze({
    label:'Training Manager',
    description:'Creates and manages training, course rosters and course-specific Package changes. A Training Manager may invite, approve and appoint Users, but cannot appoint another Training Manager or any higher role.',
    capabilities:Object.freeze(['users.manage','courses.create','courses.manageAssigned','packages.overrideCourse','roster.manage','evaluations.write'])
  }),
  user:Object.freeze({
    label:'User',
    description:'Works inside assigned courses and records operational data such as evaluations and forms, without changing course structure, rosters or Packages.',
    capabilities:Object.freeze(['evaluations.write'])
  })
});
function normalizeAppRole(role){return APP_ROLE_ORDER.includes(String(role||''))?String(role):'user'}
function roleDefinition(role){return APP_ROLE_DEFINITIONS[normalizeAppRole(role)]||APP_ROLE_DEFINITIONS.user}
function hasCapability(capability,profile=currentProfile){return profile?.status==='active'&&roleDefinition(profile?.role).capabilities.includes(String(capability||''))}
function canManageUsers(profile=currentProfile){return hasCapability('users.manage',profile)}
const api=window.FLYMPUS_AUTH={
  status:enabled?'booting':'disabled',
  currentUser:null,
  profile:null,
  openLogin:()=>{lockApp();showLogin()},
  signInGoogle:()=>signInProvider('google'),
  signInMicrosoft:()=>signInProvider('microsoft'),
  signOut:()=>signOutCurrentUser(),
  switchAccount:uid=>accountSwitcher?.select(uid),
  addAnotherAccount:kind=>accountSwitcher?.add(kind),
  refreshAccountSwitcher:()=>accountSwitcher?.refresh(),
  openUserManagement:()=>openUserManagement(),
  mountUserManagementPage:host=>mountUserManagementPage(host),
  updateNickname:name=>updateOwnPreferredName(name),
  updatePreferredName:name=>updateOwnPreferredName(name),
  updateOfficialName:name=>updateOwnOfficialName(name),
  updateDisplayName:name=>updateOwnOfficialName(name),
  updateManagedOfficialName:(uid,name)=>updateManagedUserOfficialName(uid,name),
  updateManagedDisplayName:(uid,name)=>updateManagedUserOfficialName(uid,name),
  isAdmin:()=>canManageUsers(),
  isOwner:()=>currentProfile?.status==='active'&&currentProfile?.role==='owner',
  isActive:()=>currentProfile?.status==='active',
  can:capability=>hasCapability(capability),
  role:()=>normalizeAppRole(currentProfile?.role),
  roleDefinition:role=>roleDefinition(role),
  refreshSession:()=>refreshCurrentSession()
};

const AUTH_HE_UI=Object.freeze({
  'FLYMPUS ACCOUNT':'חשבון FLYMPUS','SECURE SIGN IN':'כניסה מאובטחת','ACCOUNT ACCESS':'גישה לחשבון','AUTHENTICATION':'אימות',
  'Opening FLYMPUS':'פותח את FLYMPUS','Checking your account…':'בודק את החשבון שלך…','Starting secure authentication…':'מפעיל אימות מאובטח…','Verifying FLYMPUS access…':'מאמת הרשאת גישה ל־FLYMPUS…',
  'Sign in to continue':'התחבר כדי להמשיך','Sign in to FLYMPUS':'כניסה ל־FLYMPUS','Continue with the Google account assigned to you.':'התחבר עם חשבון Google שהוקצה לך.','FLYMPUS uses your account only to verify your identity. It does not read your Gmail or Outlook.':'FLYMPUS משתמש בחשבון רק לצורך זיהוי. אין לו גישה ל־Gmail או ל־Outlook שלך.','Opening Google…':'פותח את Google…','Continue with Google':'המשך עם Google','Continue with Microsoft':'המשך עם Microsoft',
  'Use the work or personal account assigned to you. FLYMPUS requests identity only — not access to your Gmail or Outlook mailbox.':'השתמש בחשבון העבודה או בחשבון האישי שהוקצה לך. FLYMPUS מבקש זיהוי בלבד — ללא גישה לתיבת Gmail או Outlook שלך.',
  'Your account email identifies you in FLYMPUS. Application and course permissions are managed separately.':'כתובת המייל מזהה אותך ב־FLYMPUS. הרשאות האפליקציה והרשאות הקורס מנוהלות בנפרד.',
  'Authentication preview':'תצוגת אימות','The Google sign-in experience is ready.':'מסך ההתחברות באמצעות Google מוכן.','Sign-in failed':'ההתחברות נכשלה',
  'Approval required':'נדרש אישור','Access unavailable':'הגישה אינה זמינה','Account blocked':'החשבון חסום','Pending administrator approval':'ממתין לאישור מנהל',
  'Your identity is verified. An administrator still needs to approve access to FLYMPUS.':'הזהות שלך אומתה. מנהל עדיין צריך לאשר לך גישה ל־FLYMPUS.',
  'This FLYMPUS account is currently blocked.':'חשבון FLYMPUS הזה חסום כרגע.','You do not have access to course data until approval is granted.':'אין לך גישה לנתוני הקורס עד לקבלת אישור.',
  'Contact a FLYMPUS administrator if you believe this is incorrect.':'אם לדעתך מדובר בטעות, פנה למנהל FLYMPUS.','Signed-in user':'משתמש מחובר','Sign out':'התנתק','Try again':'נסה שוב',
  'Signed in':'מחובר','Owner':'בעלים','Administrator':'מנהל מערכת','Training Manager':'מנהל הדרכה','User':'משתמש','User Management':'ניהול משתמשים','Sign out of FLYMPUS':'התנתקות מ־FLYMPUS',
  'Application roles':'תפקידי מערכת','Application role':'תפקיד מערכת','Role':'תפקיד','Role guide':'מדריך תפקידים','What each role can do':'מה כל תפקיד מאפשר',
  'Complete control of FLYMPUS. An Owner may appoint another Owner, an Administrator, a Training Manager or a User, and may manage every role below Owner. The Primary Owner remains protected.':'שליטה מלאה ב־FLYMPUS. בעלים יכול למנות בעלים נוסף, מנהל מערכת, מנהל הדרכה או משתמש, ולנהל כל תפקיד שמתחת לבעלים. הבעלים הראשי נשאר מוגן.',
  'Manages lower-level accounts and all training operations. An Administrator may appoint a Training Manager or a User, but cannot appoint another Administrator or an Owner.':'מנהל חשבונות בדרגות נמוכות יותר ואת כלל פעילות ההדרכה. מנהל מערכת יכול למנות מנהל הדרכה או משתמש, אך אינו יכול למנות מנהל מערכת נוסף או בעלים.',
  'Creates and manages training, course rosters and course-specific Package changes. A Training Manager may invite, approve and appoint Users, but cannot appoint another Training Manager or any higher role.':'יוצר ומנהל הדרכות, סגלי קורס והתאמות חבילה ברמת הקורס. מנהל הדרכה יכול להזמין, לאשר ולמנות משתמשים, אך אינו יכול למנות מנהל הדרכה נוסף או תפקיד גבוה יותר.',
  'Works inside assigned courses and records operational data such as evaluations and forms, without changing course structure, rosters or Packages.':'עובד בקורסים שאליהם שובץ ומתעד נתונים תפעוליים כגון הערכות וטפסים, ללא שינוי מבנה הקורס, הסגל או החבילות.',
  'Full system control':'שליטה מלאה במערכת','Manage users and administrators':'ניהול משתמשים ומנהלי מערכת','Manage all courses and global Packages':'ניהול כל הקורסים והחבילות הגלובליות','Full access to all courses and global Packages':'גישה מלאה לכל הקורסים והחבילות הגלובליות','Full User Management and role control':'ניהול מלא של משתמשים ותפקידי מערכת','Manage Users and lower-level roles':'ניהול משתמשים ותפקידים בדרגות נמוכות יותר','Full training administration':'ניהול מלא של מערך ההדרכה','Protected Owner account':'חשבון בעלים מוגן',
  'System administration':'ניהול מערכת','Manage Training Managers and Users':'ניהול מנהלי הדרכה ומשתמשים','Administrators are managed by the Owner':'מנהלי מערכת מנוהלים על ידי הבעלים','Manage all courses':'ניהול כל הקורסים','Manage global Packages':'ניהול חבילות גלובליות','Managed by Owner':'מנוהל על ידי הבעלים',
  'Training administration':'ניהול הדרכה','Create and manage courses':'יצירה וניהול קורסים','Create and manage assigned training courses':'יצירה וניהול של קורסי ההדרכה המשויכים','Manage course rosters':'ניהול סגלי קורס','Create course-specific Package overrides':'יצירת התאמות חבילה ברמת הקורס','Submit and manage training records/evaluations':'הזנה וניהול של רישומי הדרכה והערכות','No user administration':'ללא ניהול משתמשים','No user invitations or approvals':'ללא הזמנת משתמשים או אישורם','May appoint: Owner, Administrator, Training Manager or User':'יכול למנות: בעלים, מנהל מערכת, מנהל הדרכה או משתמש','May appoint: Training Manager or User':'יכול למנות: מנהל הדרכה או משתמש','May appoint: User':'יכול למנות: משתמש','Cannot appoint Administrator or Owner':'לא יכול למנות מנהל מערכת או בעלים','Cannot appoint Training Manager, Administrator or Owner':'לא יכול למנות מנהל הדרכה, מנהל מערכת או בעלים','Cannot appoint application roles':'לא יכול למנות תפקידי מערכת','Primary Owner is protected':'הבעלים הראשי מוגן','Manage lower-level accounts and all courses':'ניהול חשבונות בדרגות נמוכות יותר וכל הקורסים',
  'Operational access':'גישה תפעולית','Work in assigned courses':'עבודה בקורסים משויכים','Submit evaluations and forms':'הזנת הערכות וטפסים','No User Management':'ללא ניהול משתמשים','No course structure, roster or Package editing':'ללא עריכת מבנה הקורס, סגל הקורס או החבילות','No structural course editing':'ללא עריכת מבנה הקורס',
  'Managed at a higher level':'מנוהל בדרגה גבוהה יותר','You cannot manage or assign this role.':'אין לך הרשאה לנהל או להקצות תפקיד זה.',
  'Change role':'שנה תפקיד','Select role':'בחר תפקיד','Role updated':'התפקיד עודכן','Only the Owner can perform this action.':'רק בעל המערכת יכול לבצע פעולה זו.',
  'ADMINISTRATION':'ניהול מערכת','Application access is separate from course membership and course roles.':'הרשאת הגישה לאפליקציה נפרדת מהשיוך לקורס ומהתפקיד בקורס.','Close User Management':'סגור ניהול משתמשים',
  'Add user':'הוסף משתמש','Pre-authorize an email before the person signs in for the first time.':'אשר מראש כתובת מייל לפני שהמשתמש מתחבר בפעם הראשונה.',
  'Name':'שם','Email address':'כתובת מייל','App role':'תפקיד מערכת','Regular user':'משתמש רגיל','Invite user':'הזמן משתמש','Save changes':'שמור שינויים','User updated':'המשתמש עודכן','Email is tied to the sign-in account and cannot be changed here.':'כתובת המייל משויכת לחשבון ההתחברות ולא ניתנת לשינוי כאן.',
  'Name is required.':'יש להזין שם.','Email is required.':'יש להזין כתובת מייל.','Enter a valid email address.':'הזן כתובת מייל תקינה.',
  'Creates a FLYMPUS invitation and pre-authorizes this email for first sign-in.':'יוצר הזמנה ל־FLYMPUS ומאשר מראש את כתובת המייל להתחברות הראשונה.',
  'Invitation created':'ההזמנה נוצרה','Invitation sent':'ההזמנה נשלחה','Invitation email delivery is not configured yet.':'שליחת הזמנות במייל עדיין אינה מוגדרת.',
  'Invited':'הוזמן','Pending':'ממתין','Pending approval':'ממתין לאישור','Active':'פעיל','Blocked':'חסום','Invited users':'משתמשים שהוזמנו','Pending users':'משתמשים ממתינים','Approval requests':'בקשות לאישור','Active users':'משתמשים פעילים','Blocked users':'משתמשים חסומים','Pre-authorized and not signed in yet.':'אושרו מראש ועדיין לא התחברו.','Signed in without an invitation and waiting for approval.':'התחברו ללא הזמנה וממתינים לאישור.',
  'Current account':'החשבון הנוכחי','Approve':'אשר','Block':'חסום','Reactivate':'הפעל מחדש','Remove invite':'בטל הזמנה','Not signed in yet':'טרם התחבר',
  'Full name':'שם מלא','Official full name':'שם מלא רשמי','Nickname':'כינוי','Edit':'עריכה','Edit name':'ערוך שם','Edit official name':'ערוך שם רשמי','Save name':'שמור שם','Save official name':'שמור שם רשמי','Cancel':'ביטול','Enter a display name.':'יש להזין שם תצוגה.','Enter an official name.':'יש להזין שם רשמי.','Name updated':'השם עודכן','Official name updated':'השם הרשמי עודכן','Nickname updated':'הכינוי עודכן','Nickname cleared':'הכינוי הוסר','Could not update name':'לא ניתן לעדכן את השם','Could not update official name':'לא ניתן לעדכן את השם הרשמי','Could not update nickname':'לא ניתן לעדכן את הכינוי','Open My Profile':'פתח את הפרופיל שלי','Nickname label':'כינוי',
  'Unnamed user':'משתמש ללא שם','No email':'ללא מייל','Unknown':'לא ידוע','Loading users…':'טוען משתמשים…','Could not load users':'לא ניתן לטעון משתמשים','User Management access is required.':'נדרשת הרשאת מנהל.',
  'This is your current account.':'זה החשבון הנוכחי שלך.','Could not add user':'לא ניתן להוסיף משתמש',
  'Remove this invitation?':'לבטל את ההזמנה הזאת?','The email will no longer be pre-authorized for FLYMPUS.':'כתובת המייל לא תהיה עוד מאושרת מראש ל־FLYMPUS.','Remove':'בטל',
  'Approve this user?':'לאשר את המשתמש הזה?','This account will be able to access FLYMPUS.':'החשבון יוכל לגשת ל־FLYMPUS.','Block this user?':'לחסום את המשתמש הזה?','This account will immediately lose application access.':'החשבון יאבד מיד את הגישה לאפליקציה.',
  'Reactivate this user?':'להפעיל מחדש את המשתמש הזה?','This account will regain application access.':'החשבון יקבל מחדש גישה לאפליקציה.','Make this user an administrator?':'להפוך את המשתמש הזה למנהל?','Administrators can approve users and change application access.':'מנהלים יכולים לאשר משתמשים ולשנות הרשאות גישה לאפליקציה.',
  'Remove administrator access?':'להסיר הרשאת מנהל?','The account remains active but loses User Management permissions.':'החשבון יישאר פעיל אך יאבד הרשאות ניהול משתמשים.','Update this user?':'לעדכן את המשתמש הזה?','The account permissions will be changed.':'הרשאות החשבון ישתנו.','Confirm':'אישור','Update failed':'העדכון נכשל',
  'Account':'חשבון','Could not update preferred name':'לא ניתן לעדכן את הכינוי','Personal profile':'פרופיל אישי','Account menu':'תפריט חשבון','My Profile':'הפרופיל שלי','View your account details and course roles.':'הצג את פרטי החשבון ואת התפקידים שלך בקורסים.','Settings':'הגדרות','Language, appearance and personal preferences.':'שפה, תצוגה והעדפות אישיות.','Manage application access and roles.':'נהל גישה לאפליקציה ותפקידי מערכת.','You can change your personal photo here. Your name, email and course role are managed by course administration.':'כאן ניתן לשנות את התמונה האישית. השם, המייל והתפקיד בקורס מנוהלים על ידי הנהלת הקורס.',
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
  document.getElementById('quickMyProfile')?.setAttribute('aria-label',tr('Open My Profile'));
  setStaticText('#quickSignOut b','Sign out of FLYMPUS');
  document.getElementById('topPersonalProfileBtn')?.setAttribute('aria-label',tr('Account menu'));
  document.getElementById('topPersonalProfileDropdown')?.setAttribute('aria-label',tr('Account menu'));
  const copies={assignments:['Assignments & role changes','When you are assigned to a course or your course role changes.'],courseUpdates:['Course updates','Important changes to courses you are assigned to.'],evaluations:['Evaluations & drafts','Items that require completion, revision or follow-up.'],checks:['Checks, tests & certifications','Qualification events and certification-related updates.'],requiredActions:['Required actions & deadlines','Time-sensitive items that need your attention.']};
  Object.entries(copies).forEach(([key,copy])=>{const row=document.querySelector('[data-notification-pref="'+key+'"]')?.closest?.('.notificationPrefRow');const b=row?.querySelector?.('.notificationPrefCopy b'),small=row?.querySelector?.('.notificationPrefCopy small');if(b)b.textContent=tr(copy[0]);if(small)small.textContent=tr(copy[1])});
  document.getElementById('topNotificationBtn')?.setAttribute('aria-label',tr('Notifications'));document.getElementById('topPersonalProfileBtn')?.setAttribute('aria-label',tr('Account menu'))
}
function root(){let el=document.getElementById('flympusAuthRoot');if(el)return el;el=document.createElement('div');el.id='flympusAuthRoot';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','FLYMPUS sign in');el.hidden=true;document.body.appendChild(el);return el}
function shell(body){document.documentElement.classList.remove('flympusColdBoot');const el=root();el.classList.remove('flympusAuthInitial');el.dir=authLanguage()==='he'?'rtl':'ltr';el.innerHTML='<div class="flympusAuthShell"><section class="flympusAuthCard"><div class="flympusAuthCardBody"><div class="flympusAuthMiniBrand" aria-hidden="true"><img src="./assets/flympus-app-icon.webp" alt=""></div>'+body+'</div></section></div>';el.hidden=false;return el}
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
function lockApp(){document.documentElement.classList.add(preview&&!enabled?'flympusAuthPreview':'flympusAuthLocked');document.documentElement.classList.remove('flympusAuthBooting','flympusAuthReturning','flympusAuthResuming')}
function unlockApp(){cancelSilentAuthLoading();document.documentElement.classList.remove('flympusColdBoot','flympusAuthBooting','flympusAuthReturning','flympusAuthResuming','flympusAuthLocked','flympusAuthPreview');const el=document.getElementById('flympusAuthRoot');if(el)el.hidden=true}
function statusBlock(kind,title,copy){const icon=kind==='error'?'!':kind==='pending'?'…':'✓';return '<div class="flympusAuthStatus '+esc(kind)+'"><span class="flympusAuthStatusIcon">'+icon+'</span><div><b>'+esc(title)+'</b><span>'+esc(copy)+'</span></div></div>'}
function showLoading(copy='Checking your account…'){api.status='loading';shell('<div class="flympusAuthSpinner" aria-hidden="true"></div><p class="flympusAuthEyebrow">'+esc(tr('SECURE SIGN IN'))+'</p><h1 class="flympusAuthTitle">'+esc(tr('Opening FLYMPUS'))+'</h1><p class="flympusAuthCopy">'+esc(tr(copy))+'</p>')}
function providerButtons(disabled=false){const microsoftButton=cfg.microsoftEnabled===true?'<button class="flympusAuthProvider" type="button" data-auth-provider="microsoft" '+(disabled?'disabled':'')+'><span class="flympusAuthProviderMark flympusMicrosoftMark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span data-auth-provider-label>'+esc(tr('Continue with Microsoft'))+'</span></button>':'';return '<div class="flympusAuthProviders"><button class="flympusAuthProvider" type="button" data-auth-provider="google" '+(disabled?'disabled':'')+'><span class="flympusAuthProviderMark" aria-hidden="true">G</span><span data-auth-provider-label>'+esc(tr('Continue with Google'))+'</span></button>'+microsoftButton+'</div>'}
function bindProviderButtons(){document.querySelectorAll('[data-auth-provider]').forEach(btn=>btn.onclick=()=>signInProvider(btn.dataset.authProvider))}
function setProviderBusy(busy){
  document.querySelectorAll('[data-auth-provider]').forEach(btn=>{
    btn.disabled=!!busy;
    btn.setAttribute('aria-busy',busy?'true':'false');
    const label=btn.querySelector('[data-auth-provider-label]');
    if(label&&btn.dataset.authProvider==='google')label.textContent=tr(busy?'Opening Google…':'Continue with Google')
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
function showLogin({setupPreview=false,error=''}={}){
  cancelSilentAuthLoading();api.status=setupPreview?'preview':'signed-out';lockApp();
  const setup=setupPreview?statusBlock('pending',tr('Authentication preview'),tr('The Google sign-in experience is ready.')):'';
  const err=error?statusBlock('error',tr('Sign-in failed'),error):'';
  const saved=!setupPreview?accountSwitcher?.loginPickerHtml?.()||'':'';
  shell('<h1 class="flympusAuthTitle">'+esc(tr('Sign in to FLYMPUS'))+'</h1><p class="flympusAuthCopy">'+esc(tr('Continue with the Google account assigned to you.'))+'</p>'+saved+providerButtons(setupPreview)+setup+err+'<p class="flympusAuthFine">'+esc(tr('FLYMPUS uses your account only to verify your identity. It does not read your Gmail or Outlook.'))+'</p>');
  if(!setupPreview)bindProviderButtons();
  void accountSwitcher?.refresh()
}
function showPending(user,profile){cancelSilentAuthLoading();clearVerifiedActive();api.status=profile?.status==='blocked'?'blocked':'pending';lockApp();const blocked=profile?.status==='blocked';shell('<p class="flympusAuthEyebrow">'+esc(tr('ACCOUNT ACCESS'))+'</p><h1 class="flympusAuthTitle">'+esc(tr(blocked?'Access unavailable':'Approval required'))+'</h1><p class="flympusAuthCopy">'+esc(tr(blocked?'This FLYMPUS account is currently blocked.':'Your identity is verified. An administrator still needs to approve access to FLYMPUS.'))+'</p>'+statusBlock(blocked?'error':'pending',tr(blocked?'Account blocked':'Pending administrator approval'),tr(blocked?'Contact a FLYMPUS administrator if you believe this is incorrect.':'You do not have access to course data until approval is granted.'))+'<div class="flympusAuthAccount"><b>'+esc(user.displayName||tr('Signed-in user'))+'</b><span>'+esc(user.email||'')+'</span></div><div class="flympusAuthActions"><button class="flympusAuthAction" type="button" data-auth-signout>'+esc(tr('Sign out'))+'</button></div>');document.querySelector('[data-auth-signout]')?.addEventListener('click',signOutCurrentUser)}
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
  const activeUid=String(auth?.currentUser?.uid||'');
  /* Gmail-style sign-out applies to the active account only; other named
     Firebase Auth sessions stay available on the signed-out picker. */
  if(activeUid)await accountSwitcher?.forgetActive(activeUid);
  try{
    if(auth&&authSdk)await authSdk.signOut(auth)
  }catch(err){
    console.error('FLYMPUS sign-out failed',err)
  }finally{
    currentUser=null;currentProfile=null;
    api.currentUser=null;api.profile=null;
    clearRoleContext();
    removeAuthenticatedChrome();
    clearVerifiedActive();
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
  const profile={uid:user.uid,email,displayName:user.displayName||invitation?.displayName||'',preferredName:'',photoURL:user.photoURL||'',providerIds:(user.providerData||[]).map(x=>String(x?.providerId||'')).filter(Boolean),role:preauthorized&&['owner','admin','training_manager','user'].includes(invitation?.role)?invitation.role:'user',status:preauthorized?'active':'pending',createdAt:firestoreSdk.serverTimestamp()};
  await firestoreSdk.setDoc(ref,profile);return profile
}
function normalizeProfile(profile={}){
  const role=normalizeAppRole(profile.role);
  const status=['active','pending','blocked'].includes(profile.status)?profile.status:'pending';
  const preferredName=String(profile.preferredName||'').trim();
  return {...profile,preferredName,role,status}
}
async function ensureOwnerBootstrap(user,profile){
  if(!db||!firestoreSdk||profile?.status!=='active')return profile;
  if(profile.role==='owner')return profile;
  if(profile.role!=='admin')return profile;
  try{
    const accessRef=firestoreSdk.doc(db,'system','access');
    let accessSnap=await firestoreSdk.getDoc(accessRef);
    if(!accessSnap.exists()){
      try{
        await firestoreSdk.setDoc(accessRef,{ownerUid:user.uid,createdAt:firestoreSdk.serverTimestamp(),createdBy:user.uid})
      }catch(err){
        // Another active administrator may have completed the one-time claim.
        if(String(err?.code||'')!=='permission-denied')console.warn('FLYMPUS owner bootstrap claim',err)
      }
      accessSnap=await firestoreSdk.getDoc(accessRef)
    }
    if(accessSnap.exists()&&String(accessSnap.data()?.ownerUid||'')===String(user.uid)){
      await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',user.uid),{role:'owner',updatedAt:firestoreSdk.serverTimestamp(),updatedBy:user.uid});
      return {...profile,role:'owner'}
    }
  }catch(err){console.warn('FLYMPUS owner bootstrap deferred',err)}
  return profile
}
function applyRoleContext(user,profile){
  currentUser=user;currentProfile=profile;
  api.currentUser=user;api.profile=profile;api.status='active';
  document.documentElement.setAttribute('data-flympus-app-role',profile.role);
  syncAuthenticatedChrome(user,profile);
  if(canManageUsers(profile))setTimeout(()=>prefetchManagedDirectory().catch(()=>{}),0);
  /* Only ACTIVE Firestore-verified users may enter the local account picker. */
  void accountSwitcher?.remember(user,profile).catch(error=>console.warn('Account switcher persistence unavailable',error));
  try{
    document.dispatchEvent(new CustomEvent('flympus:auth-ready',{detail:{
      uid:user.uid,
      email:user.email||'',
      displayName:profile.preferredName||profile.displayName||user.displayName||'',
      officialName:profile.displayName||user.displayName||'',
      preferredName:profile.preferredName||'',
      nickname:profile.preferredName||'',
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
  const role=document.getElementById('personalProfileRole'),email=document.getElementById('personalProfileEmail'),signOut=document.getElementById('quickSignOut');
  if(role)role.textContent=tr(roleDefinition(profile.role).label);
  if(email)email.textContent=user.email||'';
  void accountSwitcher?.refresh();
  if(signOut)signOut.onclick=event=>{event?.stopPropagation?.();signOutCurrentUser()};
  syncAuthAdjacentChromeLanguage()
}
function removeAuthenticatedChrome(){
  const role=document.getElementById('personalProfileRole'),email=document.getElementById('personalProfileEmail');
  if(role)role.textContent=tr('Account');if(email)email.textContent='';
  const list=document.getElementById('accountSwitchList');if(list){list.innerHTML='';list.hidden=true}
}
function closeTransientHeaderMenus({animated=false}={}){[['#topCourseDropdown','#topCourseSwitch'],['#topNotificationDropdown','#topNotificationBtn'],['#topPersonalProfileDropdown','#topPersonalProfileBtn']].forEach(([menuSel,buttonSel])=>{const menu=document.querySelector(menuSel),button=document.querySelector(buttonSel);if(!menu||menu.hidden){button?.setAttribute?.('aria-expanded','false');return}const canAnimate=animated&&(menuSel==='#topNotificationDropdown'||menuSel==='#topPersonalProfileDropdown')&&button?.getAttribute?.('aria-expanded')==='true';if(canAnimate){button.click?.();return}menu.hidden=true;button?.setAttribute?.('aria-expanded','false')})}
function bindBottomNavigationOverlayDismissal(){if(window.__FLYMPUS_BOTTOM_DISMISS_BOUND__)return;window.__FLYMPUS_BOTTOM_DISMISS_BOUND__=true;const dismiss=event=>{if(event.target?.closest?.('#mobileBottomNav,[data-mobile-nav],.mobileBottomHapticSwitch'))closeTransientHeaderMenus()};document.addEventListener('touchstart',dismiss,true);document.addEventListener('pointerdown',dismiss,true);document.addEventListener('click',dismiss,true)}
function userManagementRoot(){
  let el=document.getElementById('flympusUserManagementRoot');if(el)return el;el=document.createElement('div');el.id='flympusUserManagementRoot';el.hidden=true;
  el.innerHTML='<div class="flympusUserManagementBackdrop" data-user-management-close></div><section class="flympusUserManagementPanel" role="dialog" aria-modal="true" aria-labelledby="flympusUserManagementTitle"><header><div><p data-user-management-eyebrow></p><h1 id="flympusUserManagementTitle"></h1><span data-user-management-subtitle></span></div><button type="button" class="flympusUserManagementClose" data-user-management-close aria-label="">×</button></header><div class="flympusUserManagementBody" data-user-management-body></div></section>';document.body.appendChild(el);
  el.querySelectorAll('[data-user-management-close]').forEach(btn=>btn.addEventListener('click',closeUserManagement));let lastTouchY=0;el.addEventListener('touchstart',event=>{lastTouchY=Number(event.touches?.[0]?.clientY||0)},{passive:true});el.addEventListener('touchmove',event=>{const touch=event.touches?.[0];if(!touch)return;const scroller=event.target?.closest?.('.flympusUserManagementBody');if(!scroller){if(event.cancelable)event.preventDefault();return}const nextY=Number(touch.clientY||0),dy=nextY-lastTouchY;lastTouchY=nextY;const max=Math.max(0,scroller.scrollHeight-scroller.clientHeight);if((dy>0&&scroller.scrollTop<=0)||(dy<0&&scroller.scrollTop>=max)){if(event.cancelable)event.preventDefault()}},{passive:false});syncUserManagementStaticLanguage(el);return el
}
function syncUserManagementStaticLanguage(el=document.getElementById('flympusUserManagementPageRoot')||document.getElementById('flympusUserManagementRoot')){if(!el)return;el.dir=authLanguage()==='he'?'rtl':'ltr';const eyebrow=el.querySelector('[data-user-management-eyebrow]'),title=el.querySelector('#flympusUserManagementTitle'),subtitle=el.querySelector('[data-user-management-subtitle]'),close=el.querySelector('.flympusUserManagementClose');if(eyebrow)eyebrow.textContent=tr('ADMINISTRATION');if(title)title.textContent=tr('User Management');if(subtitle)subtitle.textContent=tr('Application access is separate from course membership and course roles.');close?.setAttribute('aria-label',tr('Close User Management'))}
function closeUserManagement(){
  const el=document.getElementById('flympusUserManagementRoot');if(!el||el.hidden)return;
  clearTimeout(userManagementCloseTimer);
  el.classList.remove('flympusUserManagementVisible');
  userManagementCloseTimer=setTimeout(()=>{
    el.hidden=true;
    document.documentElement.classList.remove('flympusUserManagementOpen');
    if(document.body)document.body.style.top=userManagementPreviousBodyTop;
    window.scrollTo(0,userManagementScrollY)
  },190)
}
function userProviderLabel(profile){const providers=Array.isArray(profile?.providerIds)?profile.providerIds:[];if(providers.includes('microsoft.com'))return 'Microsoft';if(providers.includes('google.com'))return 'Google';return providers.length?providers.join(', '):tr('Unknown')}
function managementStatusLabel(status){if(status==='invited')return tr('Invited');return status==='active'?tr('Active'):status==='blocked'?tr('Blocked'):tr('Pending approval')}
function managementGroupLabel(status){return tr(status==='invited'?'Invited users':status==='active'?'Active users':status==='blocked'?'Blocked users':'Approval requests')}
function managementGroupHelp(status){return status==='invited'?tr('Pre-authorized and not signed in yet.'):status==='pending'?tr('Signed in without an invitation and waiting for approval.') : ''}
function managementRoleLabel(role){return tr(roleDefinition(role).label)}
function managementActionButton(action,uid,label,tone=''){return '<button type="button" class="flympusUserAction '+esc(tone)+'" data-user-action="'+esc(action)+'" data-user-uid="'+esc(uid)+'">'+esc(tr(label))+'</button>'}
function managementInviteActionButton(action,email,label,tone=''){return '<button type="button" class="flympusUserAction '+esc(tone)+'" data-invite-action="'+esc(action)+'" data-invite-email="'+esc(email)+'">'+esc(tr(label))+'</button>'}
function managementEmptyLabel(status){return authLanguage()==='he'?(status==='invited'?'אין משתמשים שהוזמנו.':status==='active'?'אין משתמשים פעילים.':status==='blocked'?'אין משתמשים חסומים.':'אין בקשות לאישור.'):(status==='pending'?'No approval requests.':'No '+status+' users.')}
function clearManagedFieldError(input){
  if(!input)return;
  input.classList.remove('fieldInvalidControl');
  input.removeAttribute('aria-invalid');
  const label=input.closest('label');
  label?.querySelector('.flympusUserFieldError')?.remove()
}
function setManagedFieldError(input,message){
  if(!input)return;
  clearManagedFieldError(input);
  input.classList.add('fieldInvalidControl');
  input.setAttribute('aria-invalid','true');
  const label=input.closest('label');
  if(label){const error=document.createElement('small');error.className='flympusUserFieldError';error.textContent=tr(message);label.appendChild(error)}
}
function validateManagedInviteForm(form){
  const name=form?.elements?.displayName,emailInput=form?.elements?.email;
  const displayName=String(name?.value||'').trim(),email=canonicalEmail(emailInput?.value);
  clearManagedFieldError(name);clearManagedFieldError(emailInput);
  let first=null;
  if(!displayName){setManagedFieldError(name,'Name is required.');first=first||name}
  if(!email){setManagedFieldError(emailInput,'Email is required.');first=first||emailInput}
  else if(!validManagedEmail(email)){setManagedFieldError(emailInput,'Enter a valid email address.');first=first||emailInput}
  first?.focus?.({preventScroll:false});
  return first?null:{displayName,email}
}
async function sendManagedInvitationEmail(invitation){
  const endpoint=String(cfg.invitationEmailApiUrl||'').trim();
  if(!endpoint)return {sent:false,configured:false};
  if(!currentUser?.getIdToken)throw new Error('Authenticated invitation delivery is unavailable.');
  const token=await currentUser.getIdToken();
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({
    email:invitation.email,displayName:invitation.displayName,role:invitation.role,
    appUrl:new URL('./',location.href).href
  })});
  let result={};try{result=await response.json()}catch{}
  if(!response.ok)throw new Error(String(result?.error||'Invitation email could not be sent.'));
  return {sent:true,configured:true}
}
function assignableAppRoles(actorRole=normalizeAppRole(currentProfile?.role)){
  const actor=normalizeAppRole(actorRole);
  if(actor==='owner')return ['owner','admin','training_manager','user'];
  if(actor==='admin')return ['training_manager','user'];
  if(actor==='training_manager')return ['user'];
  return []
}
function defaultAssignableRole(){return assignableAppRoles()[0]||'user'}
function managementRoleOptions(selected,{forInvite=false}={}){
  const current=normalizeAppRole(selected),roles=[...assignableAppRoles()];
  if(!forInvite&&!roles.includes(current))roles.push(current);
  return [...new Set(roles)].map(role=>'<option value="'+esc(role)+'" '+(current===role?'selected':'')+'>'+esc(managementRoleLabel(role))+'</option>').join('')
}
function canManageTargetRole(role,uid=''){
  const actor=normalizeAppRole(currentProfile?.role),target=normalizeAppRole(role);
  if(actor==='owner'){
    if(uid&&String(uid)===String(primaryOwnerUid||''))return false;
    return true
  }
  if(actor==='admin')return ['training_manager','user'].includes(target);
  if(actor==='training_manager')return target==='user';
  return false
}
function canAssignAppRole(role){
  return assignableAppRoles().includes(normalizeAppRole(role))
}
function roleGuideHtml(){
  const defs=[
    ['owner','Full system control',['May appoint: Owner, Administrator, Training Manager or User','Full access to all courses and global Packages','Full User Management and role control','Primary Owner is protected']],
    ['admin','System administration',['May appoint: Training Manager or User','Manage Users and lower-level roles','Manage all courses and global Packages','Full training administration']],
    ['training_manager','Training administration',['May appoint: User','Create and manage assigned training courses','Manage course rosters','Create course-specific Package overrides','Submit and manage training records/evaluations']],
    ['user','Operational access',['Work in assigned courses','Submit evaluations and forms','No User Management','No course structure, roster or Package editing']]
  ];
  return '<section class="flympusRoleGuide"><div class="flympusRoleGuideHead"><div><span>'+esc(tr('Role guide'))+'</span><h2>'+esc(tr('What each role can do'))+'</h2></div></div><div class="flympusRoleGuideGrid">'+defs.map(([role,title,items])=>'<article class="flympusRoleGuideCard '+esc(role)+'"><div class="flympusRoleGuideTitle"><b>'+esc(managementRoleLabel(role))+'</b><small>'+esc(tr(title))+'</small></div><ul>'+items.map(item=>'<li>'+esc(tr(item))+'</li>').join('')+'</ul></article>').join('')+'</div></section>'
}
function managementInitials(value){
  const parts=String(value||'?').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '?';
  return (parts.length>1?parts.slice(0,2).map(part=>part.slice(0,1)).join(''):parts[0].slice(0,2)).toUpperCase()
}
function invitationCard(invite){
  const name=String(invite.displayName||'').trim(),email=canonicalEmail(invite.email),role=normalizeAppRole(invite.role),manageable=canManageTargetRole(role);
  const options=managementRoleOptions(role),roleControl=options?'<label class="flympusRoleSelectWrap"><span>'+esc(tr('Role'))+'</span><select data-invite-role-select data-invite-email="'+esc(email)+'" aria-label="'+esc(tr('Change role'))+'">'+options+'</select></label>':'';
  const actions=manageable?roleControl+managementInviteActionButton('remove-invite',email,'Remove invite','danger'):'<span class="flympusOwnerProtected">'+esc(tr('Managed at a higher level'))+'</span>';
  return '<article class="flympusUserCard invited"><div class="flympusUserAvatar">'+esc(managementInitials(name||email||'?'))+'</div><div class="flympusUserIdentity"><b>'+esc(name||email)+'</b><span>'+esc(email)+'</span><div class="flympusUserMeta"><i class="role '+esc(role)+'">'+esc(managementRoleLabel(role))+'</i></div></div><div class="flympusUserActions">'+actions+'</div></article>'
}
function renderUserManagement(directory,error='',rootOverride=null){
  const el=rootOverride||document.getElementById('flympusUserManagementPageRoot')||userManagementRoot(),body=el.querySelector('[data-user-management-body]');syncUserManagementStaticLanguage(el);const users=Array.isArray(directory)?directory:(directory?.users||[]),invitations=Array.isArray(directory?.invitations)?directory.invitations:[];lastManagedDirectory={users:[...users],invitations:[...invitations]};lastManagedError=error;
  const normalized=users.map(x=>normalizeProfile(x)),counts={invited:invitations.length,pending:0,active:0,blocked:0};normalized.forEach(x=>counts[x.status]++);const tabs=['invited','pending','active','blocked'];
  const defaultInviteRole=defaultAssignableRole(),addForm='<section class="flympusUserInviteBox"><div class="flympusUserInviteHead"><h2>'+esc(tr('Add user'))+'</h2><p>'+esc(tr('Pre-authorize an email before the person signs in for the first time.'))+'</p></div><form class="flympusUserInviteForm" data-user-invite-form novalidate><label><span>'+esc(tr('Name'))+' <i class="flympusRequiredMark" aria-hidden="true">*</i></span><input name="displayName" autocomplete="name" required aria-required="true"></label><label class="email"><span>'+esc(tr('Email address'))+' <i class="flympusRequiredMark" aria-hidden="true">*</i></span><input name="email" type="email" inputmode="email" autocomplete="email" required aria-required="true"></label><label><span>'+esc(tr('Role'))+'</span><select name="role">'+managementRoleOptions(defaultInviteRole,{forInvite:true})+'</select></label><button class="flympusUserAddButton" type="submit">'+esc(tr('Invite user'))+'</button><small>'+esc(tr('Creates a FLYMPUS invitation and pre-authorizes this email for first sign-in.'))+'</small></form></section>';
  const groupHtml=status=>{if(status==='invited'){const rows=invitations.slice().sort((a,b)=>String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||''))),help=managementGroupHelp(status);return '<section class="flympusUserGroup"><div class="flympusUserGroupHead"><div class="flympusUserGroupTitle"><h2>'+esc(managementGroupLabel(status))+'</h2>'+(help?'<small>'+esc(help)+'</small>':'')+'</div><span>'+rows.length+'</span></div><div class="flympusUserList">'+(rows.length?rows.map(invitationCard).join(''):'<div class="flympusUserEmpty">'+esc(managementEmptyLabel(status))+'</div>')+'</div></section>'}
    const rows=normalized.filter(user=>user.status===status).sort((a,b)=>String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||''))),help=managementGroupHelp(status);return '<section class="flympusUserGroup"><div class="flympusUserGroupHead"><div class="flympusUserGroupTitle"><h2>'+esc(managementGroupLabel(status))+'</h2>'+(help?'<small>'+esc(help)+'</small>':'')+'</div><span>'+rows.length+'</span></div><div class="flympusUserList">'+(rows.length?rows.map(user=>{const self=user.uid===currentUser?.uid,protectedOwner=user.role==='owner'&&!self&&(normalizeAppRole(currentProfile?.role)!=='owner'||String(user.uid||'')===String(primaryOwnerUid||'')),protectedAdmin=!self&&!protectedOwner&&!canManageTargetRole(user.role,user.uid),editableUser=(self&&normalizeAppRole(currentProfile?.role)==='owner')||(!self&&canManageTargetRole(user.role,user.uid)),editingUser=editableUser&&managedNameEditUid===user.uid,preferredName=String(user.preferredName||'').trim(),officialName=String(user.displayName||'').trim(),roleBadge='<span class="flympusUserRoleBadge '+esc(user.role)+'">'+esc(managementRoleLabel(user.role))+'</span>',currentBadge=self?'<span class="flympusCurrentAdmin">'+esc(tr('Current account'))+'</span>':'';if(editingUser){const roleControl=self?'<label><span>'+esc(tr('Role'))+'</span><input name="roleLabel" value="'+esc(managementRoleLabel(user.role))+'" readonly aria-readonly="true"></label>':'<label><span>'+esc(tr('Role'))+'</span><select name="role">'+managementRoleOptions(user.role)+'</select></label>';return '<article class="flympusUserCard '+esc(user.role)+' editing"><div class="flympusUserAvatar">'+esc(managementInitials(officialName||user.email||'?'))+'</div><form class="flympusManagedUserForm" data-managed-user-form data-user-uid="'+esc(user.uid)+'"><div class="flympusManagedUserFields"><label><span>'+esc(tr('Official full name'))+'</span><input name="displayName" autocomplete="name" maxlength="80" required value="'+esc(officialName)+'"></label><label><span>'+esc(tr('Email address'))+'</span><input name="email" type="email" value="'+esc(user.email||'')+'" readonly aria-readonly="true"><small>'+esc(tr('Email is tied to the sign-in account and cannot be changed here.'))+'</small></label>'+roleControl+'</div><div class="flympusManagedUserActions"><button type="button" data-user-name-cancel>'+esc(tr('Cancel'))+'</button><button type="submit">'+esc(tr('Save changes'))+'</button></div></form></article>'}let actions='';if(protectedOwner)actions='<span class="flympusOwnerProtected">'+esc(tr('Protected Owner account'))+'</span>';else if(protectedAdmin)actions='<span class="flympusOwnerProtected">'+esc(tr('Managed at a higher level'))+'</span>';else{if(editableUser)actions+='<button type="button" class="flympusUserNameEdit" data-user-name-edit data-user-uid="'+esc(user.uid)+'" aria-label="'+esc(tr('Edit'))+'"><span aria-hidden="true">✎</span><span>'+esc(tr('Edit'))+'</span></button>';if(!self){if(status==='pending')actions+=managementActionButton('approve',user.uid,'Approve','primary')+managementActionButton('block',user.uid,'Block','danger');else if(status==='active')actions+=managementActionButton('block',user.uid,'Block','danger');else actions+=managementActionButton('reactivate',user.uid,'Reactivate','primary')}}const preferredUi=preferredName&&preferredName!==officialName?'<span class="flympusUserPreferred">'+esc(tr('Nickname'))+' · '+esc(preferredName)+'</span>':'',accountMeta=currentBadge?'<div class="flympusUserMeta">'+currentBadge+'</div>':'';return '<article class="flympusUserCard '+esc(user.role)+(self?' currentAccount':'')+'"><div class="flympusUserAvatar">'+esc(managementInitials(officialName||user.email||'?'))+'</div><div class="flympusUserIdentity"><div class="flympusUserNameLine"><b>'+esc(officialName||tr('Unnamed user'))+'</b>'+roleBadge+'</div>'+preferredUi+'<span>'+esc(user.email||tr('No email'))+'</span>'+accountMeta+'</div><div class="flympusUserActions">'+actions+'</div></article>'}).join(''):'<div class="flympusUserEmpty">'+esc(managementEmptyLabel(status))+'</div>')+'</div></section>'};
  body.innerHTML=(error?statusBlock('error',tr('Could not load users'),error):'')+roleGuideHtml()+addForm+'<div class="flympusUserSummary">'+tabs.map(status=>'<div><strong>'+counts[status]+'</strong><span>'+esc(managementStatusLabel(status))+'</span></div>').join('')+'</div>'+tabs.map(groupHtml).join('');
  const inviteForm=body.querySelector('[data-user-invite-form]');inviteForm?.addEventListener('submit',event=>{event.preventDefault();addManagedUser(event.currentTarget)});inviteForm?.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>clearManagedFieldError(input)));body.querySelectorAll('[data-user-action]').forEach(btn=>btn.addEventListener('click',()=>updateManagedUser(btn.dataset.userUid,btn.dataset.userAction,btn)));body.querySelectorAll('[data-invite-action]').forEach(btn=>btn.addEventListener('click',()=>updateManagedInvitation(btn.dataset.inviteEmail,btn.dataset.inviteAction,btn)));body.querySelectorAll('[data-user-role-select]').forEach(select=>select.addEventListener('change',()=>updateManagedUserRole(select.dataset.userUid,select.value,select)));body.querySelectorAll('[data-invite-role-select]').forEach(select=>select.addEventListener('change',()=>updateManagedInvitationRole(select.dataset.inviteEmail,select.value,select)));body.querySelectorAll('[data-user-name-edit]').forEach(btn=>btn.addEventListener('click',()=>{managedNameEditUid=String(btn.dataset.userUid||'');renderUserManagement(lastManagedDirectory,lastManagedError,el);requestAnimationFrame(()=>body.querySelector('[data-managed-user-form] input[name="displayName"]')?.focus?.())}));body.querySelectorAll('[data-user-name-cancel]').forEach(btn=>btn.addEventListener('click',()=>{managedNameEditUid='';renderUserManagement(lastManagedDirectory,lastManagedError,el)}));body.querySelectorAll('[data-managed-user-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();updateManagedUserDetails(String(form.dataset.userUid||''),form)}))
}
async function loadManagedUsers(){if(!canManageUsers()||!db||!firestoreSdk)throw new Error(tr('User Management access is required.'));const snapshot=await firestoreSdk.getDocs(firestoreSdk.collection(db,'users'));return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))}
async function loadManagedInvitations(){if(!canManageUsers()||!db||!firestoreSdk)throw new Error(tr('User Management access is required.'));const snapshot=await firestoreSdk.getDocs(firestoreSdk.collection(db,'invitations'));return snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).filter(x=>x.status==='active')}
async function loadManagedDirectory(){
  const [users,invitations]=await Promise.all([loadManagedUsers(),loadManagedInvitations()]);
  if(normalizeAppRole(currentProfile?.role)==='owner'){
    try{const access=await firestoreSdk.getDoc(firestoreSdk.doc(db,'system','access'));primaryOwnerUid=access.exists()?String(access.data()?.ownerUid||''):''}catch{primaryOwnerUid=''}
  }else primaryOwnerUid='';
  const existingEmails=new Set(users.map(x=>canonicalEmail(x.email)).filter(Boolean));
  return{users,invitations:invitations.filter(x=>!existingEmails.has(canonicalEmail(x.email)))}
}
async function prefetchManagedDirectory(force=false){
  if(!canManageUsers())throw new Error(tr('User Management access is required.'));
  if(managedDirectoryCache&&!force)return managedDirectoryCache;
  if(managedDirectoryPromise)return managedDirectoryPromise;
  managedDirectoryPromise=loadManagedDirectory().then(directory=>{managedDirectoryCache=directory;return directory}).finally(()=>{managedDirectoryPromise=null});
  return managedDirectoryPromise
}
function showUserManagement(directory,error=''){
  const el=userManagementRoot();
  clearTimeout(userManagementCloseTimer);
  renderUserManagement(directory,error);
  userManagementScrollY=Math.max(0,Number(window.scrollY||document.scrollingElement?.scrollTop||0));
  userManagementPreviousBodyTop=document.body?.style?.top||'';
  if(document.body)document.body.style.top='-'+userManagementScrollY+'px';
  el.hidden=false;
  document.documentElement.classList.add('flympusUserManagementOpen');
  void el.offsetWidth;
  requestAnimationFrame(()=>el.classList.add('flympusUserManagementVisible'))
}
async function openUserManagement(){
  if(!canManageUsers())return;
  const hadAnimatedHeader=!!document.querySelector('#topPersonalProfileDropdown:not([hidden]),#topNotificationDropdown:not([hidden])');
  closeTransientHeaderMenus({animated:true});
  if(typeof window.FLYMPUS_NAVIGATE==='function'){
    const navigate=()=>window.FLYMPUS_NAVIGATE('user-management');
    if(hadAnimatedHeader)setTimeout(navigate,145);else navigate();
    return
  }
  let directory=managedDirectoryCache,error='';
  if(!directory){try{directory=await prefetchManagedDirectory()}catch(err){directory={users:[],invitations:[]};error=String(err?.message||'Firestore rejected this request.')}}
  const reveal=()=>showUserManagement(directory,error);
  if(hadAnimatedHeader)setTimeout(reveal,145);else reveal()
}
async function mountUserManagementPage(host){
  if(!host||!canManageUsers())return;
  const pinTop=()=>{try{const scroller=document.scrollingElement||document.documentElement;if(scroller)scroller.scrollTop=0;window.scrollTo?.(0,0)}catch{}};
  pinTop();
  host.dir=authLanguage()==='he'?'rtl':'ltr';
  host.innerHTML='<div class="flympusUserManagementPageHead"><div class="eyebrow" data-user-management-eyebrow>'+esc(tr('ADMINISTRATION'))+'</div><h1 id="flympusUserManagementTitle">'+esc(tr('User Management'))+'</h1><p data-user-management-subtitle>'+esc(tr('Application access is separate from course membership and course roles.'))+'</p></div><div class="flympusUserManagementBody" data-user-management-body><div class="flympusUserManagementLoading"><div class="flympusAuthSpinner"></div><span>'+esc(tr('Loading users…'))+'</span></div></div>';
  let directory=managedDirectoryCache,error='';
  try{directory=directory||await prefetchManagedDirectory()}catch(err){directory={users:[],invitations:[]};error=String(err?.message||'Firestore rejected this request.')}
  if(!document.contains(host))return;
  renderUserManagement(directory,error,host);
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(pinTop);else pinTop();
  prefetchManagedDirectory(true).then(fresh=>{if(document.contains(host))renderUserManagement(fresh,'',host)}).catch(()=>{})
}
async function addManagedUser(form){
  if(!canManageUsers()||!db||!firestoreSdk)return;
  const valid=validateManagedInviteForm(form);if(!valid)return;
  const fd=new FormData(form),email=valid.email,displayName=valid.displayName,requestedRole=normalizeAppRole(String(fd.get('role'))),role=canAssignAppRole(requestedRole)?requestedRole:defaultAssignableRole();
  const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{
    const directory=await prefetchManagedDirectory(true),existing=directory.users.find(x=>canonicalEmail(x.email)===email);
    if(existing?.uid===currentUser?.uid){renderUserManagement(directory,tr('This is your current account.'));return}
    if(existing){
      if(!canManageTargetRole(existing.role,existing.uid)||!canAssignAppRole(role))throw new Error(tr('You cannot manage or assign this role.'));
      await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',existing.uid),{displayName,role,status:'active',updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid});
      managedDirectoryCache=await loadManagedDirectory();renderUserManagement(managedDirectoryCache);return
    }
    const ref=firestoreSdk.doc(db,'invitations',email),old=await firestoreSdk.getDoc(ref),payload={email,displayName,role,status:'active',updatedAt:firestoreSdk.serverTimestamp(),invitedBy:currentUser.uid};
    if(!old.exists())payload.createdAt=firestoreSdk.serverTimestamp();
    await firestoreSdk.setDoc(ref,payload,{merge:true});
    let delivery={sent:false,configured:false};
    try{delivery=await sendManagedInvitationEmail({email,displayName,role})}catch(err){console.error('FLYMPUS invitation email failed',err)}
    form.reset();
    managedDirectoryCache=await loadManagedDirectory();
    renderUserManagement(managedDirectoryCache);
    const notify=window.toast;
    if(typeof notify==='function')notify(tr(delivery.sent?'Invitation sent':'Invitation created'),delivery.sent?'success':'')
  }catch(err){
    console.error('FLYMPUS add-user failed',err);
    if(button)button.disabled=false;
    renderUserManagement(lastManagedDirectory,String(err?.message||tr('Could not add user')))
  }
}
async function updateManagedInvitation(email,action,button){if(!canManageUsers()||!validManagedEmail(email))return;const ref=firestoreSdk.doc(db,'invitations',canonicalEmail(email));button.disabled=true;try{if(action==='remove-invite'){const ok=typeof window.siteConfirm==='function'?await window.siteConfirm(tr('The email will no longer be pre-authorized for FLYMPUS.'),{title:tr('Remove this invitation?'),confirmLabel:tr('Remove'),tone:'danger'}):false;if(!ok){button.disabled=false;return}await firestoreSdk.deleteDoc(ref)}else{const role=action==='invite-admin'?'admin':action==='invite-training-manager'?'training_manager':'user';await firestoreSdk.setDoc(ref,{role,updatedAt:firestoreSdk.serverTimestamp(),invitedBy:currentUser.uid},{merge:true})}managedDirectoryCache=await loadManagedDirectory();renderUserManagement(managedDirectoryCache)}catch(err){console.error('FLYMPUS invitation update failed',err);button.disabled=false;renderUserManagement(lastManagedDirectory,String(err?.message||tr('Update failed')))}}
function normalizeDisplayName(value){return String(value||'').trim().replace(/\s+/g,' ')}
function syncCachedIdentity(uid,patch){
  if(managedDirectoryCache?.users)managedDirectoryCache={...managedDirectoryCache,users:managedDirectoryCache.users.map(user=>user.uid===uid?{...user,...patch}:user)};
  lastManagedDirectory={...lastManagedDirectory,users:(lastManagedDirectory.users||[]).map(user=>user.uid===uid?{...user,...patch}:user)}
}
async function updateOwnOfficialName(value){
  const displayName=normalizeDisplayName(value);
  if(displayName.length<2)throw new Error(tr('Enter an official name.'));
  if(!currentUser?.uid||!currentProfile||!db||!firestoreSdk||normalizeAppRole(currentProfile.role)!=='owner')throw new Error(tr('You cannot manage or assign this role.'));
  await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',currentUser.uid),{displayName,updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid});
  try{if(authSdk?.updateProfile)await authSdk.updateProfile(currentUser,{displayName})}catch(err){console.warn('FLYMPUS auth official-name sync deferred',err)}
  currentProfile={...currentProfile,displayName};api.profile=currentProfile;syncCachedIdentity(currentUser.uid,{displayName});syncAuthenticatedChrome(currentUser,currentProfile);
  try{document.dispatchEvent(new CustomEvent('flympus:profile-updated',{detail:{displayName,preferredName:currentProfile.preferredName||''}}))}catch{}
  return true
}
async function updateOwnPreferredName(value){
  const preferredName=normalizeDisplayName(value);
  if(!currentUser?.uid||!currentProfile||!db||!firestoreSdk)throw new Error(tr('Could not update preferred name'));
  await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',currentUser.uid),{preferredName,updatedAt:firestoreSdk.serverTimestamp()});
  currentProfile={...currentProfile,preferredName};api.profile=currentProfile;syncCachedIdentity(currentUser.uid,{preferredName});syncAuthenticatedChrome(currentUser,currentProfile);
  try{document.dispatchEvent(new CustomEvent('flympus:profile-updated',{detail:{displayName:currentProfile.displayName||'',preferredName}}))}catch{}
  return true
}
async function updateManagedUserOfficialName(uid,value,form=null){
  if(!canManageUsers()||!uid||!db||!firestoreSdk)throw new Error(tr('Could not update official name'));
  const target=(lastManagedDirectory.users||[]).find(user=>user.uid===uid);
  const self=uid===currentUser?.uid,allowed=self?normalizeAppRole(currentProfile?.role)==='owner':!!target&&canManageTargetRole(target.role,uid);
  if(!allowed)throw new Error(tr('You cannot manage or assign this role.'));
  const displayName=normalizeDisplayName(value),input=form?.querySelector?.('input[name="displayName"]');
  if(displayName.length<2){if(input)setManagedFieldError(input,'Enter an official name.');return false}
  form?.querySelectorAll?.('button,input')?.forEach(el=>el.disabled=true);
  try{
    await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',uid),{displayName,updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid});
    if(self){
      try{if(authSdk?.updateProfile)await authSdk.updateProfile(currentUser,{displayName})}catch(err){console.warn('FLYMPUS auth official-name sync deferred',err)}
      currentProfile={...currentProfile,displayName};api.profile=currentProfile;syncAuthenticatedChrome(currentUser,currentProfile)
    }
    syncCachedIdentity(uid,{displayName});
    managedNameEditUid='';
    managedDirectoryCache=await loadManagedDirectory();
    renderUserManagement(managedDirectoryCache);
    if(typeof window.toast==='function')window.toast(tr('Official name updated'));
    try{if(self)document.dispatchEvent(new CustomEvent('flympus:profile-updated',{detail:{displayName,preferredName:currentProfile.preferredName||''}}))}catch{}
    return true
  }catch(err){
    console.error('FLYMPUS managed official-name update failed',err);
    form?.querySelectorAll?.('button,input')?.forEach(el=>el.disabled=false);
    if(input)setManagedFieldError(input,String(err?.message||tr('Could not update official name')));
    return false
  }
}
async function updateManagedUserDetails(uid,form=null){
  if(!canManageUsers()||!uid||!db||!firestoreSdk)throw new Error(tr('Update failed'));
  const target=(lastManagedDirectory.users||[]).find(user=>user.uid===uid);
  const self=uid===currentUser?.uid,allowed=self?normalizeAppRole(currentProfile?.role)==='owner':!!target&&canManageTargetRole(target.role,uid);
  if(!target||!allowed)throw new Error(tr('You cannot manage or assign this role.'));
  const displayName=normalizeDisplayName(String(form?.elements?.displayName?.value||'')),nameInput=form?.elements?.displayName;
  if(displayName.length<2){if(nameInput)setManagedFieldError(nameInput,'Enter an official name.');return false}
  const currentRole=normalizeAppRole(target.role),requestedRole=self?currentRole:normalizeAppRole(String(form?.elements?.role?.value||currentRole));
  if(!self&&requestedRole!==currentRole&&!canAssignAppRole(requestedRole)){renderUserManagement(lastManagedDirectory,tr('You cannot manage or assign this role.'));return false}
  if(!self&&requestedRole!==currentRole){
    const ok=typeof window.siteConfirm==='function'?await window.siteConfirm(tr('The account permissions will be changed.'),{title:tr('Change role'),confirmLabel:tr('Confirm'),tone:'primary'}):true;
    if(!ok)return false
  }
  form?.querySelectorAll?.('button,input,select')?.forEach(el=>el.disabled=true);
  const changes={displayName,updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid};
  if(!self&&requestedRole!==currentRole)changes.role=requestedRole;
  try{
    await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',uid),changes);
    if(self){
      try{if(authSdk?.updateProfile)await authSdk.updateProfile(currentUser,{displayName})}catch(err){console.warn('FLYMPUS auth official-name sync deferred',err)}
      currentProfile={...currentProfile,displayName};api.profile=currentProfile;syncAuthenticatedChrome(currentUser,currentProfile)
    }
    syncCachedIdentity(uid,{displayName,...(!self&&requestedRole!==currentRole?{role:requestedRole}:{})});
    managedNameEditUid='';
    managedDirectoryCache=await loadManagedDirectory();
    renderUserManagement(managedDirectoryCache);
    if(typeof window.toast==='function')window.toast(tr('User updated'));
    try{if(self)document.dispatchEvent(new CustomEvent('flympus:profile-updated',{detail:{displayName,preferredName:currentProfile.preferredName||''}}))}catch{}
    return true
  }catch(err){
    console.error('FLYMPUS managed user update failed',err);
    form?.querySelectorAll?.('button,input,select')?.forEach(el=>el.disabled=false);
    if(nameInput)setManagedFieldError(nameInput,String(err?.message||tr('Update failed')));
    return false
  }
}
async function updateManagedUserRole(uid,role,select){
  role=normalizeAppRole(role);if(!canManageUsers()||!uid||uid===currentUser?.uid||!canAssignAppRole(role))return;
  const target=lastManagedDirectory.users.find(x=>x.uid===uid);if(!target||!canManageTargetRole(target.role,uid))return;
  const previous=target.role||'user';
  if(previous===role)return;
  const ok=typeof window.siteConfirm==='function'?await window.siteConfirm(tr('The account permissions will be changed.'),{title:tr('Change role'),confirmLabel:tr('Confirm'),tone:'primary'}):true;
  if(!ok){select.value=normalizeAppRole(previous);return}
  select.disabled=true;
  try{
    await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',uid),{role,updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid});
    managedDirectoryCache=await loadManagedDirectory();renderUserManagement(managedDirectoryCache);
    if(typeof window.toast==='function')window.toast(tr('Role updated'))
  }catch(err){console.error('FLYMPUS role update failed',err);select.disabled=false;select.value=normalizeAppRole(previous);renderUserManagement(lastManagedDirectory,String(err?.message||tr('Update failed')))}
}
async function updateManagedInvitationRole(email,role,select){
  role=normalizeAppRole(role);if(!canManageUsers()||!validManagedEmail(email)||!canAssignAppRole(role))return;
  const previous=lastManagedDirectory.invitations.find(x=>canonicalEmail(x.email)===canonicalEmail(email))?.role||'user';
  if(previous===role)return;
  select.disabled=true;
  try{
    await firestoreSdk.setDoc(firestoreSdk.doc(db,'invitations',canonicalEmail(email)),{role,updatedAt:firestoreSdk.serverTimestamp(),invitedBy:currentUser.uid},{merge:true});
    managedDirectoryCache=await loadManagedDirectory();renderUserManagement(managedDirectoryCache)
  }catch(err){console.error('FLYMPUS invitation role update failed',err);select.disabled=false;select.value=normalizeAppRole(previous);renderUserManagement(lastManagedDirectory,String(err?.message||tr('Update failed')))}
}
async function confirmManagedUserAction(action){const copy={approve:['Approve this user?','This account will be able to access FLYMPUS.'],block:['Block this user?','This account will immediately lose application access.'],reactivate:['Reactivate this user?','This account will regain application access.'],'make-admin':['Make this user an administrator?','Administrators can approve users and change application access.'],'make-user':['Remove administrator access?','The account remains active but loses User Management permissions.']}[action]||['Update this user?','The account permissions will be changed.'];if(typeof window.siteConfirm==='function')return window.siteConfirm(tr(copy[1]),{title:tr(copy[0]),confirmLabel:tr('Confirm'),tone:action==='block'?'danger':'primary'});return false}
async function updateManagedUser(uid,action,button){if(!canManageUsers()||!uid||uid===currentUser?.uid)return;const target=lastManagedDirectory.users.find(x=>x.uid===uid);if(!target||!canManageTargetRole(target.role,uid))return;if(!(await confirmManagedUserAction(action)))return;const changes={updatedAt:firestoreSdk.serverTimestamp(),updatedBy:currentUser.uid};if(action==='approve'||action==='reactivate')changes.status='active';if(action==='block')changes.status='blocked';if(action==='make-admin')changes.role='admin';if(action==='make-user')changes.role='user';button.disabled=true;try{await firestoreSdk.updateDoc(firestoreSdk.doc(db,'users',uid),changes);managedDirectoryCache=await loadManagedDirectory();renderUserManagement(managedDirectoryCache)}catch(err){console.error('FLYMPUS user-management update failed',err);button.disabled=false;renderUserManagement(lastManagedDirectory,String(err?.message||tr('Update failed')))}}
function bindAuthLanguageSync(){if(window.__FLYMPUS_AUTH_LANGUAGE_BOUND__)return;window.__FLYMPUS_AUTH_LANGUAGE_BOUND__=true;syncAuthAdjacentChromeLanguage();if(typeof MutationObserver!=='function')return;const observer=new MutationObserver(records=>{if(!records.some(x=>x.attributeName==='data-flympus-language'))return;syncAuthAdjacentChromeLanguage();if(currentUser&&currentProfile)syncAuthenticatedChrome(currentUser,currentProfile);const manager=document.getElementById('flympusUserManagementPageRoot')||document.getElementById('flympusUserManagementRoot');if(manager&&(!manager.hidden||manager.id==='flympusUserManagementPageRoot'))renderUserManagement(lastManagedDirectory,lastManagedError,manager)});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-flympus-language']})}
async function handleSignedIn(user,version=authStateVersion,{silent=false}={}){
  /* Passive returning launches and in-place refreshes must never look like a
     new sign-in. Only an explicit provider sign-in may escalate to the delayed
     authentication loader if profile verification is unusually slow. */
  if(!returningScopedSession&&!silent)scheduleSilentAuthLoading('Verifying FLYMPUS access…');
  try{
    let profile=normalizeProfile(await ensureUserProfile(user));profile=normalizeProfile(await ensureOwnerBootstrap(user,profile));
    /* Token refreshes and rapid iOS lifecycle changes can deliver a newer auth
       callback while Firestore is still resolving this one. Only the newest
       verified state may mutate the UID scope or unlock the application. */
    if(version!==authStateVersion||auth?.currentUser?.uid!==user.uid)return;
    const scopeChanged=window.FLYMPUS_STORAGE_SCOPE?.setUid?.(user.uid)===true;
    if(profile.status!=='active'){showPending(user,profile);return}
    markVerifiedActive(user,profile);
    let migratedLegacyCount=0;
    if(profile.role==='owner'||profile.role==='admin'){
      const migration=window.FLYMPUS_STORAGE_SCOPE?.claimLegacy?.(user.uid,{admin:true});
      migratedLegacyCount=Number(migration?.count||0)
    }
    /* A new UID scope and a legacy claim used to trigger two consecutive
       reloads. Apply both mutations first, then rehydrate the app once. */
    if(scopeChanged||migratedLegacyCount>0){location.reload();return}
    applyRoleContext(user,profile);
    unlockApp()
  }catch(err){
    if(version!==authStateVersion||auth?.currentUser?.uid!==user.uid)return;
    console.error('FLYMPUS profile verification failed',err);
    showFatal('Account verification failed',String(err?.message||'Firestore user access is not configured yet.'))
  }
}
async function refreshCurrentSession(){
  if(!auth?.currentUser)return false;
  const version=++authStateVersion;
  await handleSignedIn(auth.currentUser,version,{silent:true});
  return api.status==='active'
}
async function boot(){
  if(!enabled){
    api.status='disabled';
    if(preview){showLogin({setupPreview:true})}
    else document.documentElement.classList.remove('flympusColdBoot','flympusAuthBooting','flympusAuthReturning','flympusAuthLocked','flympusAuthPreview');
    return
  }
  if(!firebaseConfigReady()){
    showFatal('Firebase setup required','The FLYMPUS Firebase web configuration is incomplete.');
    return
  }
  if(enforce&&!returningScopedSession)lockApp();
  if(returningScopedSession){
    /* A UID scope alone is never authorization. A previously server-verified
       ACTIVE account may preserve its already-rendered screen while online
       revalidation runs, but interaction stays disabled. Offline or unverified
       launches remain fully opaque and fail closed. */
    if(!trustedVisualResumeFor())lockApp();
    api.status='booting'
  }else api.status='booting';
  try{
    const [appModule,authModule,firestoreModule,accountModule]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-firestore.js'),
      import('./account-switcher.js?v=20261008-switcher01')
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
    accountSwitcher=accountModule.createAccountSwitcher({
      authSdk:authModule,appSdk:appModule,config:cfg,
      getPrimaryAuth:()=>auth,
      getCurrent:()=>({user:currentUser,profile:currentProfile}),
      lockApp,showLoading,unlockApp,
      onFailure:error=>console.warn('Account switcher:',String(error?.message||error))
    });
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
      const version=++authStateVersion;
      if(user)handleSignedIn(user,version);
      else{
        cancelSilentAuthLoading();returningScopedSession=false;
        currentUser=null;currentProfile=null;api.currentUser=null;api.profile=null;
        clearRoleContext();removeAuthenticatedChrome();clearVerifiedActive();
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
