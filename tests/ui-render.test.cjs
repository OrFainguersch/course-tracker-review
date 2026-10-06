const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const storage=()=>{const values=new Map();return{get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}};
class ElementStub{
  constructor(){this.innerHTML="";this.textContent="";this.value="";this.dataset={};this.style={};this.attributes=new Map();this._classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>this._classes.add(x)),remove:(...xs)=>xs.forEach(x=>this._classes.delete(x)),toggle:(x,force)=>{if(force===true){this._classes.add(x);return true}if(force===false){this._classes.delete(x);return false}if(this._classes.has(x)){this._classes.delete(x);return false}this._classes.add(x);return true},contains:x=>this._classes.has(x)}}
  setAttribute(k,v){this.attributes.set(k,String(v))} getAttribute(k){return this.attributes.get(k)??null} removeAttribute(k){this.attributes.delete(k)}
  querySelectorAll(){return[]} querySelector(){return null} addEventListener(){} click(){this.onclick?.({preventDefault(){},stopPropagation(){},target:this})} appendChild(){}
}
const elements=new Map(["#menuBtn","#backdrop","#nav","#content","#drawer","#toast","#topCourseName"].map(id=>[id,new ElementStub()]));
const document={querySelector:selector=>elements.get(selector)||null,querySelectorAll:()=>[],createElement:()=>new ElementStub(),createTreeWalker:()=>({nextNode:()=>null}),addEventListener(){},removeEventListener(){},visibilityState:'visible',documentElement:new ElementStub(),body:new ElementStub(),scrollingElement:new ElementStub()};
const context={window:{},document,localStorage:storage(),sessionStorage:storage(),console,confirm:()=>true,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:fn=>0,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>0},history:{},getComputedStyle:()=>({}),NodeFilter:{SHOW_TEXT:4},Date,Math,JSON,Number,String,Array,Object,Map,Set,URLSearchParams,FormData:class{},Blob:class{},URL:{createObjectURL(){return""},revokeObjectURL(){}},location:{search:''},navigator:{}};
context.window=context;vm.createContext(context);
for(const file of ["assets/ep-catalog.js","assets/aerostar-platform.js","assets/ip-catalog.js","assets/technician-catalog.js","assets/training-core.js","assets/ep-lessons-screening.js","assets/ep-lessons-rc-1.js","assets/ep-lessons-rc-2.js","assets/ep-lessons-half.js","assets/ep-lessons-full-day-a.js","assets/ep-lessons-full-day-b.js","assets/ep-lessons-night.js"]){vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file})}
const html=fs.readFileSync("index.html","utf8");
const manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));
assert.equal(manifest.short_name,"FLYMPUS","Web app manifest must identify FLYMPUS consistently");
assert.equal(manifest.display,"standalone","Home Screen installation must use standalone display mode");
assert.equal(manifest.start_url,"./","Home Screen app must start inside the same GitHub Pages scope");
assert(html.includes('rel="manifest" href="./manifest.webmanifest"')&&html.includes('apple-mobile-web-app-title" content="FLYMPUS"'),"Index must advertise the FLYMPUS manifest and iOS app title");
assert(html.includes("tile('platform','Platform',platformValue)")&&html.includes("tile('training','Training type',meta.trainingKind)")&&html.includes("countryTile=tile('country','Country',meta.country,showContext?'':'countryWide')"),"My Courses must render course details as visible metadata tiles");
assert(html.includes("platformLabels:{rc_simulator:'RC Simulator',rc_model:'Shahak'"),"Shahak must be the default display name for rc_model");
assert(html.includes("catalog.platformLabels=labels"),"Platform renames must persist inside the architecture catalog");
assert(html.includes("internal platform identifier stays stable automatically and is intentionally hidden"),"Platform editor must explain stable hidden IDs");
assert(!html.includes("<span class=\"pill gray\">'+esc(x.id)+'</span>"),"Platform internal IDs must not be shown as user-facing pills");
assert(html.includes("myCoursesPlatformFilter")&&html.includes("myCoursesCountryFilter"),"My Courses must filter by platform and country");
assert(html.includes("myCoursesStatusFilter"),"My Courses must filter by lifecycle status");
assert(html.includes("myCoursesFilters")&&html.includes("myCoursesFilterSummary"),"My Courses filters must use a compact collapsible container");
assert(!html.includes("myCoursesFilterSummaryCount"),"Compact filter header must not show a redundant courses-shown badge");
assert(html.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),"Mobile My Courses filters must stay compact in two columns where space allows");
assert(html.includes("Number(window.innerWidth||9999)>760||state.myCoursesFiltersOpen===true"),"My Courses filter disclosure must default open on desktop and remember mobile expansion");
assert(html.includes('aria-controls="topCourseDropdown"')&&html.includes('id="topCourseDropdown"'),"Header must contain a real course switcher dropdown");
assert(html.includes('id="topNotificationBtn"')&&html.includes('aria-label="Notifications"'),"Header must expose an accessible notifications bell");
assert(html.includes('id="topNotificationDropdown"')&&html.includes("No new notifications"),"Notifications bell must open a notification panel with an empty state");
assert(html.includes("<span>Personal</span>")&&html.includes("across all courses"),"Notifications must be personal to the user rather than scoped to the selected course");
assert(html.includes('id="notificationSettingsLink"')&&html.includes('id="notificationSettingsCard"')&&!html.includes('id="notificationPreferences"'),"The bell must stay a focused notification center and link to the full notification settings screen");
assert(html.includes('data-inapp-notification-pref="assignments"')&&html.includes('data-push-notification-pref="assignments"')&&html.includes("notificationAlwaysOn"),"Settings must separate in-app categories from Push categories while keeping required in-app actions always visible");
assert(html.includes("getNotificationPreferences()")&&html.includes("saveNotificationPreferences")&&html.includes("getPushNotificationPreferences()")&&html.includes("savePushNotificationPreferences"),"In-app and Push notification preferences must persist independently");
assert(html.includes("prefs.requiredActions=true")&&html.includes("preferences:getPushNotificationPreferences()"),"Required actions must remain in the in-app center while the Push backend receives only Push category preferences");
assert(html.includes('id="topPersonalProfileBtn"')&&html.includes('aria-label="Personal profile"'),"The top-right personal avatar must open the personal profile editor");
assert(html.includes("@keyframes flympusHeaderPopoverIn")&&
  html.includes(".topNotificationDropdown:not([hidden])")&&
  html.includes(".topPersonalProfileDropdown:not([hidden])")&&
  html.includes("transform-origin:top right"),
  "Bell and personal-profile popovers must zoom/fade from their header controls instead of appearing abruptly");
