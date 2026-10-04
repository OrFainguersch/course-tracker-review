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

assert.strictEqual(typeof config.enabled,'boolean');
assert.strictEqual(typeof config.apiBaseUrl,'string');
assert.strictEqual(typeof config.vapidPublicKey,'string');

console.log('Web Push integration checks passed');


/* Settings uses one master toggle; the old test button/actions are intentionally removed. */
assert(html.includes('id="systemNotificationsToggle"'),'Settings must expose system notifications as a single master toggle');
assert(!html.includes('id="testSystemNotification"'),'Settings must not expose a redundant test-notification button');
assert(!html.includes('id="enableSystemNotifications"')&&!html.includes('id="disableSystemNotifications"'),'Settings must not expose separate enable/disable push buttons');
assert(html.includes("pushToggle.onchange=async()=>"),'Master push toggle must drive the existing enable/disable lifecycle');
