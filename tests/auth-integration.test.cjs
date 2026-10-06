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
assert(auth.includes("['owner','admin','training_manager','user'].includes(invitation?.role)")&&auth.includes("status:preauthorized?'active':'pending'"),
  'An uninvited first-time account must start as pending USER while a valid invitation may pre-authorize the exact hierarchy-granted role');
assert(auth.includes("profile.status!=='active'"),'Only active profiles may unlock authenticated access');
assert(auth.includes("APP_ROLE_ORDER=Object.freeze(['user','training_manager','admin','owner'])")&&auth.includes("function hasCapability("),
  'Client role context must use explicit tiered application roles and capabilities');
assert(auth.includes('openUserManagement')&&auth.includes("getDocs(firestoreSdk.collection(db,'users'))"),'Active user managers must have a Firestore-backed User Management screen');
assert(auth.includes("action==='approve'")&&auth.includes("action==='block'")&&auth.includes("action==='reactivate'"),'User Management must support approval, blocking and reactivation');
assert(auth.includes('updateManagedUserRole')&&auth.includes('updateManagedInvitationRole')&&auth.includes("role==='owner'"),
  'User Management must support tiered role changes while protecting OWNER');
assert(auth.includes("if(actor==='owner')return ['owner','admin','training_manager','user']")&&auth.includes("if(actor==='admin')return ['training_manager','user']")&&auth.includes("if(actor==='training_manager')return ['user']"),
  'Client role selectors must expose every role each manager is allowed to appoint directly');
assert(auth.includes("training_manager:Object.freeze({")&&auth.includes("capabilities:Object.freeze(['users.manage','courses.create','courses.manageAssigned'"),
  'Training Manager must have User Management capability for lower-tier Users');
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
assert(!auth.includes('flympusRoleGlyph')&&auth.includes('flympusUserRoleBadge'),
  'Role guide cards must not render decorative role icons and user cards must use aligned role badges');
assert(auth.includes("'Edit':'עריכה'")&&css.includes('#flympusUserManagementPageRoot[dir="rtl"] .flympusUserCard{direction:rtl}'),
  'User Management Edit controls and card geometry must support mirrored Hebrew RTL layout');
assert(auth.includes("function managementInitials(value)")&&auth.includes("managementInitials(officialName||user.email||'?')")&&auth.includes("tr('Nickname'))+' · '"),
  'Administration identity cards must keep official-name initials primary and format Nickname like Roster');
assert(css.includes('User Management roster-parity cards · 0743')&&css.includes('grid-template-columns:72px minmax(0,1fr) auto')&&css.includes('.flympusUserRoleBadge:before'),
  'Administration identity cards must follow Roster avatar, spacing and role-pill rules without adding training statistics');
assert(css.includes('.flympusRoleGuideCard.training_manager{border-color:#b8c8f3')&&!css.includes('.flympusRoleGuideCard.training_manager{border-color:#cbe7dc'),
  'Training Manager role styling must use the application-role cobalt palette rather than Active-status green');
assert(css.includes('.flympusRoleGuideCard.user{border-color:#b7dff1')&&css.includes('.flympusUserRoleBadge.user{background:#e2f5ff'),
  'USER must use a visibly active sky-blue palette instead of disabled-looking gray');
assert(auth.includes("window.FLYMPUS_NAVIGATE('user-management')"),
  'Profile shortcut must navigate to the same User Management screen');

assert(rules.includes("data.role in ['user', 'training_manager', 'admin', 'owner']"),
  'Firestore must recognize the complete application-role hierarchy');
assert(rules.includes("request.resource.data.role == 'user'")&&rules.includes("request.resource.data.status == 'pending'"),
  'Uninvited first sign-in must remain pending USER');
assert(rules.includes("currentUserRecord().data.role in ['owner', 'admin', 'training_manager']"),
  'User Management must be available to active OWNER, ADMIN and TRAINING_MANAGER accounts');
assert(rules.includes('match /system/access')&&rules.includes('ownerBootstrap(uid)')&&rules.includes("uid == systemOwnerUid()"),
  'Firestore must preserve the one-time Owner bootstrap and protect the Primary Owner');
assert(rules.includes("actorRole == 'owner' && nextRole in ['owner', 'admin', 'training_manager', 'user']")&&rules.includes("actorRole == 'admin' && nextRole in ['training_manager', 'user']")&&rules.includes("actorRole == 'training_manager' && nextRole == 'user'"),
  'Role grants must allow each manager to directly appoint every permitted lower tier');
assert(rules.includes("actorRole == 'admin' && targetRole in ['training_manager', 'user']")&&rules.includes("actorRole == 'training_manager' && targetRole == 'user'"),
  'Administrators and Training Managers may manage only lower account tiers');
assert(rules.includes('allow read, write: if false;'),'Unmigrated training collections must remain fail-closed');
assert(rules.includes("data.keys().hasOnly"),'User documents must reject unexpected authority-like fields');
assert(rules.includes("affectedKeys().hasOnly"),'Self-service profile writes must be field-limited');
assert(rules.includes("preferredName"),'User profiles must support a preferred name field');
assert(auth.includes('updateOwnPreferredName')&&auth.includes('updateNickname:name=>updateOwnPreferredName(name)')&&auth.includes('updateOwnOfficialName'),'Auth runtime must preserve preferredName storage compatibility while exposing instructor self-service as Nickname');

assert(storage.includes("const USER_PREFIX='flympus:user:'"),'Private browser data must use explicit UID namespaces');
assert(storage.includes("admin!==true"),'Only an authenticated administrator may claim legacy device data');
assert(storage.includes('claimed-by-another-user'),'Legacy local data must never be inherited by a second account');
assert(storage.includes("'flympus-app-preferences'"),'Device-level appearance/accessibility preferences may remain shared on the device');


