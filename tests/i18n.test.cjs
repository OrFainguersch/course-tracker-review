const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');

assert(html.includes("language:'en'"),'English must remain the default language');
assert(html.includes("data-app-pref-select=\"language\""),'Settings must expose a language selector');
assert(html.includes("root?.setAttribute('dir',language==='he'?'rtl':'ltr')"),'Hebrew must switch the document to RTL');
assert(html.includes("function applyFlympusLanguage"),'UI translation pass must exist');
assert(html.includes("function flympusI18nProtectedValues"),'User-entered/domain values must be protected from UI translation');
assert(html.includes("Object.assign(FLYMPUS_HE_UI"),'Extended Hebrew UI dictionary must be present');
assert(html.includes("Complete Hebrew / RTL alignment"),'RTL layout coverage must apply beyond the Settings screen');
assert(html.includes("'System notifications':'התראות מערכת'"),'Push settings must be translated');
assert(html.includes("'Course Management':'ניהול קורס'"),'Course Management navigation must be translated');
assert(html.includes("'Assessment criteria':'קריטריוני הערכה'"),'Forms/course configuration labels must be translated');

console.log('Hebrew i18n integration checks passed');
