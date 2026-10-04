const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');

[
  "'DAILY OPERATIONS':'פעילות יומית'",
  "'Day overview':'סקירת היום'",
  "'Use suggested grade':'השתמש בציון המוצע'",
  "'Instructor override':'ציון מדריך ידני'",
  "'Emergency practice':'תרגול מצבי חירום'",
  "'Record and review theoretical exam results for this course.':'תעד וסקור תוצאות מבחנים עיוניים עבור קורס זה.'",
  "'Edit identity, photo and course membership safely.':'ערוך זהות, תמונה ושיוך לקורס באופן בטוח.'"
].forEach(x=>assert(html.includes(x), 'Missing Hebrew UI translation: '+x));

assert(html.includes("translate:calc(-1 * var(--drawer-push-width)) 0!important"),'Hebrew drawer must push the app shell left');
assert(html.includes('html[data-flympus-language="he"] .rosterTraineeHead{'),'Hebrew roster override must exist');
assert(html.includes('justify-items:start!important'),'Hebrew trainee name/status must align to the mirrored start edge');
assert(html.includes("attributeFilter:['placeholder','title','aria-label']"),'Dynamic translated attributes must remain synchronized');
assert(html.includes("flympusI18nProtectedValues"),'Names/configured values must remain protected from UI translation');

console.log('Hebrew UI/RTL integration checks passed');


/* Full-site Hebrew audit regression coverage */
[
  '"Recent Activity": "פעילות אחרונה"',
  '"Qualification Requirements": "דרישות הסמכה"',
  '"Syllabus progression": "התקדמות בסילבוס"',
  '"Electrical": "חשמל"',
  '"No cancellation reasons are configured.": "לא הוגדרו סיבות ביטול."',
  '"Only exam results recorded for the active course are shown.": "מוצגות רק תוצאות מבחנים שתועדו עבור הקורס הפעיל."'
].forEach(x=>assert(html.includes(x), 'Missing full-site Hebrew UI translation: '+x));

assert(html.includes("trim.match(/^·\\s*(.+)$/)"),'Punctuation-prefixed helper copy must still translate');
assert(html.includes("body.drawerPushOpen .backdrop{\n  background:transparent!important;"),'Push drawer must leave the displaced page visible');
assert(html.includes("html[data-flympus-language=\"he\"] .personCard.traineeRosterCard .rosterTraineeHead{\n  width:100%!important;"),'Hebrew trainee identity must occupy the mirrored content edge');


/* Split-node and empty-state Hebrew coverage */
assert(html.includes('"Syllabi / practical tasks (": "סילבוסים / משימות מעשיות ("'),'Split syllabus heading fragment must translate');
assert(html.includes('"minimum flights": "טיסות מינימום"'),'Split minimum-flights label must translate');
assert(html.includes("No (assessment criteria|emergency requirements|experience requirements|exams|progression gates|items) configured"),'Dynamic empty package states must translate');


/* Early locale bootstrap + mirrored drawer gesture */
const earlyLocaleIndex=html.indexOf('/* Early locale bootstrap: prevent RTL/LTR paint flash on reload. */');
const firstStyleIndex=html.indexOf('<style>');
assert(earlyLocaleIndex>=0 && firstStyleIndex>=0 && earlyLocaleIndex<firstStyleIndex,'Saved Hebrew dir/lang must be applied before CSS can paint');
assert(html.includes("const drawerCloseSwipeIsRight=()=>getFlympusAppPreferences().language==='he'"),'Drawer gesture must mirror with Hebrew');
assert(html.includes("drawerCloseSwipeIsRight()?dx>12:dx<-12"),'Hebrew drawer close swipe must claim rightward movement');
assert(html.includes("drawerCloseSwipeIsRight()?dx>=58:dx<=-58"),'Hebrew drawer close swipe must complete to the right');
