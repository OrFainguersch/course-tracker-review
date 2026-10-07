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

assert(html.includes('html[data-flympus-language="he"] .drawer .panel')&&html.includes('transform:translate3d(100%,0,0)!important')&&html.includes('translate:calc(-1 * var(--drawer-push-width)) 0!important'),'Hebrew drawer must stay edge-locked while sliding in from the right and pushing the app shell left');
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
assert(html.includes("background:rgba(4,18,32,.18)!important"),'Push drawer must keep the displaced page visible with a restrained dim while preserving FLYMPUS width');
assert(html.includes("html[data-flympus-language=\"he\"] .personCard.traineeRosterCard .rosterTraineeHead{\n  width:100%!important;"),'Hebrew trainee identity must occupy the mirrored content edge');


/* Split-node and empty-state Hebrew coverage */
assert(html.includes('"Syllabi / practical tasks (": "סילבוסים / משימות מעשיות ("'),'Split syllabus heading fragment must translate');
assert(html.includes('"minimum flights": "טיסות מינימום"'),'Split minimum-flights label must translate');
assert(html.includes("No (assessment criteria|emergency requirements|experience requirements|exams|progression gates|items) configured"),'Dynamic empty package states must translate');


/* Early locale bootstrap + mirrored drawer gesture */
const earlyLocaleIndex=html.indexOf('id="flympus-theme-bootstrap"');
const firstStyleIndex=html.indexOf('<style>');
assert(earlyLocaleIndex>=0 && firstStyleIndex>=0 && earlyLocaleIndex<firstStyleIndex,'Saved Hebrew dir/lang must be applied before CSS can paint');
assert(html.includes("const drawerCloseSwipeIsRight=()=>getFlympusAppPreferences().language==='he'"),'Drawer gesture must mirror with Hebrew');
assert(html.includes("drawerCloseSwipeIsRight()?dx>12:dx<-12"),'Hebrew drawer close swipe must claim rightward movement');
assert(html.includes("drawerCloseSwipeIsRight()?dx>=58:dx<=-58"),'Hebrew drawer close swipe must complete to the right');


/* Hebrew adaptive mirror audit */
assert(html.includes("Hebrew adaptive mirror audit · 2026-10-04"),
  "Hebrew must use a deliberate mirrored layout layer, not only text-align:right");
assert(html.includes('html[data-flympus-language="he"] #flympusUserManagementPageRoot .flympusUserManagementPageHead')&&
  html.includes('html[data-flympus-language="he"] #flympusUserManagementPageRoot .flympusUserActions{justify-content:flex-start}'),
  "User Management must deliberately mirror its page structure and action alignment in Hebrew");
assert(html.includes('html[data-flympus-language="he"] .mobileHero .homeCourseStatusBadge')&&html.includes('right:auto!important;left:18px!important'),
  "Home status badge must mirror to the left in Hebrew");
assert(html.includes('html[data-flympus-language="he"] .homePlanTags{justify-content:flex-start!important}'),
  "Hebrew plan tags must align with the right-aligned activity text instead of drifting left");
assert(html.includes('html[data-flympus-language="he"] .formCompletionPanel')&&html.includes('border-right:4px solid var(--brand-gold)!important'),
  "Hebrew warning/completion accents must move to the right edge");
assert(html.includes('html[data-flympus-language="he"] .packageSyllabusTable:not(.ruleEditorTable) .useCell')&&html.includes('left:auto!important;right:0!important'),
  "Sticky Package table controls must mirror to the right in Hebrew");
assert(html.includes("const rtlBack=()=>getFlympusAppPreferences().language==='he'"),
  "Back navigation must know the current language");
assert(html.includes("tracking=rtlBack()?startX>=Math.max(0,w-56):startX<=56"),
  "Hebrew back gesture must start from the right edge");
assert(html.includes("farEnough=rtlBack()?dx<=-72:dx>=72"),
  "Hebrew back gesture must swipe left, mirroring English");


/* Hebrew home mixed-direction composition coverage */
assert(html.includes("'Israel':'ישראל'")&&html.includes("'Cyprus':'קפריסין'"),
  "Known country labels must translate in Hebrew while custom configured values stay protected");
assert(html.includes("'Sounds & Haptics':'צלילים ומשוב הפטי'")&&html.includes("'Sounds':'צלילים'"),
  "Settings sound section must translate correctly whether haptics are shown or hidden on this device");
assert(html.includes("const homeWelcomeLead=homeHebrew?'ברוך שובך,':'Welcome back,'")&&
  html.includes("const homeWelcomeName=homeHebrew?'אור':'Or'")&&
  html.includes(".homeWelcomeLine{display:flex!important;align-items:baseline;gap:5px"),
  "Home greeting must use structural spacing after the comma in both languages, not whitespace or font kerning");
assert(html.includes("const homeForwardArrow=homeHebrew?'←':'→'")&&
  html.includes("class=\"homeAllCoursesArrow\" aria-hidden=\"true\" data-i18n-skip>'+homeForwardArrow+'</i>"),
  "Home all-courses arrow must be rendered as an explicit glyph per writing direction, not CSS-mirrored");
assert(html.includes('class="homeHeroMetaLine"')&&html.includes('class="homeHeroStartDate"'),
  "Home course metadata must isolate RTL labels from LTR dates");
assert(html.includes("homeCountryLabel=homeHebrew?flympusTranslateUiString(homeCountryRaw):homeCountryRaw"),
  "Home country label must be translated explicitly before protected dynamic values are rendered");
assert(html.includes("if(!known)return true;"),
  "Protected configured values may translate only when they have an explicit UI translation");
assert(html.includes("Hebrew composition QA · home and mixed-direction values"),
  "Final RTL composition layer must cover mixed-direction home content");

/* User Management role hierarchy and mirrored page */
const auth=fs.readFileSync('auth.js','utf8');
assert(auth.includes("'Owner':'בעלים'")&&auth.includes("'Training Manager':'מנהל הדרכה'"),
  'Owner and Training Manager must remain translated in Hebrew');
assert(auth.includes("'Manage Training Managers and Users':'ניהול מנהלי הדרכה ומשתמשים'"),
  'Administrator hierarchy explanation must remain translated');
assert(html.includes('html[data-flympus-language="he"] #flympusUserManagementPageRoot .flympusUserManagementPageHead'),
  'User Management page must explicitly join the Hebrew RTL layout layer');
assert(html.includes('html[data-flympus-language="he"] .recordReturnBtn svg{transform:scaleX(-1)'),
  'Directional back navigation must mirror in Hebrew');
