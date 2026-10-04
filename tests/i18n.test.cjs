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

assert(html.includes("'✎ Manage':'✎ ניהול'"),'Roster Manage action must translate');
assert(html.includes("'Trainees and instructors assigned to this course.':'חניכים ומדריכים המשויכים לקורס זה.'"),'Roster description must translate');
assert(html.includes("'Search trainees...':'חפש חניכים...'"),'Roster search placeholder must translate');
assert(html.includes("'All':'הכול'"),'Generic All filter value must translate');
assert(html.includes("'From':'מתאריך'")&&html.includes("'To':'עד תאריך'"),'Date range labels must translate');
assert(html.includes("'IN PROGRESS':'בתהליך'"),'Course lifecycle badges must translate');
assert(html.includes("'COURSE FORMS':'טפסי הקורס'"),'Forms eyebrow must translate');
assert(html.includes("'Record flight performance, grades, criteria and emergency practice.':'תעד ביצועי טיסה, ציונים, קריטריונים ותרגול מצבי חירום.'"),'Evaluation form description must translate');
assert(html.includes("'Log a safety event, operational observation or real emergency.':'תעד אירוע בטיחות, תצפית תפעולית או מצב חירום אמיתי.'"),'Safety form description must translate');
assert(html.includes("'Record theoretical exam results against the required passing grade.':'תעד תוצאות מבחן עיוני מול ציון המעבר הנדרש.'"),'Exam form description must translate');
assert(html.includes("'Create a course':'יצירת קורס'"),'Course creation heading must translate');
assert(html.includes("'Create and manage courses, tailor a selected course, and maintain reusable training Packages and course architecture.'"),'Course Management intro must be covered by Hebrew dictionary');
assert(html.includes("FLYMPUS_HE_UI_CASEFOLD"),'Translation lookup must handle UI capitalization variants');
assert(html.includes('html[data-flympus-language="he"] .drawer .panel')&&html.includes('right:0!important'), 'Hebrew drawer must open from the right');
assert(html.includes('html[data-flympus-language="he"] .rankCorner')&&html.includes('left:0!important'), 'Hebrew roster rank must move to the left corner');
assert(html.includes("Choose the form you want to complete for"),'Dynamic forms copy must preserve names while translating surrounding UI');

console.log('Hebrew i18n integration checks passed');


/* full-site Hebrew audit */
assert(html.includes('"Select one or more": "בחר אחד או יותר"'),'Generic multi-select UI must translate');
assert(html.includes('"Primary mobile navigation": "ניווט ראשי בנייד"'),'Mobile navigation accessibility copy must translate');
assert(html.includes('"Electrical": "חשמל"')&&html.includes('"General / Operational": "כללי / תפעולי"'),'Emergency category labels must translate');
assert(html.includes('"Course to tailor": "קורס להתאמה"'),'Course tailoring UI must translate');
assert(html.includes('"Recent Evaluations": "הערכות אחרונות"'),'Trainee profile UI must translate');
