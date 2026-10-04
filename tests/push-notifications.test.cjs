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

assert(sw.includes("addEventListener('push'"),'Service worker must handle push');
assert(sw.includes("showNotification"),'Service worker must display OS notifications');
assert(sw.includes("addEventListener('notificationclick'"),'Notification clicks must be handled');
assert(sw.includes("FLYMPUS_PUSH_NAVIGATE"),'Clicks must navigate an existing PWA client');

assert.strictEqual(typeof config.enabled,'boolean');
assert.strictEqual(typeof config.apiBaseUrl,'string');
assert.strictEqual(typeof config.vapidPublicKey,'string');

console.log('Web Push integration checks passed');
