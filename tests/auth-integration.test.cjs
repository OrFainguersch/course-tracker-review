const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
const auth=fs.readFileSync('auth.js','utf8');
const css=fs.readFileSync('auth.css','utf8');
const config=fs.readFileSync('firebase-config.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const storage=fs.readFileSync('storage-scope.js','utf8');

assert(html.includes('./firebase-config.js?v=20261004-auth2'),'Firebase config must load from the static app');
assert(html.includes('./storage-scope.js?v=20261005-auth6'),'UID storage scope must load from the static app');
assert(html.includes('./auth.css?v=20261005-auth4'),'Authentication UI CSS must be loaded');
assert(html.includes('type="module" src="./auth.js?v=20261005-auth5"'),'Authentication runtime must load as a module');
assert(html.includes('rel="modulepreload" href="https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"'),'Firebase Authentication must preload before the post-login reload');
assert(html.indexOf('./firebase-config.js')<html.indexOf('</head>'),'Firebase config must load before first body paint');
assert(html.indexOf('./firebase-config.js')<html.indexOf('Early preference bootstrap'),'Firebase config must load before any local preference access');
assert(html.indexOf('./storage-scope.js')<html.indexOf('Early preference bootstrap'),'UID storage scope must install before application storage reads');
assert(html.includes("document.documentElement.classList.add(returning?'flympusAuthReturning':'flympusAuthBooting')"),
  'Returning sessions must avoid the hidden boot shell while new sessions remain fail-closed');

assert(config.includes('enabled:true'),'Firebase authentication must be connected');
assert(config.includes('enforceAuth:true'),'Authentication must be enforced after UID-scoped migration');
assert(config.includes('microsoftEnabled:false'),'Microsoft authentication must remain disabled until Entra setup is complete');
assert(!/clientSecret|client_secret|privateKey|private_key/i.test(config),'Public Firebase config must never contain server secrets');

assert(auth.includes("const SDK_VERSION='12.19.0'"),'Use the currently documented Firebase CDN SDK');
assert(auth.includes("new authSdk.GoogleAuthProvider()"),'Google sign-in provider must exist');
assert(auth.includes("new authSdk.OAuthProvider('microsoft.com')"),'Microsoft sign-in provider must exist');
assert(auth.includes('cfg.microsoftEnabled===true'),'Microsoft sign-in UI must be guarded by its feature flag');
assert(auth.includes('signInWithPopup(auth,provider)'),'GitHub Pages authentication must use popup flow by default');
assert(!auth.includes("addScope('mail.read')")&&!auth.includes("addScope('calendars.read')"),
  'FLYMPUS authentication must not request mailbox or calendar scopes');
assert(auth.includes("role:preauthorized&&invitation?.role==='admin'?'admin':'user'")&&auth.includes("status:preauthorized?'active':'pending'"),
  'An uninvited first-time account must start as pending USER while an admin invitation may pre-authorize it');
assert(auth.includes("profile.status!=='active'"),'Only active profiles may unlock authenticated access');
assert(auth.includes("profile.role==='admin'"),'Client role context must distinguish administrators');
assert(auth.includes('openUserManagement')&&auth.includes("getDocs(firestoreSdk.collection(db,'users'))"),'Active administrators must have a Firestore-backed User Management screen');
assert(auth.includes("action==='approve'")&&auth.includes("action==='block'")&&auth.includes("action==='reactivate'"),'User Management must support approval, blocking and reactivation');
assert(auth.includes("action==='make-admin'")&&auth.includes("action==='make-user'"),'User Management must support USER and ADMIN role changes');
assert(auth.includes('FLYMPUS_STORAGE_SCOPE?.setUid')&&auth.includes('FLYMPUS_STORAGE_SCOPE?.clearUid'),'Authentication lifecycle must bind and clear UID-scoped browser state');
assert(auth.includes('if(scopeChanged||migratedLegacyCount>0){location.reload();return}'),'UID selection and legacy migration must use one consolidated reload');
assert(auth.includes("params.get('authPreview')==='1'"),'Login UI must have a safe preview mode before Firebase activation');
assert(auth.includes("auth=authModule.getAuth(firebaseApp)"),'Firebase Auth must use its durable browser persistence stack');
assert(auth.includes("if(typeof auth.authStateReady==='function')await auth.authStateReady();"),'Returning sessions must wait for Firebase persistence restoration before signed-out handling');
assert(!auth.includes("setPersistence(auth,authModule.browserLocalPersistence)"),'Auth persistence must not be reconfigured on every refresh');

assert(css.includes('html.flympusAuthBooting .app')&&css.includes('visibility:hidden!important'),
  'Auth gate must hide the underlying app while enforced authentication is unresolved');
assert(css.includes('html.flympusUserManagementOpen body{position:fixed!important'),'User Management must freeze the page behind its modal');
assert(css.includes('overscroll-behavior:contain')&&css.includes('touch-action:pan-y'),'User Management must contain iOS scrolling inside its own body');
assert(html.includes("classList.contains('flympusUserManagementOpen')"),'Pull-to-refresh must ignore User Management gestures');

assert(rules.includes("request.resource.data.role == 'user'"),'New users may only create USER role');
assert(rules.includes("request.resource.data.status == 'pending'"),'New users may only create PENDING status');
assert(rules.includes("currentUserRecord().data.role == 'admin'"),'Admin writes must be derived from Firestore role state');
assert(rules.includes("currentUserRecord().data.status == 'active'"),'Only active administrators qualify for admin access');
assert(rules.includes('allow read, write: if false;'),'Unmigrated training collections must remain fail-closed');
assert(rules.includes("data.keys().hasOnly"),'User documents must reject unexpected authority-like fields');
assert(rules.includes("affectedKeys().hasOnly"),'Self-service profile writes must be field-limited');

assert(storage.includes("const USER_PREFIX='flympus:user:'"),'Private browser data must use explicit UID namespaces');
assert(storage.includes("admin!==true"),'Only an authenticated administrator may claim legacy device data');
assert(storage.includes('claimed-by-another-user'),'Legacy local data must never be inherited by a second account');
assert(storage.includes("'flympus-app-preferences'"),'Device-level appearance/accessibility preferences may remain shared on the device');


assert(auth.includes('const AUTH_HE_UI=Object.freeze'),'Auth/User Management must own a bilingual dictionary for dynamic UI');
assert(auth.includes("'User Management':'ניהול משתמשים'")&&auth.includes("'Add user':'הוסף משתמש'"),'New authentication/admin UI must include Hebrew translations');
assert(auth.includes('bindAuthLanguageSync()'),'Dynamic auth/admin UI must react when the app language changes');
assert(auth.includes('bindBottomNavigationOverlayDismissal()')&&auth.includes("'#topNotificationDropdown'")&&auth.includes("'#topPersonalProfileDropdown'"),'Bottom navigation must dismiss open notification/profile menus');
assert(auth.includes("firestoreSdk.collection(db,'invitations')")&&auth.includes("firestoreSdk.doc(db,'invitations',email)"),'User Management must support pre-authorizing email invitations');
assert(auth.includes('data-user-invite-form')&&auth.includes('name="email"')&&auth.includes('name="role"'),'User Management must expose Add User email and application-role controls');
assert(auth.includes("preauthorized?'active':'pending'"),'A pre-authorized email must become active on first sign-in');
assert(rules.includes('match /invitations/{email}')&&rules.includes('request.auth.token.email.lower() == email'),'Invitation reads must be bound to the signed-in normalized email');
assert(rules.includes('invitedUserCreate(request.resource.data)'),'First sign-in may inherit only an administrator-created invitation role');
assert(storage.includes('function installResumeThemeHold()')&&storage.includes("attributeFilter:['data-flympus-theme']"),'Early lifecycle layer must hold the stable theme through iOS resume');
assert(storage.includes('const first=sampleSystem()')&&storage.includes('const third=sampleSystem()')&&storage.includes('first===second&&second===third?third:stable'),'Resume theme guard must require three matching System samples');


assert(auth.includes("returningScopedSession=!!window.FLYMPUS_STORAGE_SCOPE?.currentUid?.()"),'Refresh auth should recognize an already UID-scoped returning session');
assert(auth.includes('function scheduleSilentAuthLoading')&&auth.includes('},2200)'),'Returning sessions should delay the visible auth splash instead of showing it on every refresh');
assert(auth.includes("if(returningScopedSession)scheduleSilentAuthLoading('Starting secure authentication…')"),'Auth boot must stay silent for a returning session');
assert(auth.includes("if(returningScopedSession)scheduleSilentAuthLoading('Verifying FLYMPUS access…')"),'Profile verification must also remain silent for a returning session');
assert(auth.includes('function cancelSilentAuthLoading()')&&auth.includes('function unlockApp(){cancelSilentAuthLoading();'),'Successful auth must cancel the delayed splash before it can paint');


assert(css.includes('html.flympusAuthReturning .app')&&css.includes('pointer-events:none!important'),'Returning auth refresh must preserve visual continuity while blocking interaction');
assert(!css.slice(css.indexOf('html.flympusAuthReturning .app'),css.indexOf('html.flympusAuthBooting .app')).includes('visibility:hidden'),'Returning auth refresh must not hide the app');
assert(auth.includes('if(enforce&&!returningScopedSession)lockApp();'),'Returning sessions must skip the opaque auth lock during normal refresh');
assert(auth.includes('lockApp();\n    showLoading(silentAuthLoadingCopy)'),'A slow returning auth check may still fail closed after the grace period');
assert(auth.includes("classList.remove('flympusAuthBooting','flympusAuthReturning','flympusAuthLocked'"),'Successful auth must clear the returning-session guard');


assert(storage.includes("const UID_PERSISTED_KEY='flympus-auth-scope-last-uid'"),'Returning PWA launches must retain a durable UID namespace hint');
assert(storage.includes("rawGet(session,UID_SESSION_KEY)||rawGet(local,UID_PERSISTED_KEY)"),'Cold relaunch must reuse the last verified UID scope before Firebase finishes booting');
assert(storage.includes('rawRemove(local,UID_PERSISTED_KEY)'),'Sign-out must clear the durable UID hint');


assert(html.includes('FLYMPUS_SYSTEM_THEME_SETTLE_MS=1800')&&html.includes('FLYMPUS_SYSTEM_THEME_CONFIRM_MS=350'),'Runtime resume theme reconciliation must outlast the observed iOS transient window');
assert(html.includes('const third=visibleSystemTheme()')&&html.includes('first===second&&second===third'),'Runtime System theme changes must require three stable foreground samples');
assert(storage.includes('RESUME_THEME_SETTLE_MS=1800')&&storage.includes('RESUME_THEME_CONFIRM_MS=350'),'Early theme hold must match the hardened runtime settle window');

console.log('Authentication foundation checks passed');
