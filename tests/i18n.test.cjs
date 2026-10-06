const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
const auth=fs.readFileSync('auth.js','utf8');

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
assert(html.includes("'Severity / Impact':'חומרה / השפעה'")&&html.includes("'Select severity / impact':'בחר חומרה / השפעה'")&&html.includes("'Severity / Impact guide':'מדריך חומרה / השפעה'"),'Safety severity control and guide must translate to Hebrew');
assert(html.includes("'Minor':'קלה'")&&html.includes("'Moderate':'בינונית'")&&html.includes("'Major':'חמורה'")&&html.includes("'Critical':'קריטית'"),'All four Safety severity levels must translate to Hebrew');
assert(html.includes("'Minor impact, with no real danger or significant effect on the mission.':'השפעה קלה, ללא סכנה ממשית או השפעה משמעותית על המשימה.'")&&html.includes("'Immediate or significant danger to the aircraft, personnel, or flight safety.':'סכנה מיידית או משמעותית לכלי הטיס, לאנשי הצוות או לבטיחות הטיסה.'"),'Safety severity explanations must have explicit Hebrew translations');
assert(html.includes('html[data-flympus-language="he"] .safetySeverityGuide')&&html.includes('direction:rtl;text-align:right'),'Safety severity guide must mirror correctly in Hebrew');
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

/* Dynamic authentication/admin UI follows the same Hebrew contract. */
assert(auth.includes('const AUTH_HE_UI=Object.freeze'),'Authentication UI must have explicit Hebrew coverage');
assert(auth.includes("'Continue with Google':'המשך עם Google'"),'Google sign-in must translate to Hebrew');
assert(auth.includes("'User Management':'ניהול משתמשים'")&&auth.includes("'Add user':'הוסף משתמש'"),'User Management and Add User must translate to Hebrew');
assert(auth.includes("'Role':'תפקיד'")&&auth.includes("'Pending approval':'ממתין לאישור'")&&auth.includes("'Approval requests':'בקשות לאישור'"),'Role and approval-request terminology must translate to Hebrew');
assert(auth.includes("'Owner':'בעלים'")&&auth.includes("'Administrator':'מנהל מערכת'")&&auth.includes("'Training Manager':'מנהל הדרכה'")&&auth.includes("'User':'משתמש'"),
  'All application roles must translate to Hebrew');
assert(html.includes('html[data-flympus-language="he"] #flympusUserManagementPageRoot')&&auth.includes("host.dir=authLanguage()==='he'?'rtl':'ltr'"),
  'User Management must switch to a mirrored RTL page in Hebrew');
assert(auth.includes('syncAuthAdjacentChromeLanguage'),'Profile and notification dropdown additions must synchronize with Hebrew');
assert(auth.includes("'Owner':'בעלים'")&&auth.includes("'Administrator':'מנהל מערכת'")&&auth.includes("'Training Manager':'מנהל הדרכה'")&&auth.includes("'User':'משתמש'"),
  'All application-role names must have explicit Hebrew translations');
assert(html.includes('html[data-flympus-language="he"] #flympusUserManagementPageRoot')&&
  html.includes('html[data-flympus-language="he"] .recordReturnBtn svg{transform:scaleX(-1)'),
  'Hebrew User Management must use RTL composition and mirrored directional navigation');

assert(auth.includes("'May appoint: Owner, Administrator, Training Manager or User':'יכול למנות: בעלים, מנהל מערכת, מנהל הדרכה או משתמש'")&&
  auth.includes("'May appoint: Training Manager or User':'יכול למנות: מנהל הדרכה או משתמש'")&&
  auth.includes("'May appoint: User':'יכול למנות: משתמש'"),
  'Every User Management appointment option must have a Hebrew translation');

assert(auth.includes("'Full User Management and role control':'ניהול מלא של משתמשים ותפקידי מערכת'")&&
  auth.includes("'Manage Users and lower-level roles':'ניהול משתמשים ותפקידים בדרגות נמוכות יותר'")&&
  auth.includes("'Create and manage assigned training courses':'יצירה וניהול של קורסי ההדרכה המשויכים'")&&
  auth.includes("'Submit and manage training records/evaluations':'הזנה וניהול של רישומי הדרכה והערכות'")&&
  auth.includes("'No User Management':'ללא ניהול משתמשים'")&&
  auth.includes("'No course structure, roster or Package editing':'ללא עריכת מבנה הקורס, סגל הקורס או החבילות'"),
  'Role-guide scope and boundary copy must have explicit Hebrew translations');

assert(!auth.includes('flympusRoleSeparationNote')&&!auth.includes('Direct appointment follows the hierarchy:')&&!auth.includes('FLYMPUS role and course role are separate.'),
  'User Management must not restore the removed hierarchy/course-role explanatory note box');
