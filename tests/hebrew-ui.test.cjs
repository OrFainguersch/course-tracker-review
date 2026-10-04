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
