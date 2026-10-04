const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
const auth=fs.readFileSync('auth.js','utf8');
const css=fs.readFileSync('auth.css','utf8');
const config=fs.readFileSync('firebase-config.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const storage=fs.readFileSync('storage-scope.js','utf8');

assert(html.includes('./firebase-config.js?v=20261004-auth2'),'Firebase config must load from the static app');
assert(html.includes('./storage-scope.js?v=20261004-auth2'),'UID storage scope must load from the static app');
assert(html.includes('./auth.css?v=20261004-auth1'),'Authentication UI CSS must be loaded');
assert(html.includes('type="module" src="./auth.js?v=20261004-auth2"'),'Authentication runtime must load as a module');
assert(html.indexOf('./firebase-config.js')<html.indexOf('</head>'),'Firebase config must load before first body paint');
assert(html.indexOf('./firebase-config.js')<html.indexOf('Early preference bootstrap'),'Firebase config must load before any local preference access');
assert(html.indexOf('./storage-scope.js')<html.indexOf('Early preference bootstrap'),'UID storage scope must install before application storage reads');
assert(html.includes("if(cfg.enabled===true&&cfg.enforceAuth===true)document.documentElement.classList.add('flympusAuthBooting')"),
  'Enforced auth must hide the app before first paint');

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
assert(auth.includes("role:'user'")&&auth.includes("status:'pending'"),
  'A first-time authenticated user must start as pending USER');
assert(auth.includes("profile.status!=='active'"),'Only active profiles may unlock authenticated access');
assert(auth.includes("profile.role==='admin'"),'Client role context must distinguish administrators');
assert(auth.includes('openUserManagement')&&auth.includes("getDocs(firestoreSdk.collection(db,'users'))"),'Active administrators must have a Firestore-backed User Management screen');
assert(auth.includes("action==='approve'")&&auth.includes("action==='block'")&&auth.includes("action==='reactivate'"),'User Management must support approval, blocking and reactivation');
assert(auth.includes("action==='make-admin'")&&auth.includes("action==='make-user'"),'User Management must support USER and ADMIN role changes');
assert(auth.includes('FLYMPUS_STORAGE_SCOPE?.setUid')&&auth.includes('FLYMPUS_STORAGE_SCOPE?.clearUid'),'Authentication lifecycle must bind and clear UID-scoped browser state');
assert(auth.includes("params.get('authPreview')==='1'"),'Login UI must have a safe preview mode before Firebase activation');
assert(auth.includes("browserLocalPersistence"),'Signed-in sessions should persist on the device');

assert(css.includes('html.flympusAuthBooting .app')&&css.includes('visibility:hidden!important'),
  'Auth gate must hide the underlying app while enforced authentication is unresolved');

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

console.log('Authentication foundation checks passed');