assert(auth.includes('const AUTH_HE_UI=Object.freeze'),'Auth/User Management must own a bilingual dictionary for dynamic UI');
assert(auth.includes("'User Management':'ניהול משתמשים'")&&auth.includes("'Owner':'בעלים'")&&auth.includes("'Training Manager':'מנהל הדרכה'"),
  'Authentication and role-management UI must include Hebrew translations for the full role hierarchy');
assert(auth.includes('bindAuthLanguageSync()'),'Dynamic auth/admin UI must react when the app language changes');
assert(auth.includes('roleGuideHtml()')&&!auth.includes('flympusRoleSeparationNote'),
  'User Management role guide must stay concise and must not render a separate explanatory note box');
assert(auth.includes("['owner','Full system control',['May appoint: Owner, Administrator, Training Manager or User','Full access to all courses and global Packages','Full User Management and role control','Primary Owner is protected']]")&&
  auth.includes("['admin','System administration',['May appoint: Training Manager or User','Manage Users and lower-level roles','Manage all courses and global Packages','Full training administration']]")&&
  auth.includes("['training_manager','Training administration',['May appoint: User','Create and manage assigned training courses','Manage course rosters','Create course-specific Package overrides','Submit and manage training records/evaluations']]")&&
  auth.includes("['user','Operational access',['Work in assigned courses','Submit evaluations and forms','No User Management','No course structure, roster or Package editing']]"),
  'Role guide must concisely explain scope, appointment rights and the key boundaries of every application role');
assert(auth.includes('Managed at a higher level')&&!auth.includes('Direct appointment follows the hierarchy:'),
  'User Management must keep appointment rights inside the role cards without a duplicated hierarchy note');
assert(auth.includes('data-managed-user-form')&&auth.includes('updateManagedUserDetails')&&auth.includes('name="role"')&&auth.includes('Email is tied to the sign-in account and cannot be changed here.'),
  'Edit must manage Name and Role together while keeping the sign-in email read-only');
assert(auth.includes("tr('Role')")&&!auth.includes("<span>'+esc(tr('App role'))+'</span><select name=\"role\">"),
  'User Management controls must label the application-level field simply as Role');
assert(auth.includes("tr('Pending approval')")&&auth.includes("'Approval requests'")&&auth.includes('Signed in without an invitation and waiting for approval.'),
  'Pending must be presented as an approval request distinct from pre-authorized invitations');
assert(html.includes("flympusCan('roster.manage')")&&html.includes("flympusCan('courses.create')")&&html.includes("flympusCan('packages.manageGlobal')"),
  'Structural roster, course and global Package editing must be capability-gated');
assert(auth.includes('bindBottomNavigationOverlayDismissal()')&&auth.includes("'#topNotificationDropdown'")&&auth.includes("'#topPersonalProfileDropdown'"),'Bottom navigation must dismiss open notification/profile menus');
assert(auth.includes("firestoreSdk.collection(db,'invitations')")&&auth.includes("firestoreSdk.doc(db,'invitations',email)"),'User Management must support pre-authorizing email invitations');
assert(auth.includes('data-user-invite-form')&&auth.includes('name="email"')&&auth.includes('name="role"'),'User Management must expose Add User email and application-role controls');
assert(auth.includes("preauthorized?'active':'pending'"),'A pre-authorized email must become active on first sign-in');
assert(rules.includes('match /invitations/{email}')&&rules.includes('request.auth.token.email.lower() == email'),'Invitation reads must be bound to the signed-in normalized email');
assert(rules.includes('invitedUserCreate(request.resource.data)')&&rules.includes("data.role in ['user', 'training_manager', 'admin', 'owner']")&&rules.includes('mayGrantInvitationRole(request.resource.data.role)'),
  'First sign-in may inherit only a role that was validly granted through the hierarchy');
assert(theme.includes('Single theme authority'),'Theme lifecycle must have one authoritative writer');
assert(theme.includes("window.addEventListener('pageshow'")&&theme.includes('reassertStableTheme()'),'iOS resume must reassert the committed theme without probing transient state');
assert(!storage.includes('installResumeThemeHold')&&!theme.includes('setTimeout('),'Theme lifecycle must not retain competing timeout-based resume writers');


assert(auth.includes("returningScopedSession=!!window.FLYMPUS_STORAGE_SCOPE?.currentUid?.()"),'Refresh auth should recognize an already UID-scoped returning session');
assert(auth.includes('function scheduleSilentAuthLoading')&&auth.includes('},2200)'),'Returning sessions should delay the visible auth splash instead of showing it on every refresh');
assert(auth.includes("if(returningScopedSession)scheduleSilentAuthLoading('Starting secure authentication…')"),'Auth boot must stay silent for a returning session');
assert(auth.includes("else api.status='booting';"),'Signed-out first paint should keep the compact login surface instead of flashing a loading card');
assert(auth.includes("scheduleSilentAuthLoading('Verifying FLYMPUS access…');"),'Profile verification should stay visually silent long enough for fast sign-ins to return directly to the app');
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

assert(css.includes('User Management typography + accessibility alignment · 2026-10-06')&&
  css.includes('#flympusUserManagementPageRoot .flympusRoleGuideCard ul{font-size:11.5px')&&
  css.includes('html.flympusLargeText #flympusUserManagementPageRoot'),
  'User Management must share the readable site type scale and respond to Larger Text');
assert(auth.includes("'Account':'חשבון'")&&auth.includes("'Could not update preferred name':'לא ניתן לעדכן את הכינוי'"),
  'Dynamic auth/admin translations must cover every currently used direct tr() key');