assert(html.includes('id="personalPhotoInput"')&&html.includes('id="removePersonalPhoto"'),"Personal profile editing must support changing or removing the user's photo");
assert(html.includes(".personalPhotoActions .btn{flex:1;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important}"),"Personal photo action labels must be visually centered");
assert(html.includes('id="personalCropModal"')&&html.includes('id="personalCropViewport"')&&html.includes('id="personalCropImage"'),"Personal photo selection must open a crop-and-adjust editor");
assert(html.includes("function personalCropDataUrl(")&&html.includes("function renderPersonalPhotoCrop()"),"Profile photo cropper must support repositioning, zooming and exporting the adjusted square");
assert(html.includes("onpointerdown")&&html.includes("onpointermove")&&html.includes("personalCropState.zoom"),"Profile photo cropper must support touch/pointer drag and zoom adjustment");
assert(html.includes("Your name, email and course role are managed by course administration."),"Self-service personal profile must keep identity and role read-only");
assert(html.includes("navigator.storage?.persist")&&html.includes("ensurePersistentDeviceStorage();"),"The app must request persistent device storage when the browser supports it");
assert(html.includes("function positionNotificationDropdown()"),"Notifications panel must position safely on mobile");
assert(html.includes(".panel{display:flex;flex-direction:column;padding-bottom:calc(8px + env(safe-area-inset-bottom))}.panel #nav{flex:0 0 auto}.drawerFooter{margin-top:auto;margin-bottom:6px}"),"Mobile account card should sit close to the true bottom while respecting the safe area");
assert(html.includes(".topNotificationDropdown,.topPersonalProfileDropdown{position:fixed;left:calc(14px + env(safe-area-inset-left));right:calc(14px + env(safe-area-inset-right))"),"Mobile notification and personal-profile panels must stay within the viewport");
assert(html.includes(".topCourseDropdown{position:fixed;left:calc(14px + env(safe-area-inset-left));right:calc(14px + env(safe-area-inset-right));width:auto"),"Mobile quick course dropdown must stay inside the viewport on both sides");
assert(html.includes("function positionTopCourseDropdown()"),"Quick course switcher must position its mobile menu below the real header button");
assert(html.includes("if(open)positionTopCourseDropdown()"),"Opening the quick course switcher must position the mobile menu before interaction");
assert(html.includes("<span>Selected course</span>"),"Header switcher must describe the selected course, not an active lifecycle state");
assert(html.includes('<b id="topCourseName" aria-live="polite">&nbsp;</b>'),"Header must not hard-code Aerostar EP Course before persisted course state is restored");
assert(html.includes("active.courseName||'Aerostar EP Course'"),"Header must restore the persisted selected course name before loading the large application scripts");
assert(html.includes("function navIconSvg(name)")&&html.includes("class=\"navIcon\""),"Sidebar navigation must use a consistent SVG icon system instead of decorative glyphs");
assert(html.includes('id="mobileBottomNav"')&&html.includes("function renderMobileBottomNav()"),"Mobile layout must expose the premium bottom navigation");
assert(html.includes("['roster','roster','Roster'],['planned','planned','Plan'],['home','home','Home'],['record','record','Forms'],['reports','reports','Reports']"),"Mobile bottom navigation must use five top-level tabs with Home exactly centered and Forms grouping the three entry workflows");
assert(html.includes("const state={screen:'home'"),"A fresh session must default to Home while saved session state can still restore the previous screen");
assert(html.includes("const nav=[['__label','','COURSE'],['courses','courses','My Courses'],['settings','settings','Course Management'],['__label','','APP'],['preferences','preferences','Settings']]"),"Sidebar must omit Reports, Safety and Exams because they are direct mobile bottom-nav destinations");
assert(html.includes("n.querySelectorAll('[data-nav]').forEach(b=>{b.onclick=e=>")&&!html.includes("n.querySelectorAll('[data-nav]').forEach(b=>{const pressSound=bindFlympusNavPressSound(b)"),"My Courses and Course Management must remain completely silent; navigation click audio belongs only to the bottom bar");
assert(html.includes("function normalizeDateValue(v)")&&html.includes("function formatDateDMY(v)")&&html.includes('placeholder="DD/MM/YYYY"'),"All date entry/display must use the deterministic DD/MM/YYYY layer");
assert(!/<input[^>]+type="date"/i.test(html),"Native locale-dependent date inputs must not remain in the review UI");
assert(html.includes(".dateDmy{width:100%!important;max-width:100%!important;min-width:0!important"),"Date inputs must be constrained to their container on mobile");
assert(!html.includes('${epCurrentSuitSummaryHtml()}\n<div class="twoCol">'),"Evaluation must not render the redundant Active Suit overview");
assert(!html.includes("activeSuitOverviewHtml()+\n '<div class=\"twoCol\" style=\"margin-top:14px\">"),"Exams must not render the redundant Active Package overview");
assert(html.includes("Analytics are scoped to the active course and its resolved training suit.</p>'+activeSuitOverviewHtml()"),"Course Analytics must keep the active Training Suit overview");
assert(!html.includes('<h3>Filter scope</h3>')&&!html.includes('Filters are applied consistently'),"Course Analytics must hide the Filter scope explainer card");
assert(html.includes("flightDate:normalizeDateValue(fd.get('date'))")&&html.includes("date=normalizeDateValue($('#pveDate').value)"),"Date forms must normalize DD/MM/YYYY back to ISO for storage and comparisons");
assert(html.includes("function builderStartLabel(startsOn){return startsOn?formatDateDMY(startsOn):''}"),"Course-builder date labels must follow DD/MM/YYYY too");
assert(html.includes("submitted Evaluations on '+esc(formatDateDMY(date))"),"Planned vs Executed must never expose the internal ISO date to users");
assert(html.includes("function siteConfirm(")&&!(/\bconfirm\s*\(/.test(html))&&!(/\balert\s*\(/.test(html))&&!(/\bprompt\s*\(/.test(html)),"Native browser dialogs must be replaced by the branded FLYMPUS dialog");
assert(html.includes("function showFormInvalid(")&&html.includes("form.noValidate=true")&&html.includes("submitCopy=/submit/i.test"),"Forms must provide branded validation feedback using Save/Submit-aware copy instead of silent or Safari-native validation");
assert(html.includes('class="card recordActionIsland"')&&html.includes('class="toolbar recordFormActions pveRecordActions"')&&html.includes('id="pveSave" type="button">Submit daily report</button><button class="btn secondary discardDraft" id="discardPlannedDraft"'),"Plan must keep Submit/Discard in a dedicated action island while matching the Forms workflow button pattern");
assert(!html.includes("Daily report incomplete")&&!html.includes("Ready to save")&&html.includes('id="plannedDraftBadge"')&&html.includes("draftSavedLabel('planned'):'Auto-save ready'"),"Plan must replace the old Draft pill with the same auto-save status used by the other forms");
assert(html.includes("function activityDraftMeaningful(name,data)")&&html.includes("if(name==='planned')")&&html.includes("if(name==='safety')")&&html.includes("if(name==='exams')")&&html.includes("if(name==='evaluation')"),"Draft attention must be based on meaningful user input rather than prefilled defaults such as the date");
assert(html.includes("function requiredCompletionPanelShell(prefix)")&&html.includes("function bindRequiredCompletionPanel(form,prefix)")&&html.includes("function staticRequiredCompletionPanel(prefix,items)"),"Fillable Forms workflows must share one branded required-before-submission system");
assert(html.includes("requiredCompletionPanelShell('safety')")&&html.includes("requiredCompletionPanelShell('exam')")&&html.includes("staticRequiredCompletionPanel('planned',planMissing)")&&html.includes('class="evalMissingPanel formCompletionPanel" id="evalMissingPanel"'),"Evaluation, Safety, Exams and Plan must all expose the unified completion panel");
assert(html.includes(".recordFormActions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))")&&html.includes("recordFormActions")&&html.includes("Submit safety event")&&html.includes("Submit exam result")&&html.includes("Submit evaluation"),"Submit and Discard actions must use equal-width shared styling across Forms");
assert(html.includes("Set at least one planned flight before submitting the daily report."),"Plan Submit must still explain missing required planning when clicked");
assert(html.includes("scrollActiveBottomNavTop")&&html.includes("window.scrollTo({top:0,left:0,behavior:'smooth'})"),"Every mobile bottom-nav action must scroll the page back to the top");
assert(html.includes("Mobile dark brand bottom navigation · 0680")&&html.includes("background:linear-gradient(180deg,#123b63 0%,#0b3157 100%)")&&html.includes(".mobileBottomItem.active{color:var(--brand-gold)}"),"Mobile bottom navigation must keep the dark brand style with restrained gold active state");
assert(html.includes("font-size:9.6px")&&html.includes("width:100%;white-space:nowrap;overflow:visible;text-align:center"),"Five-tab mobile navigation labels must remain readable and unclipped");
assert(html.includes("mobileBottomIconButton")&&html.includes("touch-action:none")&&html.includes("width:100%;height:34px")&&html.includes("padding:3px 0 7px")&&html.includes("ongesturestart=e=>e.preventDefault?.()")&&html.includes("pointer-events:none"),"Bottom-nav icon hit areas must be horizontally contiguous while zoom gestures stay suppressed");
assert(!html.includes('data-mobile-more="true"')&&!html.includes("mobileBottomItem moreItem"),"More must not remain in the mobile bottom navigation");
assert(html.includes("['record','evaluation','safety','exams'].includes(state.screen)?'record'"),"Forms must remain the active bottom-nav destination throughout Evaluation, Safety and Exams");
assert(html.includes("function forcePageTop()")&&html.includes("const personScreen=target==='profile'||target==='instructor'")&&html.includes("if(personScreen)forcePageTop()")&&html.includes("const openPersonCard=(screen,extra)=>go(screen,extra)")&&html.includes("openPersonCard('profile',{selectedTrainee:b.dataset.trainee})")&&html.includes("openPersonCard('instructor',{selectedInstructor:b.dataset.instructor})"),"Every trainee or instructor profile entry path must hard-reset the page to the top");
assert(!html.includes('mobileBottomShell')&&!html.includes('shellGold'),"Dark brand navigation must not retain the failed custom vector shell");
assert(html.includes(".mobileBottomItem .mobileBottomLabel{display:block;width:100%;white-space:nowrap;overflow:visible")&&html.includes("class=\"mobileBottomLabel\" aria-hidden=\"true\""),"Mobile navigation labels must remain visible but non-interactive");
assert(html.includes(".mobileBottomItem.homeCenter{transform:none;height:55px}")&&html.includes("width:25px;height:25px;margin:0"),"Centered Home must use the same icon size and treatment as the other tabs");
assert(html.includes("height:74px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr))")&&html.includes("padding:5px 8px calc(7px + env(safe-area-inset-bottom))")&&html.includes("padding:3px 0 7px")&&html.includes("height:34px;min-width:0;min-height:34px"),"Five-tab mobile bottom navigation must stay compact while using seamless horizontal hit areas and extra label-to-underline spacing");
assert(html.includes("function recordHub()")&&html.includes("COURSE FORMS")&&html.includes('<h1 class="pageTitle">Forms</h1>')&&html.includes("Choose the form you want to complete for ")&&html.includes("['evaluation','evaluation','Evaluation'")&&html.includes("['safety','safety','Safety'")&&html.includes("['exams','exams','Exams'"),"Forms must open a dedicated three-choice hub for Evaluation, Safety and Exams");
assert(!html.includes("function recordActionDock(active)")&&!html.includes(".recordActionDockWrap{position:sticky"),"Forms child screens must not show the floating three-action bar");
assert(html.includes("function globalBackControl()")&&html.includes('id="appBackBtn"')&&html.includes('aria-label="Back"')&&html.includes(".recordReturnBtn{width:36px;height:36px")&&html.includes("function bindGlobalBackGesture()")&&html.includes("state.screen!=='home'")&&html.includes("startX<=56")&&html.includes("dx>=72")&&html.includes("e.preventDefault?.()"),"Every non-Home screen must provide the same compact blue back control plus a guarded left-edge swipe");
assert(html.includes("let appNavHistory=[]")&&html.includes("function saveAppNavHistory()")&&html.includes("function goBack(){")&&html.includes("if(target==='home')appNavHistory=[]")&&html.includes("if(screen!=='home')html=globalBackControl()+html"),"Global navigation history must always resolve back to Home as its root");
assert(html.includes("const appRootScreens=new Set(['courses','roster','planned','record','reports','settings','preferences'])")&&html.includes("else if(appRootScreens.has(target))appNavHistory=['home'];"),"Top-level destinations must be sibling screens whose Back action returns directly to Home");
assert(html.includes("const menuBtn=$('#menuBtn'),drawer=$('#drawer'),backdrop=$('#backdrop')")&&html.includes("setDrawerOpen(!drawer.classList.contains('open'))")&&html.includes("backdrop.onclick=()=>setDrawerOpen(false)"),"Hamburger and backdrop handlers must be rebound on every render so the sidebar always opens and closes");
assert(!html.includes("function recordReturnControl()")&&!html.includes("function bindRecordBackGesture()")&&!html.includes('id="backRoster"'),"Forms-only and profile-only back controls must be replaced by the single global back system");

assert(html.includes("function traineeRecordDock(traineeId)")&&html.includes(".profileRecordDock{")&&html.includes("position:sticky!important")&&html.includes("top:78px!important")&&html.includes("traineeRecordDock(t.id)")&&html.includes("--record-safety:#c84444"),"Trainee profiles must own the sticky Evaluation, Safety and Exam action bar with Safety in red");
assert(html.includes("function courseAttentionCounts()")&&html.includes("record:evaluation+safety+exams")&&html.includes("attentionBadgeHtml('record','mobileNavAttention mobileNavRecordAttention',true)")&&html.includes('data-attention-dot="true"'),"Any unfinished Forms draft must roll up into a dot-only attention indicator on the Forms bottom-nav item");
assert(html.includes(".attentionBadge[hidden]{display:none!important}")&&html.includes("el.textContent=n?(dotOnly?'':formatAttentionCount(n)):''")&&html.includes("el.hidden=!n"),"Zero-value attention badges must be completely hidden instead of displaying 0");
assert(html.includes("const attentionSummary=attention.record?")&&html.includes("recordAttentionSummary")&&html.includes("recordCardAttention"),"Forms must render aggregate and per-workflow unfinished indicators only when attention exists");
assert(!html.includes("counts.evaluation+' saved'")&&!html.includes("counts.safety+' saved'")&&!html.includes("counts.exams+' saved'")&&!html.includes('<span class="recordHubCount">'),"Forms cards must not display saved-record counts");
assert(html.includes("function traineeDraftNeedsAttention")&&html.includes("draftTrainee===id")&&html.includes("data-trainee-attention")&&html.includes("profileActionAttention"),"Trainee floating record actions must show an attention badge only when the unfinished draft belongs to that exact trainee");
assert(html.includes("id==='planned'?'planned':''")&&html.includes("planned=draftAttentionCount('planned')"),"Plan must also expose an unfinished-draft badge on its bottom-nav item");

assert(html.includes("safety:'<path d=\"M12 3.5 19 6v5.3c0 4.5-2.7 7.7-7 9.2-4.3-1.5-7-4.7-7-9.2V6l7-2.5Z\"></path><path d=\"M12 8.2v5.1\"></path><path d=\"M12 16.4h.01\"></path>'")&&html.includes("homeQuickIcon safety")+html.includes("homePulseIcon safety")+html.includes("icon safetyIcon"),"Safety must use the shield-with-exclamation icon consistently across relevant surfaces");
assert(html.includes(".recordHubCard.eval{border-top:3px solid var(--record-eval)}")&&html.includes(".recordHubCard.safety{border-top:3px solid var(--record-safety)}")&&html.includes(".recordHubCard.exam{border-top:3px solid var(--record-exam)}"),"Forms hub cards must keep the Evaluation, Safety and Exam color identity used by trainee record actions");

assert(html.includes("Course safety history")&&html.includes("safetyHistorySearch")&&html.includes("safetyHistorySeverity")&&html.includes("safetyHistoryClassification")&&html.includes("safetyHistoryTrainee")&&html.includes("safetyHistoryInstructor"),"Safety must provide course-specific history with search and operational filters");
assert(html.includes('data-evaluation-view="new"')&&html.includes('data-evaluation-view="history"')&&html.includes("Evaluation history")&&html.includes("evaluationHistorySearch")&&html.includes("evaluationHistoryTrainee")&&html.includes("evaluationHistoryInstructor")&&html.includes("evaluationHistorySyllabus"),"Evaluation must use the same New/History pattern with course-specific searchable history");
assert(html.includes("if(state.screen==='evaluation')bindEval();")&&!html.includes("if($('#evalForm'))bindEval();"),"Evaluation tab handlers must bind on the History view even when the evaluation form is not rendered");
assert(html.includes('data-exams-view="new"')&&html.includes('data-exams-view="history"')&&html.includes("Exam history")&&html.includes("examHistorySearch")&&html.includes("examHistoryExam")&&html.includes("examHistoryResult")&&html.includes("examHistoryTrainee"),"Exams must use the same New/History pattern with course-specific searchable history");
assert(!html.includes("<b>Source requirement:</b>")&&!html.includes('id="examPreview"')&&!html.includes("Enter a grade to preview the result."),"Exams New result must not show the removed source-requirement or result-preview panels");
assert(!html.includes("<h3>Recent safety events</h3>")&&!html.includes("Latest entries for this course."),"Safety New event must not show the removed Recent safety events side panel");
assert(html.includes("Submit evaluation")&&html.includes("Submit safety event")&&html.includes("Submit exam result")&&html.includes("Submit daily report"),"Forms workflows must use Submit terminology because entries are auto-saved as drafts before final submission");
assert(!html.includes("<h3>Saved evaluations</h3>")&&!html.includes('id="excelBtn"')&&!html.includes('id="pdfBtn"'),"Evaluation must not keep the old Saved evaluations/export side card");
assert(!html.includes("<h3>Recent recorded results</h3>"),"Exams must not keep the old Recent recorded results side card");
assert(html.includes("state.evaluationView='history'")&&html.includes("state.examsView='history'"),"Saving an Evaluation or Exam result must open its History view");
assert(html.includes("function alphaByName(list)")&&html.includes("activeT=alphaByName(")&&html.includes("alphaByName(courseInstructors()).map")&&html.includes("unassignedExisting=alphaByName("),"Person-name dropdown sources must default to alphabetical order");
assert(!html.includes("['settings','⚙','Course Management']"),"Course Management must not use an emoji gear in the professional navigation");
assert(html.includes("FLYMPUS color system · 0693")&&html.includes("--brand-gold:#d7b45a")&&html.includes(".homeBlockTitle:before,.homeSectionTitle:before{background:var(--brand-gold)}"),"Gold must be centralized as a restrained FLYMPUS brand accent");
assert(html.includes(".courseStateBadge.upcoming{background:#e8f3ff;color:#1769ad}")&&html.includes(".epProgressMeta .current{background:#e8f3ff;color:#1769ad}"),"Current/upcoming informational states must use blue rather than decorative gold");
assert(html.includes(".instructorRole.manager{background:var(--brand-gold-soft);color:var(--brand-gold-deep)}")&&html.includes(".myCourseRoleInline.manager svg{color:var(--brand-gold)}"),"Course Manager distinction must retain the gold identity");
assert(html.includes("Professional visual refinement 0661")&&html.includes(".navBtn.active{background:rgba(255,255,255,.09)")&&html.includes(".sidebarFlympusWordmark{width:172px!important"),"Sidebar styling must use the restrained professional visual layer");
assert(html.includes("homeCourseContext cols")&&html.includes("homeCourseContextItem"),"Home hero must use the minimal labeled key-value strip instead of rounded metadata pills");
assert(html.includes(".homeCourseContext.cols5{grid-template-columns:.74fr 1.08fr 1.06fr 1.42fr .88fr}"),"Five-column Home metadata must allocate enough width to Phase and Type on mobile");
assert(html.includes(".homeContextLabelFull.long{display:none}")&&html.includes(".homeContextLabelFull.long + .homeContextLabelCompact{display:inline}")&&html.includes("label==='Qualification'?'Qual.'"),"Only long Qualification and Configuration labels may switch to compact mobile forms; ordinary labels must not duplicate");
assert(!html.includes(".homeCourseContextItem small{display:block;color:rgba(218,232,244,.67);font-size:7.5px;line-height:1.1;font-weight:800;letter-spacing:.085em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"),"Home metadata labels must not be truncated with ellipsis");
assert(html.includes("['Type',currentCourseMeta.trainingKind||'—']"),"Home metadata should keep the short TYPE label for mobile visual balance");
assert(html.includes("currentCourseMeta.type==='IP'?'Configuration':'Qualification'"),"Day or Night must be described as a qualification rather than repeating Day as both label and value");
assert(html.includes("showHomeQualification=currentCourseMeta.type!=='EP'||!!epQualificationId(activeProgram)"),"EP phases without a meaningful Day/Night qualification must omit that field");
assert(!html.includes("'<p>Train. Track. Progress.</p>'+"),"The Home hero should avoid redundant slogan copy inside the course context card");
assert(html.includes("orderedFiltered=[...filtered].sort((a,b)=>{const as=a.key===selectedCourse,bs=b.key===selectedCourse")&&html.includes("localeCompare(String(b.course?.name||''),undefined,{sensitivity:'base'})"),"My Courses must keep the selected course first and sort the remaining courses deterministically");
assert(html.includes("myCourseOpen selectedState")&&html.includes("✓ Selected"),"Selected course action must be a solid blue Selected state with a checkmark");
assert(html.includes("My Courses · Option 2 refined tile layout · 0670")&&html.includes(".myCourseStatusBar{display:flex")&&html.includes(".myCourseMeta .courseMetaTile"),"My Courses cards must use the selected Option 2 header-and-tile layout");
assert(html.includes("function courseMetaIconSvg(kind)")&&html.includes("courseMetaIcon"),"My Courses metadata tiles must use the refined icon system");
assert(html.includes("linear-gradient(135deg,#0a6fbd 0%,#1590eb 54%,#0863a9 100%)"),"Selected action must use the approved polished blue gradient");
assert(html.includes("myCourseRoleDivider")&&html.includes("background:rgba(255,255,255,.78)"),"Course role must show the requested white separator between the icon and role text");
assert(html.includes(".myCourseRoleInline.manager")&&html.includes(".myCourseRoleInline.instructor"),"Course Manager and Instructor must have clearly distinct role treatments");
assert(!html.includes("background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10)"),"Course role label must not be enclosed in a capsule frame");
assert(html.includes("countryTile=tile('country','Country',meta.country,showContext?'':'countryWide')"),"Country must pair with Qualification or Configuration when that context field exists");
assert(html.includes("myCourseOpen selectAction"),"Unselected course action must use the white selectable state");
assert(html.includes("myCourseSelectedDivider"),"My Courses must render a blue divider immediately after the selected course when other courses follow");
assert(html.includes("function sortCourseSwitcherRows(rows,selectedKey=currentCourseId)"),"Quick course switcher needs deterministic ordering");
assert(html.includes("View all courses →"),"Quick course switcher must link to the full My Courses screen");
assert(!html.includes("if($('#topCourseSwitch'))$('#topCourseSwitch').onclick=()=>go('courses')"),"Top course control must no longer fake a dropdown by navigating directly to My Courses");
assert(!html.includes("courseSelectedBadge"),"My Courses must not use a separate SELECTED pill");
assert(html.includes("courseStateBadge"),"Course lifecycle status must remain visible");
assert(html.includes(".myCourseCard.selected{border-color:#2b8bde;box-shadow:0 0 0 3px rgba(43,139,222,.18)"),"Selected course card must be identified by its strong blue frame");
assert(html.includes("function courseLifecycleStatus(record)"),"Course lifecycle status must support Upcoming, In progress and Completed");
assert(html.includes("function sectorPlatforms(type)")&&html.includes("sectorDefs.flatMap(x=>sectorPlatforms(x.id))"),"My Courses platform options must come from the architecture platform catalog");
assert(html.includes("function courseSummaryFromMeta(meta)"),"Course summaries must be rebuilt from live architecture metadata");
assert(html.includes("summary:'EP · RC Model · RC Model · New Training · Day · Israel'"),"Built-in summary must preserve separate Phase and Platform slots even when their labels match");
assert(html.includes("myCoursesSectorFilter")&&html.includes("myCoursesPhaseFilter")&&html.includes("myCoursesTrainingFilter")&&html.includes("myCoursesRoleFilter"),"My Courses must expose filters for sector, phase, training type and role");
assert(html.includes("function renderPreservingManagementView(update)"),"Management edit mode needs a view-preserving renderer");
assert(html.includes("overflowAnchor='none'"),"Management Edit must disable native scroll anchoring while the view is rebuilt");
assert(html.includes("anchorSelector='.card,.packageRules,.advancedStepLabel,.personCard,.rosterControls,.trainingStatusStack'"),"Management Edit must preserve a visible content anchor, not only the absolute scrollTop");
assert(html.includes("window.scrollBy(0,delta)"),"Management Edit must compensate for layout-height changes above the viewport");
assert(html.includes("courseTailorEdit'))$('#courseTailorEdit').onclick=()=>{")&&html.includes("renderPreservingManagementView(()=>{state.courseTailorEditing=true"),"Tailor Edit must preserve the current view");
assert(html.includes("advancedArchitectureEdit'))$('#advancedArchitectureEdit').onclick=()=>{")&&html.includes("renderPreservingManagementView(()=>{state.advancedArchitectureEditing=true"),"Advanced Edit must preserve the current view");
assert(html.includes("const toggleRosterManageMode=()=>renderPreservingManagementView")&&html.includes("toggleRosterManage').onclick=toggleRosterManageMode"),"Course Roster Manage must preserve the current view");
assert(!html.includes('rosterCourseStatus')&&!html.includes('rosterTopbarActions'),"Course Roster must not show the course lifecycle badge");
assert(html.includes("const homeCourseLifecycle=courseLifecycleInfo(courseByKey(currentCourseId))")&&html.includes("class=\"courseStateBadge homeCourseStatusBadge '+homeCourseLifecycle.className+'\">")&&html.includes("esc(homeCourseLifecycle.label)"),"Home course hero must show the selected course lifecycle badge using the canonical Upcoming / In progress / Completed status system");
assert(html.includes("personCardOpen")&&html.includes('role="button" tabindex="0" aria-label="Open ')&&html.includes("data-trainee=\"'+t.id+'\"")&&html.includes("data-instructor=\"'+t.id+'\""),"Trainee and instructor roster cards must make the whole card an accessible navigation target");
assert(html.includes('<span class="rosterChevron" aria-hidden="true">›</span>')&&html.includes("if(b.matches?.('.personCard'))b.onkeydown"),"Roster chevrons must be decorative while the full card supports click and keyboard activation");
assert(html.includes("manage?'manageCard':'personCardOpen'")&&html.includes("data-person-edit=\"TRAINEE:")&&html.includes("data-person-edit=\"INSTRUCTOR:"),"Roster Manage mode must keep Edit actions instead of making management cards open profiles");
assert(!html.includes("Restore original Package defaults"),"Bulk Package restore-to-defaults must be removed");
assert(!html.includes("Revert to Package defaults"),"Bulk course revert-to-defaults must be removed");
assert(html.includes(".packageRules>summary>span{font-size:9px;color:#8092a5}"),"Summary helper styling must target only the direct helper span so counts inside titles keep the title font");
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(x=>x.trim());
assert(scripts.length>=2);const appSource=scripts.at(-1).split('const earlyNavTarget=')[0];vm.runInContext(appSource,context,{filename:"index-inline.js"});
const switcherOrder=vm.runInContext("sortCourseSwitcherRows([{key:'done',course:{startsOn:'2025-01-01'},lifecycle:{id:'COMPLETED'}},{key:'future2',course:{startsOn:'2027-03-01'},lifecycle:{id:'UPCOMING'}},{key:'current',course:{startsOn:'2024-01-01'},lifecycle:{id:'COMPLETED'}},{key:'runOld',course:{startsOn:'2026-01-01'},lifecycle:{id:'IN_PROGRESS'}},{key:'runNew',course:{startsOn:'2026-08-01'},lifecycle:{id:'IN_PROGRESS'}},{key:'future1',course:{startsOn:'2027-01-01'},lifecycle:{id:'UPCOMING'}}],'current').map(x=>x.key).join(',')",context);
assert.equal(switcherOrder,"current,runNew,runOld,future1,future2,done","Quick switcher order must be Selected, In Progress newest first, Upcoming soonest first, then Completed");
assert.equal(vm.runInContext("activityDraftMeaningful('evaluation',{date:'2026-10-01',gradeMode:'SUGGESTED',takeoffs:'0',landings:'0'})",context),false,"Evaluation defaults alone must not count as unfinished");
assert.equal(vm.runInContext("activityDraftMeaningful('safety',{date:'2026-10-01'})",context),false,"Safety date alone must not count as unfinished");
assert.equal(vm.runInContext("activityDraftMeaningful('exams',{date:'2026-10-01',pass:'80'})",context),false,"Exam date and default passing grade alone must not count as unfinished");
assert.equal(vm.runInContext("activityDraftMeaningful('planned',{date:'2026-10-01',plannedInstructed:0,plannedSolo:0,cancellations:[],solo:{}})",context),false,"Plan date and zero counts alone must not count as unfinished");
assert.equal(vm.runInContext("activityDraftMeaningful('evaluation',{date:'2026-10-01',trainee:'t1'})",context),true,"Selecting a real Evaluation field must count as unfinished");
assert.equal(vm.runInContext("activityDraftMeaningful('planned',{date:'2026-10-01',plannedInstructed:1,plannedSolo:0,cancellations:[],solo:{}})",context),true,"Entering a real daily plan must count as unfinished");
vm.runInContext("window.__testRealRender=render;render=()=>{$('#content').innerHTML=state.screen==='home'?'':globalBackControl()};go('record');go('evaluation')",context);
assert.equal(vm.runInContext("state.screen",context),"evaluation","Navigation should reach the requested child screen");
assert.equal(vm.runInContext("appNavHistory.join(',')",context),"home,record","Navigation history should keep Home as the root and Record as the immediate parent");
assert.match(elements.get("#content").innerHTML,/id="appBackBtn"/,"Every non-Home screen should render the compact back arrow");
vm.runInContext("goBack()",context);
assert.equal(vm.runInContext("state.screen",context),"record","First back action should return to the previous screen");
vm.runInContext("goBack()",context);
assert.equal(vm.runInContext("state.screen",context),"home","Repeated back navigation must terminate at Home");
assert.equal(vm.runInContext("appNavHistory.length",context),0,"Home must clear the navigation history root");
assert.doesNotMatch(elements.get("#content").innerHTML,/id="appBackBtn"/,"Home must not render a back arrow");
vm.runInContext("go('roster');go('planned');go('record')",context);
assert.equal(vm.runInContext("appNavHistory.join(',')",context),"home","Moving between top-level destinations must not build a sibling back-stack");
vm.runInContext("goBack()",context);
assert.equal(vm.runInContext("state.screen",context),"home","Back from Forms after visiting Roster and Plan must return directly to Home");
vm.runInContext("go('record');go('evaluation')",context);
assert.equal(vm.runInContext("appNavHistory.join(',')",context),"home,record","Child workflows must still keep their immediate top-level parent");
vm.runInContext("goBack()",context);
assert.equal(vm.runInContext("state.screen",context),"record","Back from Evaluation must return to Forms");
vm.runInContext("goBack()",context);
assert.equal(vm.runInContext("state.screen",context),"home","Back from Forms must then return to Home");
vm.runInContext("bind()",context);
elements.get("#menuBtn").onclick?.({preventDefault(){},stopPropagation(){}});
assert.equal(elements.get("#drawer").classList.contains("open"),true,"Hamburger must open the sidebar drawer");
elements.get("#backdrop").onclick?.();
assert.equal(elements.get("#drawer").classList.contains("open"),false,"Backdrop must close the sidebar drawer");
assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext("getNotificationPreferences()",context))),{assignments:true,courseUpdates:true,evaluations:true,checks:true,requiredActions:true},"Notification preference defaults must start enabled");
vm.runInContext("saveNotificationPreferences({assignments:false,courseUpdates:true,evaluations:false,checks:true,requiredActions:true})",context);
assert.equal(vm.runInContext("getNotificationPreferences().assignments",context),false,"Notification preferences must persist user choices");
assert.equal(vm.runInContext("getNotificationPreferences().evaluations",context),false,"Each notification category must be independently configurable");
vm.runInContext("personOverride(currentUserId,{photoData:'data:image/jpeg;base64,profile-test'})",context);
assert.equal(vm.runInContext("allInstructors().find(x=>x.id===currentUserId).photoData",context),"data:image/jpeg;base64,profile-test","Personal profile photo must persist on the current user without editing name or role");
vm.runInContext("render=window.__testRealRender;state.screen='home';render()",context);
assert.match(elements.get("#content").innerHTML,/Welcome back/,"Fresh-session render must land on Home");
vm.runInContext("go('courses')",context);
assert.match(elements.get("#content").innerHTML,/My Courses/);
assert.doesNotMatch(elements.get("#content").innerHTML,/data-go="settings">\+ Create course<\/button>/,"My Courses must not expose a redundant Create course action");
assert.match(elements.get("#content").innerHTML,/Aerostar EP Course/);
assert.match(elements.get("#content").innerHTML,/id="myCoursesStatusFilter"/);
assert.match(elements.get("#content").innerHTML,/<details class="myCoursesFilters" id="myCoursesFilters"/);
assert.match(elements.get("#content").innerHTML,/IN PROGRESS/);
assert.doesNotMatch(elements.get("#content").innerHTML,/courseSelectedBadge|>SELECTED</,"My Courses must not show a separate SELECTED badge");
assert.match(elements.get("#content").innerHTML,/✓ Selected/);
assert.match(elements.get("#content").innerHTML,/class="myCourseStatusBar"/);
assert.match(elements.get("#content").innerHTML,/class="courseMetaTile/);
assert.match(elements.get("#content").innerHTML,/class="myCourseTitle"/);
assert.doesNotMatch(elements.get("#content").innerHTML,/>Select course<\/button>/,"With only one assigned course there should be no alternate course action");
assert.doesNotMatch(elements.get("#content").innerHTML,/>ACTIVE</,"My Courses must not use ACTIVE to mean the selected course");
assert.doesNotMatch(elements.get("#content").innerHTML,/<p>EP · RC Model · [^<]*New Training[^<]*<\/p>/,"My Courses must not use the small dot-separated subtitle");
assert.match(elements.get("#content").innerHTML,/<small>Platform<\/small><b>[^<]+<\/b>/);
assert.match(elements.get("#content").innerHTML,/<small>Training type<\/small><b>New Training<\/b>/);
assert.doesNotMatch(elements.get("#content").innerHTML,/<small>Qualification<\/small>/,"RC Model must not expose Day as a user-facing qualification");
assert.match(elements.get("#content").innerHTML,/<small>Country<\/small><b>Israel<\/b>/);
assert.match(elements.get("#content").innerHTML,/id="myCoursesPlatformFilter"/);
assert.match(elements.get("#content").innerHTML,/id="myCoursesCountryFilter"/);
assert.match(elements.get("#content").innerHTML,/RC Simulator/);
assert.match(elements.get("#content").innerHTML,/RC Model/);
assert.match(elements.get("#content").innerHTML,/Half Scale Trainer/);
assert.match(elements.get("#content").innerHTML,/Aerostar/);
assert.match(elements.get("#content").innerHTML,/Orbiter 3MP/);
assert.match(elements.get("#content").innerHTML,/id="myCoursesSectorFilter"/);
assert.match(elements.get("#content").innerHTML,/id="myCoursesPhaseFilter"/);
assert.match(elements.get("#content").innerHTML,/id="myCoursesTrainingFilter"/);
assert.match(elements.get("#content").innerHTML,/id="myCoursesRoleFilter"/);
assert.equal(vm.runInContext("instructorAssignedCourses(currentUserId).length",context),1);
vm.runInContext("go('home')",context);assert(elements.get("#content").innerHTML.length>1000,"Home must render");
assert.match(elements.get("#content").innerHTML,/homeCourseContext/,"Home must render the labeled course-context strip");
assert.match(elements.get("#content").innerHTML,/homeContextLabelFull[^>]*>Sector<\/span>/);
assert.match(elements.get("#content").innerHTML,/homeContextLabelFull[^>]*>Type<\/span>/);
assert.doesNotMatch(elements.get("#content").innerHTML,/homeMiniStatus/,"Legacy pill metadata must not render on Home");
assert.doesNotMatch(elements.get("#content").innerHTML,/<small>Qualification<\/small>/,"RC Model Home must omit qualification because Day\/Night is not a meaningful RC dimension");
vm.runInContext(`localStorage.setItem('ct-review-courses',JSON.stringify([{id:'course_multi',name:'Aerostar EP Night 2027',code:'EP-NIGHT-27',summary:'EP · Full Scale · Aerostar · Night',startsOn:'2027-01-10',selection:{courseType:'EP',phaseId:'ep_full',platformId:'aerostar',trainingKind:'new',dayNight:'night',country:'israel'},platformId:'aerostar',programId:'ep_full_night_new'}]));updateCourseMembershipForCourse('EP-NIGHT-27',currentUserId,'INSTRUCTOR',{role:'COURSE_MANAGER',removed:false});state.screen='courses';render()`,context);
assert.match(elements.get("#content").innerHTML,/Aerostar EP Night 2027/);
assert.match(elements.get("#content").innerHTML,/<small>Qualification<\/small><b>Night<\/b>/,"Full Scale Night must keep the meaningful qualification tile");
assert.equal(vm.runInContext("instructorAssignedCourses(currentUserId).length",context),2);
assert.match(elements.get("#content").innerHTML,/Select course/,"An unselected assigned course must expose a Select course action");
const quickSwitcherHtml=vm.runInContext("topCourseSwitcherItemsHtml()",context);
assert(quickSwitcherHtml.indexOf("Aerostar EP Course")<quickSwitcherHtml.indexOf("Aerostar EP Night 2027"),"Selected course must appear first in the quick switcher");
assert.match(quickSwitcherHtml,/UPCOMING · Course Manager · Start date/);
assert.match(quickSwitcherHtml,/✓ Selected/);
assert.match(elements.get("#content").innerHTML,/UPCOMING/,"Future courses must display Upcoming independently of the selected course");
vm.runInContext("state.myCoursesStatuses=['UPCOMING'];render()",context);
assert.match(elements.get("#content").innerHTML,/Aerostar EP Night 2027/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Aerostar EP Course/);
vm.runInContext("state.myCoursesStatuses=[];render()",context);
vm.runInContext("state.myCoursesPhases=['Full Scale'];render()",context);
assert.match(elements.get("#content").innerHTML,/Aerostar EP Night 2027/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Aerostar EP Course/);
assert.match(elements.get("#content").innerHTML,/1 of 2 shown/);
vm.runInContext("state.myCoursesPhases=[];render()",context);
vm.runInContext("const labels=getPlatformLabels();labels.rc_model='RC Trainer';savePlatformLabels(labels);render()",context);
assert.match(elements.get("#content").innerHTML,/<small>Platform<\/small><b>RC Trainer<\/b>/,"Edited platform labels must propagate into the My Courses metadata tile immediately");
vm.runInContext("const labels2=getPlatformLabels();delete labels2.rc_model;savePlatformLabels(labels2);render()",context);
assert.equal(vm.runInContext("instructorAssignedCourses('i2').some(x=>courseKey(x)==='EP-NIGHT-27')",context),false);
vm.runInContext("updateCourseMembershipForCourse('EP-NIGHT-27','i2','INSTRUCTOR',{role:'INSTRUCTOR',removed:false})",context);
assert.equal(vm.runInContext("instructorAssignedCourses('i2').some(x=>courseKey(x)==='EP-NIGHT-27')",context),true);
vm.runInContext("switchCourseByKey('EP-NIGHT-27',{render:false});setEvaluations([{id:'multi_eval',flightDate:'2027-01-11',traineeId:'t1',instructorId:'i1',syllabus:'Takeoff',grade:4}])",context);
assert.equal(vm.runInContext("getEvaluations().length",context),1);
vm.runInContext("switchCourseByKey('AEP-26',{render:false,force:true})",context);
assert.equal(vm.runInContext("getEvaluations().some(x=>x.id==='multi_eval')",context),false,"Evaluations must be isolated by course");
vm.runInContext("switchCourseByKey('EP-NIGHT-27',{render:false})",context);
assert.equal(vm.runInContext("getEvaluations().some(x=>x.id==='multi_eval')",context),true,"Course data must return when switching back");
vm.runInContext("switchCourseByKey('AEP-26',{render:false,force:true});go('settings')",context);assert.match(elements.get("#content").innerHTML,/Course Management/);
assert.doesNotMatch(elements.get("#content").innerHTML,/ACTIVE PACKAGE/,"Course Management must not repeat the large Active Package overview");
assert.match(elements.get("#content").innerHTML,/Create a course/);
assert.match(elements.get("#content").innerHTML,/Sector/);
assert.match(elements.get("#content").innerHTML,/Tailor course/);
vm.runInContext("Object.assign(state,{settingsTab:'builder',builderType:'EP',builderProgram:'',builderCountry:'israel',builderStartsOn:'2026-09-30',builderName:'',builderNameManual:false,builderCode:'',builderCodeManual:false});render()",context);
assert.match(elements.get("#content").innerHTML,/Training Package/);
assert.match(elements.get("#content").innerHTML,/Course details/);
assert.match(elements.get("#content").innerHTML,/id="builderCountry"/);
assert.match(elements.get("#content").innerHTML,/id="builderStartsOn"/);
assert.doesNotMatch(elements.get("#content").innerHTML,/wizardMore/,"Course details must stay expanded");
assert.match(elements.get("#content").innerHTML,/data-builder-program="ep_rc_new"/);
assert.doesNotMatch(elements.get("#content").innerHTML,/data-builder-program="ep_full_new_mixed"/,"Create course must not offer a combined Day + Night EP Package");
assert.match(elements.get("#content").innerHTML,/data-builder-program="ep_full_day_new"/);
assert.match(elements.get("#content").innerHTML,/data-builder-program="ep_full_night_new"/);
assert.match(elements.get("#content").innerHTML,/data-builder-program="ep_full_atol"/);
assert.match(elements.get("#content").innerHTML,/data-builder-add-package="EP"/);
assert.doesNotMatch(elements.get("#content").innerHTML,/courseListCard|Open an existing course or continue tailoring its Package/,"Create course must not repeat the saved Courses list");
assert.doesNotMatch(elements.get("#content").innerHTML,/data-builder-platform=/);
assert.doesNotMatch(elements.get("#content").innerHTML,/data-builder-training=/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Source library/);
vm.runInContext("Object.assign(state,{builderType:'IP',builderProgram:''});render()",context);
assert.match(elements.get("#content").innerHTML,/data-builder-program="ip_full_new_gcs_d"/);
assert.match(elements.get("#content").innerHTML,/data-builder-program="ip_full_new_gcs_c"/);
assert.match(elements.get("#content").innerHTML,/GCS-D/);
vm.runInContext("Object.assign(state,{builderType:'TECHNICIAN',builderProgram:''});render()",context);
assert.match(elements.get("#content").innerHTML,/data-builder-program="tech_full_new"/);
assert.match(elements.get("#content").innerHTML,/data-builder-program="tech_full_new_engine_d_gcs_c"/);
assert.match(elements.get("#content").innerHTML,/Engine H \/ GCS-D/);
vm.runInContext("Object.assign(state,{builderType:'IP',builderProgram:'ip_full_new_gcs_d',builderCountry:'cyprus',builderStartsOn:'2027-01-10',builderName:'',builderNameManual:false,builderCode:'',builderCodeManual:false});render()",context);
assert.match(elements.get("#content").innerHTML,/SELECTED PACKAGE/);
assert.match(elements.get("#content").innerHTML,/After creating the course/);
assert.match(elements.get("#content").innerHTML,/Course identity/);
assert.match(elements.get("#content").innerHTML,/suggested automatically/);
assert.match(elements.get("#content").innerHTML,/Cyprus/);
assert.match(elements.get("#content").innerHTML,/10\/01\/2027/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Course name required/);
assert.match(elements.get("#content").innerHTML,/id="builderName" name="name" required value="[^"]+"/);
assert.match(elements.get("#content").innerHTML,/id="builderCode" name="code" value="[^"]+"/);
assert.match(elements.get("#content").innerHTML,/id="courseBuilderSubmit" type="submit" aria-disabled="false">Create course<\/button>/);
assert.match(vm.runInContext("builderSuggestedName('IP','cyprus','ip_full_new_gcs_d','2027-01-10')",context),/Cyprus · 10\/01\/2027/);
assert.equal(vm.runInContext("builderAutoCode('Test Course','EP','2027-01-10')",context),"T-27");
assert.equal(vm.runInContext("uniqueAutoCourseCode('Aerostar External Pilot Course','EP')",context),"AEP-26-2","Automatic course codes must avoid the built-in course collision");
vm.runInContext("state.builderCountry='cyprus';render()",context);
assert.equal(vm.runInContext("state.builderProgram",context),"ip_full_new_gcs_d","Country changes must not clear the selected Package");
vm.runInContext("state.settingsTab='overrides';render()",context);assert.match(elements.get("#content").innerHTML,/Tailor course/);
vm.runInContext("state.screen='roster';state.rosterManage=true;state.rosterType='TRAINEE';state.personEditKey='TRAINEE:t1';render()",context);
assert.match(elements.get("#content").innerHTML,/Add person/);
assert.match(elements.get("#content").innerHTML,/Remove from course/);
vm.runInContext("updateCourseMembership('t1','TRAINEE',{removed:true});state.personEditKey=null;render()",context);
assert.equal(vm.runInContext("courseTrainees().some(x=>x.id==='t1')",context),false);
assert.match(elements.get("#content").innerHTML,/assignExistingForm/,"Removed people should be available to reassign");
vm.runInContext("updateCourseMembership('t1','TRAINEE',{removed:false});Object.assign(currentCourseMeta,{type:'EP',phase:'Full Scale',platformId:'aerostar',trainingKind:'New Training',dayNight:'Day',country:'Israel',programId:'ep_full_day_new'});state.screen='profile';state.selectedTrainee='t1';state.profileTab='activity';render()",context);
assert.match(elements.get("#content").innerHTML,/Experience requirements/);
assert.match(elements.get("#content").innerHTML,/Takeoffs/);
assert.match(elements.get("#content").innerHTML,/Full-stop landings/);
assert.match(elements.get("#content").innerHTML,/0 \/ 3/);
assert.match(elements.get("#content").innerHTML,/Add external \/ historical experience/);
vm.runInContext("saveActivityEvents([{id:'legacy_takeoff',traineeId:'t1',date:'2026-09-29',type:'TAKEOFF',quantity:1,source:'Legacy evaluation',note:'Preflight'}])",context);
assert.equal(vm.runInContext("activityTotalsFor('t1').ep_full_day_takeoffs",context),1,"Legacy Full Scale takeoffs must map into the typed Day counter");
vm.runInContext("saveActivityEvents([])",context);
vm.runInContext("state.screen='evaluation';state.editingEval=null;render()",context);
assert.match(elements.get("#content").innerHTML,/Experience performed during this flight/);
assert.match(elements.get("#content").innerHTML,/name="takeoffs"/);
assert.match(elements.get("#content").innerHTML,/name="landings"/);
assert.match(elements.get("#content").innerHTML,/Full-stop landings performed/);
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(evaluationGradingSettings())",context)),{min:1,max:5,benchmark:4});
vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('ep_full_day_new',{program:{gradingMin:2,gradingBenchmark:3.5,gradingMax:6}});render()",context);
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(evaluationGradingSettings())",context)),{min:2,max:6,benchmark:3.5});
assert.equal(vm.runInContext("evaluationGradeOptions().join(',')",context),"2,3,4,5,6");
assert.match(elements.get("#content").innerHTML,/Benchmark 3\.5 · Scale 2–6/);
vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('ep_full_day_new',{});render()",context);
vm.runInContext("state.screen='settings';state.settingsTab='overrides';render()",context);
assert.match(elements.get("#content").innerHTML,/Package settings for this course/);
assert.match(elements.get("#content").innerHTML,/name="course_package_name"/);
assert.match(elements.get("#content").innerHTML,/Course status/);
assert.match(elements.get("#content").innerHTML,/name="course_lifecycle"/);
assert.match(elements.get("#content").innerHTML,/name="course_phase"/);
assert.match(elements.get("#content").innerHTML,/name="course_platform"/);
assert.match(elements.get("#content").innerHTML,/name="course_training"/);
assert.match(elements.get("#content").innerHTML,/courseSyllabusTable/);
assert.match(elements.get("#content").innerHTML,/courseSyllabusDragHandle/);
assert.doesNotMatch(elements.get("#content").innerHTML,/name="order_full_preflight"[^>]*type="number"/,"Tailor order must use drag, not manual numeric entry");
assert.match(elements.get("#content").innerHTML,/name="syll_name_full_preflight"/);
assert.match(elements.get("#content").innerHTML,/name="counter_name_ep_full_day_takeoffs"/);
assert.match(elements.get("#content").innerHTML,/name="criterion_name_flight_path_control"/);
assert.match(elements.get("#content").innerHTML,/name="course_grade_min"/);
assert.match(elements.get("#content").innerHTML,/name="course_grade_benchmark"/);
assert.match(elements.get("#content").innerHTML,/name="course_grade_max"/);
assert.match(elements.get("#content").innerHTML,/Grading settings/);
assert.match(elements.get("#content").innerHTML,/packageEditorItem/);
assert.match(elements.get("#content").innerHTML,/data-course-add-open="criteria"/);
assert.match(elements.get("#content").innerHTML,/id="courseTailorEdit"/);
assert.match(elements.get("#content").innerHTML,/courseTailorEditFieldset" disabled/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Save changes<\/button>/,"Tailor must not show Save changes before Edit is selected");
assert.doesNotMatch(elements.get("#content").innerHTML,/Done editing/,"Tailor must use one Save changes action only");
assert.doesNotMatch(elements.get("#content").innerHTML,/resetCourseOverrides|Revert to Package defaults/,"Tailor must not expose a bulk reset-to-defaults action");
assert.match(elements.get("#content").innerHTML,/id="tailorCourseSelect"/,"Tailor must allow selecting an assigned course");
vm.runInContext("state.courseTailorEditing=true;render()",context);
const editingTailorHtml=elements.get("#content").innerHTML;
assert.match(editingTailorHtml,/courseTailorEditing/);
assert.match(editingTailorHtml,/courseTailorEditFieldset" >/);
assert.match(editingTailorHtml,/>Save changes<\/button>/);
assert.match(editingTailorHtml,/courseTailorDone|Done editing/);
assert.doesNotMatch(editingTailorHtml,/resetCourseOverrides|Revert to Package defaults/,"Tailor edit mode must keep only Save changes as the primary action");
assert.match(editingTailorHtml,/data-rule-table="criteria"/);
assert.match(editingTailorHtml,/data-rule-table="emergencies"/);
assert.match(editingTailorHtml,/data-rule-table="counters"/,"Full Scale course has experience requirements and should render their table");
assert.match(editingTailorHtml,/data-rule-table="exams"/,"Full Scale course has exams and should render their table");
assert.doesNotMatch(editingTailorHtml,/data-rule-table="progression"/,"Zero progression gates must not render an empty table header");
assert.doesNotMatch(editingTailorHtml,/Syllabi \/ practical tasks \([^)]*active\)/,"Syllabi count must match the other category summaries");
vm.runInContext("state.courseTailorEditing=false;render()",context);
assert.match(elements.get("#content").innerHTML,/data-course-add="syllabi"/);
assert.match(elements.get("#content").innerHTML,/data-course-add="counters"/);
assert.match(elements.get("#content").innerHTML,/data-course-add="criteria"/);
assert.match(elements.get("#content").innerHTML,/data-course-add="exams"/);
assert.match(elements.get("#content").innerHTML,/data-course-add="progression"/);
assert.match(elements.get("#content").innerHTML,/data-course-add="emergencies"/);
vm.runInContext("FLYMPUS_TRAINING.saveOverrides(currentCourseMeta.courseCode||currentCourseId,{program:{gradingMin:2,gradingBenchmark:3.5,gradingMax:6},custom:{syllabi:[{id:'ui_course_syll',name:'Course Test Syllabus',order:999,minimum:1,mode:'INSTRUCTED',instructorRequired:true,track:'day'}],counters:[{id:'ui_course_counter',name:'Course Test Counter',minimum:2,unit:'count',track:'shared',kind:'CUSTOM'}],criteria:[{id:'ui_course_criterion',name:'Course Test Criterion',weight:10}],exams:[{id:'ui_course_exam',name:'Course Test Exam',pass:80}],emergencies:[{id:'ui_course_emergency',name:'Course Test Emergency',category:'General / Operational'}]},emergencyRequirementIds:['ui_course_emergency']});render()",context);
assert.match(elements.get("#content").innerHTML,/Course Test Syllabus/);
assert.match(elements.get("#content").innerHTML,/Course Test Counter/);
assert.match(elements.get("#content").innerHTML,/COURSE ONLY/);
vm.runInContext("state.courseTailorEditing=true;render()",context);
assert.doesNotMatch(elements.get("#content").innerHTML,/resetCourseOverrides|Revert to Package defaults/);
vm.runInContext("state.courseTailorEditing=false;state.screen='evaluation';render()",context);
assert.match(elements.get("#content").innerHTML,/Course Test Syllabus/,"Course-only syllabus must flow into Evaluation");
assert.match(elements.get("#content").innerHTML,/Course Test Criterion/,"Course-only criterion must flow into Evaluation");
assert.match(elements.get("#content").innerHTML,/Course Test Emergency/,"Course-only emergency must flow into Evaluation");
assert.match(elements.get("#content").innerHTML,/Benchmark 3\.5 · Scale 2–6/,"Tailor grading override must flow into Evaluation");
vm.runInContext("FLYMPUS_TRAINING.saveOverrides(currentCourseMeta.courseCode||currentCourseId,{});state.screen='settings';state.settingsTab='catalog';state.typeWorkspace='EP';state.packageFocusId=null;state.packageEditId=null;render()",context);
const advancedHtml=elements.get("#content").innerHTML;
assert.match(advancedHtml,/Advanced/);
assert.doesNotMatch(advancedHtml,/data-settings-tab="packages"/,"Packages must not have a separate Settings tab");
assert.match(advancedHtml,/Define sectors/);
assert.match(advancedHtml,/Select sector to edit/);
assert.match(advancedHtml,/>Architecture<\/b>/);
assert.doesNotMatch(advancedHtml,/Phases · EP|Platforms · EP|EP architecture/,'Selected sector must not be repeated in Advanced headings');
assert.match(advancedHtml,/class="toolbar packageSaveBar advancedArchitectureActions\s*"/,"Advanced Edit must use the same sticky action bar behavior as Tailor");
assert.match(advancedHtml,/id="advancedArchitectureEdit">Edit<\/button>/);
assert.doesNotMatch(advancedHtml,/advancedEditBar/,"Advanced must not use a separate top Edit panel");
assert.match(advancedHtml,/advancedEditFieldset" disabled/,"Advanced architecture must be view-only until Edit is pressed");
assert.doesNotMatch(advancedHtml,/Save architecture/);
assert.doesNotMatch(advancedHtml,/Reset architecture labels/);
assert.match(advancedHtml,/Final step · create and manage reusable Packages/);
assert.match(advancedHtml,/data-cfg-add-open="courseTypes"/);
assert.match(advancedHtml,/class="toolbar cfgAddForm cfgAddPanel" data-kind="courseTypes" hidden/);
assert.match(advancedHtml,/data-cfg-add-cancel="courseTypes"/);
assert.doesNotMatch(advancedHtml,/>Add course types<\/input>/);
assert.match(advancedHtml,/Packages/);
assert.match(advancedHtml,/Choose Edit to create, change or delete Packages/);
assert.doesNotMatch(advancedHtml,/Open Packages/);
assert.doesNotMatch(advancedHtml,/data-open-packages-page=/);
assert.doesNotMatch(advancedHtml,/data-package-assign-open="EP"/,"Create Package must stay hidden before Advanced Edit");
assert.doesNotMatch(advancedHtml,/data-package-assign-panel="EP"/,"Package creation form must not exist before Advanced Edit");
vm.runInContext("state.advancedArchitectureEditing=true;render()",context);
const advancedEditingHtml=elements.get("#content").innerHTML;
assert.match(advancedEditingHtml,/class="toolbar packageSaveBar advancedArchitectureActions\s+/);
assert.match(advancedEditingHtml,/id="cfgSaveCatalogs">Save changes<\/button>/);
assert.match(advancedEditingHtml,/Edit architecture/);
assert.doesNotMatch(advancedEditingHtml,/advancedEditFieldset" disabled/,"Edit must unlock Advanced architecture controls");
assert.match(advancedEditingHtml,/id="typeWorkspace" disabled/,"Sector selection stays fixed while editing");
assert.match(advancedEditingHtml,/data-package-assign-open="EP"/,"Create Package appears only after Advanced Edit");
assert.match(advancedEditingHtml,/data-package-assign-panel="EP" hidden/);
assert.match(advancedEditingHtml,/globalPackageForm[\s\S]*?<fieldset class="packageEditFieldset" >/,"Advanced Edit must also unlock Packages");
assert.doesNotMatch(advancedEditingHtml,/Save Package|Save & Done|Done editing/,"Configuration editing must use one Save changes action");
vm.runInContext("state.advancedArchitectureEditing=true;state.packageCreateOpen='EP';render()",context);
const advancedCreateOpenHtml=elements.get("#content").innerHTML;
assert.match(advancedCreateOpenHtml,/data-package-assign-open="EP" hidden/);
assert.match(advancedCreateOpenHtml,/data-package-assign-panel="EP" >/);
assert.match(advancedCreateOpenHtml,/id="sectorPackageForm"/);
assert.match(advancedCreateOpenHtml,/Create & edit Package/);
vm.runInContext("state.packageCreateOpen=null;state.advancedArchitectureEditing=false;render()",context);
assert.match(advancedCreateOpenHtml,/value="EP ·/,"A suggested Package name should be prefilled when Package creation is opened");
assert.match(advancedHtml,/Qualifications/);
assert.match(advancedHtml,/Shahak/,"Platform rename must be visible from the source architecture");
assert.doesNotMatch(advancedHtml,/class="pill gray">rc_model<\/span>/,"Internal platform IDs must not be displayed beside platform names");
assert.match(advancedHtml,/data-kind="qualifications"/);
assert.match(advancedHtml,/value="Day"/);
assert.match(advancedHtml,/value="Night"/);
assert.match(advancedHtml,/value="ATOL"/);
assert.doesNotMatch(advancedHtml,/Package configuration · Operating track|Mixed \/ Day\+Night/,"EP architecture must use Qualifications instead of the old track context");
assert.match(advancedHtml,/id="cfgAddPlatform"/);
assert.match(advancedHtml,/globalPackageForm/,"Advanced must contain the full Package editor");
assert.match(advancedHtml,/EP ATOL Qualification · Full Scale · Aerostar/,"ATOL must be a standalone EP Full Scale Package, not a Day\/Night track");
assert.match(advancedHtml,/Qualification/,"EP Package paths must expose Qualification as the relevant dimension");
assert.match(advancedHtml,/data-global-add="syllabi"/);
assert(advancedHtml.indexOf("Course types")<advancedHtml.indexOf("Select sector to edit"),"Course types must render before sector selection");
assert(advancedHtml.indexOf("Select sector to edit")<advancedHtml.indexOf(">Architecture</b>"),"Architecture follows sector selection");
assert(advancedHtml.indexOf(">Architecture</b>")<advancedHtml.indexOf("Final step · create and manage reusable Packages"),"Packages must be the final Advanced step");

vm.runInContext("const cp=getCustomPlatforms();cp.EP=[{id:'platform_test',name:'Test Platform'}];saveCustomPlatforms(cp);const labels3=getPlatformLabels();labels3.platform_test='Test Platform';savePlatformLabels(labels3);render()",context);
assert.match(elements.get("#content").innerHTML,/Test Platform/);
assert.match(elements.get("#content").innerHTML,/data-platform-remove="platform_test"/);
assert.match(elements.get("#content").innerHTML,/value="platform_test"/);

vm.runInContext("FLYMPUS_TRAINING.saveCustomPackage('EP',{id:'ui_custom_package',name:'EP · UI Custom Package',phaseId:'ep_full',platformId:'aerostar',trainingKind:'new',dayNight:'day',gradingMin:1,gradingBenchmark:4,gradingMax:5,theory:[],syllabi:[],criteria:[],experienceCounters:[],exams:[],progression:[],emergencyRequirementIds:[],courseEmergencies:[]});state.packageFocusId=null;render()",context);
const collapsedPackagesHtml=elements.get("#content").innerHTML;
assert.match(collapsedPackagesHtml,/EP · UI Custom Package/);
assert.match(collapsedPackagesHtml,/packageEditorShell/);
assert.doesNotMatch(collapsedPackagesHtml,/packageEditorShell" open/,"Advanced Package list must start collapsed");
assert.doesNotMatch(collapsedPackagesHtml,/packageRules syllabiRules" open/,"Syllabi must start collapsed");

vm.runInContext("state.packageFocusId='ui_custom_package';render()",context);
const packagesHtml=elements.get("#content").innerHTML;
assert.match(packagesHtml,/Training Packages/);
assert.match(packagesHtml,/id="packageTrainingFilter"/,"Training Packages must provide a category filter when multiple categories exist");
assert.match(packagesHtml,/Refreshment/);
assert.match(packagesHtml,/Qualification/);
assert.match(packagesHtml,/Return to Currency/);
assert.doesNotMatch(packagesHtml,/EP Training Packages|IP Training Packages|TECHNICIAN Training Packages/,'Training Packages heading must not repeat the selected sector');
assert.match(packagesHtml,/globalPackageForm/);
assert.match(packagesHtml,/Syllabi \/ practical tasks/);
assert.match(packagesHtml,/packageSyllabusTable/);
assert.match(packagesHtml,/Order \/ Move/);
assert.match(packagesHtml,/Series \/ Syllabus/);
assert.match(packagesHtml,/Instructor Presence/);
assert.match(packagesHtml,/syllabusDragHandle/);
assert.doesNotMatch(packagesHtml,/name="g_syll_order_[^"]+" type="number"/,"Order must not be manually editable");
assert.match(packagesHtml,/type="hidden" name="g_syll_order_/);
assert.doesNotMatch(packagesHtml,/data-package-edit-toggle=/,"Package editing is controlled by the global Advanced Edit action");
assert.doesNotMatch(packagesHtml,/data-delete-package="ui_custom_package"/,"Delete Package must stay hidden until Advanced Edit is active");
vm.runInContext("state.packageCategoryFilters=['refreshment'];state.packageFocusId=null;render()",context);
const refreshmentFilteredHtml=elements.get("#content").innerHTML;
assert.match(refreshmentFilteredHtml,/1 of \d+ packages/);
assert.match(refreshmentFilteredHtml,/EP Refreshment · Full Scale · Aerostar/);
assert.doesNotMatch(refreshmentFilteredHtml,/EP Return to Currency · Full Scale · Aerostar/);
assert.doesNotMatch(refreshmentFilteredHtml,/EP ATOL Qualification · Full Scale · Aerostar/);
vm.runInContext("state.packageCategoryFilters=[];state.packageFocusId='ui_custom_package';render()",context);
assert.match(packagesHtml,/total planned minimum/);
assert.doesNotMatch(packagesHtml,/packageRules syllabiRules"[^>]* open/,"Focused Package may open, but Syllabi must remain collapsed until requested");
vm.runInContext("state.packageAddFlow='ui_custom_package:syllabi';render()",context);
const continuousSyllabusHtml=elements.get("#content").innerHTML;
assert.match(continuousSyllabusHtml,/packageRules syllabiRules" data-package-rule="syllabi" data-package-id="ui_custom_package" open/);
assert.match(continuousSyllabusHtml,/data-global-add-open="syllabi" hidden/);
assert.match(continuousSyllabusHtml,/data-global-add-panel="syllabi" >/);
assert.match(continuousSyllabusHtml,/Done adding/);
assert.match(continuousSyllabusHtml,/row stays open for the next syllabus/);
vm.runInContext("state.packageAddFlow=null;render()",context);
assert.match(packagesHtml,/Assessment criteria/);
assert.match(packagesHtml,/Grading settings/);
assert.match(packagesHtml,/name="g_grade_min"/);
assert.match(packagesHtml,/name="g_grade_benchmark"/);
assert.match(packagesHtml,/name="g_grade_max"/);
assert.match(packagesHtml,/Emergency requirements/);
assert.match(packagesHtml,/data-global-add-open="syllabi"/);
assert.match(packagesHtml,/data-global-add-panel="syllabi" hidden/);
assert.match(packagesHtml,/data-global-add-cancel="syllabi"/);
assert.match(packagesHtml,/data-global-add="criteria"/);
assert.match(packagesHtml,/data-global-add="emergencies"/);
assert.match(packagesHtml,/data-global-add="counters"/);
assert.match(packagesHtml,/data-global-add="exams"/);
assert.match(packagesHtml,/data-global-add="progression"/);
assert.match(packagesHtml,/packageFocused/);
assert.doesNotMatch(packagesHtml,/EDITED DEFAULT/);
assert.doesNotMatch(packagesHtml,/>DEFAULT<\/span>/);
assert.doesNotMatch(packagesHtml,/>EP<\/span>/);
assert.doesNotMatch(packagesHtml,/packageEditing/,"Focused Package is view mode until Edit is selected");

vm.runInContext("state.advancedArchitectureEditing=true;render()",context);
const editingPackageHtml=elements.get("#content").innerHTML;
assert.match(editingPackageHtml,/packageEditing/);
assert.doesNotMatch(editingPackageHtml,/Done editing|Save Package|Save & Done/,"Advanced must use the single sticky Save changes action");
assert.match(editingPackageHtml,/Delete Package/);
assert.doesNotMatch(editingPackageHtml,/Restore original Package defaults|data-reset-global-package/,"Package edit mode must not expose a destructive bulk restore-to-defaults action");
assert.match(editingPackageHtml,/data-delete-package="ui_custom_package"/,"Delete Package must appear while Advanced Edit is active");
assert.match(editingPackageHtml,/data-global-package-id="ui_custom_package"[\s\S]*?<fieldset class="packageEditFieldset" >/,"Advanced Edit must unlock Package editors");
const customPackageStart=editingPackageHtml.indexOf('data-global-package-id="ui_custom_package"');
const customPackageEnd=editingPackageHtml.indexOf('</form>',customPackageStart);
const customEditingPackageHtml=editingPackageHtml.slice(customPackageStart,customPackageEnd>customPackageStart?customPackageEnd:editingPackageHtml.length);
assert.doesNotMatch(customEditingPackageHtml,/data-rule-table="criteria"/,"Empty criteria must not render a header-only table");
assert.match(customEditingPackageHtml,/data-rule-table="emergencies"/,"Platform emergency choices remain visible even when none are required");
assert.doesNotMatch(customEditingPackageHtml,/data-rule-table="counters"/,"Empty experience requirements must not render a header-only table");
assert.doesNotMatch(customEditingPackageHtml,/data-rule-table="exams"/,"Empty exams must not render a header-only table");
assert.doesNotMatch(customEditingPackageHtml,/data-rule-table="progression"/,"Empty progression gates must not render a header-only table");

vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('ep_full_day_new',{syllabi:{full_intro:{applicable:false}}});state.packageFocusId='ep_full_day_new';state.advancedArchitectureEditing=true;render()",context);
const excludedSyllabusHtml=elements.get("#content").innerHTML;
assert.match(excludedSyllabusHtml,/Excluded syllabi \(<span data-excluded-syllabus-count>1<\/span>\)/);
assert.match(excludedSyllabusHtml,/data-restore-syllabus="full_intro"/);
assert.match(excludedSyllabusHtml,/data-syllabus-row="full_intro"[\s\S]*?syllabusExcludedRow|syllabusExcludedRow[\s\S]*?data-syllabus-row="full_intro"/);
assert.match(excludedSyllabusHtml,/data-syllabus-row="full_positions_a"[\s\S]*?<span class="syllabusOrderNumber">2<\/span>/,"Active syllabus order must close the gap when Introduction is excluded");
assert.match(excludedSyllabusHtml,/Only included syllabi are numbered/);

vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('ep_full_day_new',{});state.packageFocusId='ui_custom_package';state.advancedArchitectureEditing=true;render()",context);
vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('ep_full_refresh',{custom:{syllabi:[{id:'ui_pkg_syll',name:'Reusable Package Syllabus',order:99,minimum:1,mode:'INSTRUCTED',instructorRequired:true,track:'day'}],criteria:[{id:'ui_pkg_criterion',name:'Reusable Package Criterion',weight:10}],emergencies:[{id:'ui_pkg_emergency',name:'Reusable Package Emergency',category:'General / Operational'}]},emergencyRequirementIds:['ui_pkg_emergency']});render()",context);
assert.match(elements.get("#content").innerHTML,/Reusable Package Syllabus/);
assert.match(elements.get("#content").innerHTML,/Reusable Package Criterion/);
assert.match(elements.get("#content").innerHTML,/Reusable Package Emergency/);
assert.match(elements.get("#content").innerHTML,/PACKAGE CUSTOM/);

vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('ep_full_refresh',{});FLYMPUS_TRAINING.removeCustomPackage('EP','ui_custom_package');state.settingsTab='catalog';state.typeWorkspace='IP';state.packageFocusId=null;state.packageEditId=null;render()",context);
assert.match(elements.get("#content").innerHTML,/Configurations \/ qualifications/);
assert.match(elements.get("#content").innerHTML,/Training Packages/);
assert.doesNotMatch(elements.get("#content").innerHTML,/IP Training Packages/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Phases · IP|Platforms · IP|IP architecture/);
assert.match(elements.get("#content").innerHTML,/globalPackageForm/);

vm.runInContext("state.typeWorkspace='TECHNICIAN';state.packageFocusId=null;state.packageEditId=null;render()",context);
assert.match(elements.get("#content").innerHTML,/Systems \/ qualifications/);
assert.match(elements.get("#content").innerHTML,/Engine H \/ GCS-D/);
assert.match(elements.get("#content").innerHTML,/Training Packages/);
assert.doesNotMatch(elements.get("#content").innerHTML,/TECHNICIAN Training Packages/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Phases · TECHNICIAN|Platforms · TECHNICIAN|TECHNICIAN architecture/);
vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('tech_full_new',{program:{name:'Global Technician Package'}});render()",context);
assert.match(elements.get("#content").innerHTML,/Global Technician Package/);
assert.doesNotMatch(elements.get("#content").innerHTML,/EDITED DEFAULT/,"Package state badges were intentionally removed");
vm.runInContext("FLYMPUS_TRAINING.saveGlobalOverrides('tech_full_new',{})",context);
vm.runInContext("Object.assign(currentCourseMeta,{type:'TECHNICIAN',phase:'Full Scale',platformId:'aerostar',trainingKind:'New Training',dayNight:'Mixed \/ Day+Night',country:'Israel',programId:'tech_full_new'});state.screen='profile';state.profileTab='activity';render()",context);
assert.match(elements.get("#content").innerHTML,/Practical experience/);
assert.match(elements.get("#content").innerHTML,/Record practical task/);
assert.match(elements.get("#content").innerHTML,/Engine Installation \/ Removal/);
assert.match(elements.get("#content").innerHTML,/name="quantity" type="number" min="1" step="1"/);
console.log(JSON.stringify({ok:true,myCourses:true,multiCourse:true,courseIsolation:true,instructorAssignments:true,home:true,settings:true,directPackageCourseCreation:true,inlineCourseDetails:true,suggestedCourseIdentity:true,builderAddPackageShortcut:true,createCourseValidation:true,uniqueCourseCode:true,trainingPackages:true,packagesInsideAdvanced:true,advancedPackagesLast:true,sectorPackageAssignment:true,suggestedPackageName:true,fullPackageEditor:true,packageGradingSettings:true,alignedTailorEditor:true,tailorExplicitEditMode:true,tailorGradingOverride:true,tailorDragSyllabus:true,dynamicEvaluationGradeScale:true,collapsedPackageEditor:true,compactSyllabusTable:true,dragSyllabusOrdering:true,smoothDragAnimation:true,compactAddRows:true,continuousSyllabusEntry:true,compactCatalogAdd:true,activeOrderReindex:true,excludedSyllabusRestore:true,packageEditMode:true,packageDelete:true,editOnlyPackageDelete:true,globalPackageCustomItems:true,globalPackagePath:true,globalPackageDefaults:true,coursePackageOverride:true,courseOnlyItems:true,professionContext:true,advancedOrder:true,customPlatforms:true,overrides:true,rosterMembership:true,experienceUx:true,technicianExperience:true}));


/* Settings simplification and full appearance behavior */
assert(html.includes('>עברית</option>'),"Hebrew language choice must display its native name even while the UI is English");
assert(!html.includes('<b>Interface density</b>'),"Interface density row must be removed");
assert(!html.includes('<h3>Accessibility</h3>'),"Accessibility card must be removed entirely");
assert(html.includes("function appSettingsSectionIcon(kind)")&&html.includes("sound:'<path")&&html.includes("appearance:'<circle"),
  "Settings categories must use topic-specific semantic icons");
assert(html.includes("html.flympusLargeText body{font-size:17px!important}")&&html.includes("html.flympusLargeText .dataTable td"),
  "Large text must scale body copy, controls and table content rather than only titles");
assert(html.includes("Complete dark theme audit")&&html.includes("html[data-flympus-theme=\"dark\"] .packageSyllabusTable")&&html.includes("html[data-flympus-theme=\"dark\"] .pveExecutionOverview>div"),
  "Dark mode must cover reusable workflow surfaces across Course Management and daily operations");
assert(html.includes('id="flympus-theme-bootstrap"'),
  "The authoritative theme and text controller must run before first paint");

assert(html.includes("Dark completeness pass · settings + workflow surfaces")&&html.includes('html[data-flympus-theme="dark"] .myCourseCard')&&html.includes('html[data-flympus-theme="dark"] .wizardCreateBar'),
  "Dark-mode completion pass must cover course cards and sticky workflow surfaces that previously stayed light");


/* Final Settings QA coverage */
assert(html.includes("Final Settings QA pass · haptics, large text and dark accents"),
  "Final Settings QA layer must remain present");
assert(html.includes("html.flympusLargeText p{font-size:14px!important")&&html.includes("html.flympusLargeText small{font-size:13px!important"),
  "Large text must cover ordinary paragraph and helper text across the site");
assert(html.includes('html[data-flympus-theme="dark"] .pushStatus.off')&&html.includes('html[data-flympus-theme="dark"] .btn.danger'),
  "Dark mode must include notification states and destructive controls instead of leaving light islands");


/* Settings reset actions must stay unambiguous. */
assert(!html.includes('id="clearRememberedUi"'),
  "Remembered interface state reset must not be exposed in Settings");
assert(html.includes('id="resetAppPreferences">Reset settings to defaults</button>'),
  "Preferences reset must clearly say that it restores defaults");


/* Settings must not expose destructive local data deletion. */
assert(!html.includes('id="resetLocalReviewDataFromSettings"'),
  "Destructive local review reset must not be exposed in Settings");
assert(html.includes("Restore this device's app preferences without changing course or training data."),
  "Data & Device copy must make clear that resetting preferences does not touch training data");

/* Device-relevant sound and haptic settings */
assert(html.includes("const hapticsRelevant=isFlympusIOSHapticTarget()||(Number(navigator.maxTouchPoints||0)>0&&!!window.matchMedia?.('(hover:none) and (pointer:coarse)')?.matches)"),
  "Settings must only expose haptic controls on touch/coarse-pointer devices or iOS haptic targets");
assert(html.includes("(hapticsRelevant?appPreferenceSwitch('haptics','Haptic feedback'"),
  "Desktop Settings must omit the Haptic feedback row while retaining it on relevant mobile devices");
assert(html.includes("const feedbackTitle=hapticsRelevant?'Sounds & Haptics':'Sounds'"),
  "Desktop Settings must label the section Sounds when haptics are not relevant");

/* iOS/PWA foreground visual lifecycle */
const themeController=fs.readFileSync('theme-controller.js','utf8');
assert(themeController.includes("const RESOLVED_KEY='flympus-last-resolved-theme'")&&
  themeController.includes('function reassertStableTheme()'),
  "System theme must have one durable resolved value and one resume path");
assert(themeController.includes("document.addEventListener('visibilitychange'")&&
  themeController.includes("window.addEventListener('pageshow'")&&
  !themeController.includes('setTimeout('),
  "Resume must reassert the stable theme without timeout-driven competing writers");
assert(!themeController.includes("addEventListener('change'")&&themeController.includes("const SYSTEM_KEY='flympus-system-resolved-theme'"),
  "System has a persisted resolution and must not accept delayed media-query transitions");
assert(themeController.includes("background=dark?'#07131f':'#f4f8fc'"),
  "The pre-paint canvas must match the final CSS canvas");
assert(html.includes("snap.visualVersion===5")&&html.includes("snapFresh=snapAge<=15*60*1000")&&
  html.includes("snap.resolvedTheme===currentResolvedTheme")&&html.includes("viewportCompatible"),
  "Reload snapshots must be fresh, viewport-compatible and visually compatible before they are painted");
assert(html.includes("visualVersion:5")&&html.includes("resolvedTheme:resolvedTheme==='dark'?'dark':'light'")&&
  html.includes("largerText:!!root?.classList.contains('flympusLargeText')")&&html.includes("localDay,"),
  "Saved reload snapshots must include the visual preference signature and local-day key used for first-paint validation");
assert(html.indexOf('<meta name="theme-color" content="#f4f8fc" />')<html.indexOf('id="flympus-theme-bootstrap"'),
  "Metadata must exist before the embedded theme authority executes");
assert(html.includes('<meta name="color-scheme" content="light" />')&&
  themeController.includes("document.querySelector('meta[name=\"color-scheme\"]')?.setAttribute('content',resolved)"),
  "Native controls follow the exact committed resolution");

assert(html.includes("function flympusContinuitySnapshotHtml(content)")&&
  html.includes("clone.querySelectorAll?.('.modal.open')")&&
  html.includes("clone.querySelectorAll?.('.multiFilterMenu,.datePickerPanel')"),
  "Continuity snapshots must strip transient dialogs, menus and picker overlays that would otherwise flash on resume");
assert(html.includes("topHidden:scrollY>64&&")&&html.includes("if(snap.topHidden&&y>64)"),
  "Snapshots retain auto-hide on all devices without hiding chrome at the page top");
assert(!html.includes("touchChromeStable?false:!!hidden")&&
  html.includes("const flympusTouchPullMode=()=>flympusStandaloneMode();")&&
  html.includes("if(!customPull||top>2)return;")&&html.includes("pullStandaloneGesture=true"),
  "Touch auto-hide stays enabled while custom pull-to-refresh is isolated to an explicit top-start gesture in the installed PWA");
assert(html.includes("snap.localDay===localDay"),
  "A snapshot from a previous local day must never flash before today's plan renders");



/* Navigation audio must never escape its initiating physical gesture. */
assert(html.includes("window.__FLYMPUS_CLAIM_NAV_SOUND_GESTURE__")&&html.includes("if(!e||e.isTrusted===false)return false"),
  "Navigation sound must require a trusted physical event");
assert(html.includes("if(!ctx||!buffer||ctx.state!=='running')return false")&&html.includes("cancelFlympusPendingNavSources()"),
  "Navigation WebAudio must never queue while suspended and must be cancellable at lifecycle boundaries");
assert(html.includes("playFlympusBottomNavSound(e);"),
  "Bottom-nav binding must pass the originating event into the audible path");


/* Visual switches must not animate during programmatic state hydration. */
assert(html.includes(".notificationPreferences:not(.notificationPrefsInteractive) .prefSwitch i:after{transition:none!important}"),
  "Notification preference switches must suppress motion until their stored state is synced");
assert(html.includes("root?.classList.remove('notificationPrefsInteractive')")&&
  html.includes("root?.classList.add('notificationPrefsInteractive')"),
  "Notification preference switches must arm motion only after programmatic sync");
assert(html.includes("aria-checked=\"'+(checked?'true':'false')+'\""),
  "App Settings switches must render accessibility state together with their checked state");
assert(html.includes("el.setAttribute('aria-checked',el.checked?'true':'false')"),
  "Visual switches must keep aria state aligned after real user changes");
