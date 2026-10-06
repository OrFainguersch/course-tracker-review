const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
const auth=fs.readFileSync('auth.js','utf8');
const css=fs.readFileSync('auth.css','utf8');
const config=fs.readFileSync('firebase-config.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const storage=fs.readFileSync('storage-scope.js','utf8');
const theme=fs.readFileSync('theme-controller.js','utf8');

assert(html.includes('./firebase-config.js?v=20261004-auth2'),'Firebase config must load from the static app');
assert(html.includes('./storage-scope.js?v=20261006-auth8'),'UID storage scope must load from the static app');
assert(/\.\/auth\.css\?v=[^"'<>\s]+/.test(html),'Authentication UI CSS must be loaded with a cache-busting version');
assert(/type="module" src="\.\/auth\.js\?v=[^"'<>\s]+"/.test(html),'Authentication runtime must load as a versioned module');
assert(html.includes('rel="modulepreload" href="https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"'),'Firebase Authentication must preload before the post-login reload');
assert(html.indexOf('./firebase-config.js')<html.indexOf('</head>'),'Firebase config must load before first body paint');
assert(html.indexOf('id="flympus-theme-bootstrap"')<html.indexOf('./firebase-config.js'),'First-paint theme must resolve before network-dependent Firebase startup scripts');
assert(html.indexOf('id="flympus-theme-bootstrap"')<html.indexOf('./storage-scope.js'),'Device-level appearance preferences must resolve before private application storage is installed');
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
assert(auth.includes('signInWithPopup(auth,provider,authSdk.browserPopupRedirectResolver)'),'Google authentication must use Firebase-managed popup OAuth so redirect URIs stay valid');
assert(auth.includes('if(signInPromise)return signInPromise'),'Repeated taps must reuse the active sign-in attempt instead of opening a second Firebase popup');
assert(auth.includes("code==='auth/cancelled-popup-request'")&&auth.includes('waitForSignedInUser()'),'A transient iOS cancelled-popup-request must wait for the already-open sign-in instead of flashing a false failure');
assert(!auth.includes("identityToolkitRequest(")&&!auth.includes("startStandaloneGoogleSignIn(")&&!auth.includes("signInWithRedirect("),'Authentication must not use the temporary direct OAuth redirect experiment');
assert(!auth.includes("addScope('mail.read')")&&!auth.includes("addScope('calendars.read')"),
  'FLYMPUS authentication must not request mailbox or calendar scopes');
assert(auth.includes("['admin','training_manager'].includes(invitation?.role)")&&auth.includes("status:preauthorized?'active':'pending'"),
  'An uninvited first-time account must start as pending USER while an invitation may pre-authorize USER, TRAINING_MANAGER or ADMIN access');
assert(auth.includes("profile.status!=='active'"),'Only active profiles may unlock authenticated access');
assert(auth.includes("APP_ROLE_ORDER=Object.freeze(['user','training_manager','admin','owner'])")&&auth.includes("function hasCapability("),
  'Client role context must use explicit tiered application roles and capabilities');
assert(auth.includes('openUserManagement')&&auth.includes("getDocs(firestoreSdk.collection(db,'users'))"),'Active administrators must have a Firestore-backed User Management screen');
assert(auth.includes("action==='approve'")&&auth.includes("action==='block'")&&auth.includes("action==='reactivate'"),'User Management must support approval, blocking and reactivation');
assert(auth.includes('updateManagedUserRole')&&auth.includes('updateManagedInvitationRole')&&auth.includes("role==='owner'"),
  'User Management must support tiered role changes while protecting OWNER');
assert(auth.includes('FLYMPUS_STORAGE_SCOPE?.setUid')&&auth.includes('FLYMPUS_STORAGE_SCOPE?.clearUid'),'Authentication lifecycle must bind and clear UID-scoped browser state');
assert((auth.match(/FLYMPUS_STORAGE_SCOPE\?\.clearUid\?\.\(\)/g)||[]).length===1,'Only explicit sign-out may clear the durable UID namespace hint');
assert(auth.includes('if(scopeChanged||migratedLegacyCount>0){location.reload();return}'),'UID selection and legacy migration must use one consolidated reload');
assert(auth.includes("params.get('authPreview')==='1'"),'Login UI must have a safe preview mode before Firebase activation');
assert(auth.includes("auth=authModule.initializeAuth(firebaseApp,{"),'Firebase Auth must be initialized with explicit platform dependencies');
assert(auth.includes("persistence:authModule.browserLocalPersistence"),'Firebase Auth must use durable LOCAL persistence on the app origin');
assert(auth.includes("popupRedirectResolver:authModule.browserPopupRedirectResolver"),'Firebase Auth must own the browser popup resolver on the initialized instance');
assert(!auth.includes("persistence:[authModule.browserLocalPersistence"),'Auth must not bounce the user between localStorage and IndexedDB persistence layers');
assert(auth.includes("if(typeof auth.authStateReady==='function')await auth.authStateReady();"),'Returning sessions must wait for Firebase persistence restoration before signed-out handling');
assert(!auth.includes("setPersistence(auth,authModule.browserLocalPersistence)"),'Auth persistence must not be reconfigured on every refresh');

assert(css.includes('html.flympusAuthBooting .app')&&css.includes('visibility:hidden!important'),
  'Auth gate must hide the underlying app while enforced authentication is unresolved');
assert(html.includes('id="flympusAuthRoot" class="flympusAuthInitial"')&&css.includes('#flympusAuthRoot.flympusAuthInitial'),
  'A branded authentication shell must be present in static HTML before the deferred Firebase runtime loads');
assert(html.includes("case'user-management':html=userManagementScreen()")&&auth.includes('mountUserManagementPage'),
  'User Management must render as a real application screen');
assert(css.includes('#flympusUserManagementPageRoot')&&css.includes('.flympusRoleGuideGrid'),
  'User Management page must include dedicated responsive page and role-guide styling');
assert(auth.includes("window.FLYMPUS_NAVIGATE('user-management')"),
  'Profile shortcut must navigate to the same User Management screen');

assert(rules.includes("data.role in ['user', 'training_manager', 'admin', 'owner']"),
  'Firestore must recognize the complete application-role hierarchy');
assert(rules.includes("request.resource.data.role == 'user'")&&rules.includes("request.resource.data.status == 'pending'"),
  'Uninvited first sign-in must remain pending USER');
assert(rules.includes("currentUserRecord().data.role in ['owner', 'admin']"),
  'User administration must be limited to active OWNER or ADMIN accounts');
assert(rules.includes('match /system/access')&&rules.includes('ownerBootstrap(uid)')&&rules.includes("resource.data.role != 'owner'"),
  'Firestore must provide a one-time Owner bootstrap and protect the Owner from administrator mutation');
assert(rules.includes('allow read, write: if false;'),'Unmigrated training collections must remain fail-closed');
assert(rules.includes("data.keys().hasOnly"),'User documents must reject unexpected authority-like fields');
assert(rules.includes("affectedKeys().hasOnly"),'Self-service profile writes must be field-limited');

assert(storage.includes("const USER_PREFIX='flympus:user:'"),'Private browser data must use explicit UID namespaces');
assert(storage.includes("admin!==true"),'Only an authenticated administrator may claim legacy device data');
assert(storage.includes('claimed-by-another-user'),'Legacy local data must never be inherited by a second account');
assert(storage.includes("'flympus-app-preferences'"),'Device-level appearance/accessibility preferences may remain shared on the device');


assert(auth.includes('const AUTH_HE_UI=Object.freeze'),'Auth/User Management must own a bilingual dictionary for dynamic UI');
assert(auth.includes("'User Management':'ניהול משתמשים'")&&auth.includes("'Owner':'בעלים'")&&auth.includes("'Training Manager':'מנהל הדרכה'"),
  'Authentication and role-management UI must include Hebrew translations for the full role hierarchy');
assert(auth.includes('bindAuthLanguageSync()'),'Dynamic auth/admin UI must react when the app language changes');
assert(auth.includes('roleGuideHtml()')&&auth.includes('App role and course role are separate.'),
  'User Management must explain role meaning and explicitly separate app roles from course roles');
assert(html.includes("flympusCan('roster.manage')")&&html.includes("flympusCan('courses.create')")&&html.includes("flympusCan('packages.manageGlobal')"),
  'Structural roster, course and global Package editing must be capability-gated');
assert(auth.includes('bindBottomNavigationOverlayDismissal()')&&auth.includes("'#topNotificationDropdown'")&&auth.includes("'#topPersonalProfileDropdown'"),'Bottom navigation must dismiss open notification/profile menus');
assert(auth.includes("firestoreSdk.collection(db,'invitations')")&&auth.includes("firestoreSdk.doc(db,'invitations',email)"),'User Management must support pre-authorizing email invitations');
assert(auth.includes('data-user-invite-form')&&auth.includes('name="email"')&&auth.includes('name="role"'),'User Management must expose Add User email and application-role controls');
assert(auth.includes("preauthorized?'active':'pending'"),'A pre-authorized email must become active on first sign-in');
assert(rules.includes('match /invitations/{email}')&&rules.includes('request.auth.token.email.lower() == email'),'Invitation reads must be bound to the signed-in normalized email');
assert(rules.includes('invitedUserCreate(request.resource.data)')&&rules.includes("data.role in ['user', 'training_manager', 'admin']"),
  'First sign-in may inherit only a non-Owner administrator-created invitation role');
assert(theme.includes('Single theme authority'),'Theme lifecycle must have one authoritative writer');
assert(theme.includes("window.addEventListener('pageshow'")&&theme.includes('reassertStableTheme()'),'iOS resume must reassert the committed theme without probing transient state');
assert(!storage.includes('installResumeThemeHold')&&!theme.includes('setTimeout('),'Theme lifecycle must not retain competing timeout-based resume writers');


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


assert(auth.includes('let authStateVersion=0')&&auth.includes('version!==authStateVersion'),'Stale asynchronous auth callbacks must never unlock or rescope the app');

console.log('Authentication foundation checks passed');
