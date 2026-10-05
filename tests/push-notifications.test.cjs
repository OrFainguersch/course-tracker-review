const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const config=JSON.parse(fs.readFileSync('push-config.json','utf8'));

assert(html.includes("navigator.serviceWorker.register(FLYMPUS_PUSH_SW"),'PWA must register the push service worker');
assert(html.includes("pushManager.subscribe"),'PWA must create a PushSubscription');
assert(html.includes("Notification.requestPermission"),'Permission must be requested from the UI flow');
assert(html.includes("sendFlympusPushSubscriptionToBackend"),'Subscriptions must sync to the delivery server');
assert(html.includes("flympusIsIos()&&!flympusIsStandalone()"),'iOS must require installed standalone PWA mode');
assert(html.includes("data-push-settings"),'Settings must expose push status and controls');
assert(html.includes("FLYMPUS_PUSH_USER_ENABLED_KEY"),'Push must keep an explicit per-device enable/disable preference');
assert(html.includes("setFlympusPushUserEnabled(false)"),'Push must be disableable even when no remote subscription exists');
assert(html.includes("Disabled in FLYMPUS"),'Push status must distinguish app-level disable from OS permission');

assert(sw.includes("addEventListener('push'"),'Service worker must handle push');
assert(sw.includes("showNotification"),'Service worker must display OS notifications');
assert(sw.includes("addEventListener('notificationclick'"),'Notification clicks must be handled');
assert(sw.includes("FLYMPUS_PUSH_NAVIGATE"),'Clicks must navigate an existing PWA client');
assert(sw.includes("const SHELL_CACHE='flympus-shell-'"),'Installed PWA must maintain a versioned static app-shell cache');
assert(sw.includes("request.mode==='navigate'")&&sw.includes("cache.match('./')"),'Cold PWA navigation must render the cached shell without waiting for the network');
assert(sw.includes("updateNavigationCache(request)"),'Cached startup shell must revalidate in the background');
assert(sw.includes("No user/course data is cached here"),'Startup caching must stay limited to static application resources');

assert.strictEqual(typeof config.enabled,'boolean');
assert.strictEqual(typeof config.apiBaseUrl,'string');
assert.strictEqual(typeof config.vapidPublicKey,'string');

console.log('Web Push integration checks passed');


/* Settings uses one master toggle; the old test button/actions are intentionally removed. */
assert(html.includes('id="systemNotificationsToggle"'),'Settings must expose system notifications as a single master toggle');
assert(!html.includes('id="testSystemNotification"'),'Settings must not expose a redundant test-notification button');
assert(!html.includes('id="enableSystemNotifications"')&&!html.includes('id="disableSystemNotifications"'),'Settings must not expose separate enable/disable push buttons');
assert(html.includes("pushToggle.onchange=async()=>"),'Master push toggle must drive the existing enable/disable lifecycle');


/* Push master switch must be visually correct on the first Settings paint. */
assert(html.includes('function getFlympusPushImmediateStatus()'),
  'Settings must derive a synchronous push state before async service-worker checks');
assert(html.includes("const pushInitial=getFlympusPushImmediateStatus();"),
  'Settings render must consume the synchronous push state');
assert(html.includes("(pushInitial.checked?'checked ':'')"),
  'Push master toggle must render checked immediately when this device is already enabled');
assert(html.includes("(pushInitial.disabled?'disabled ':'')"),
  'Push master toggle must render its immediately-known disabled state without a later jump');
assert(html.includes('.pushMasterSwitch:not(.pushSwitchInteractive) i:after{transition:none!important}'),
  'Initial async push verification must not animate the switch thumb');
assert(html.includes("switchLabel?.classList.remove('pushSwitchInteractive')")&&
  html.includes("requestAnimationFrame(()=>requestAnimationFrame(arm))"),
  'Push switch animation must only be armed after verified state is painted');
assert(html.includes("let flympusPushSettingsUiToken=0"),
  'Stale async push status checks must not repaint a newer Settings screen');


/* All prefSwitch families should distinguish hydration from real interaction. */
assert(html.includes('.notificationPreferences:not(.notificationPrefsInteractive) .prefSwitch i:after{transition:none!important}'),
  'Notification preference hydration must never animate like a user change');
