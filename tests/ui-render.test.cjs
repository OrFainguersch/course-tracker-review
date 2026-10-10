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
const context={window:{},document,localStorage:storage(),sessionStorage:storage(),console,confirm:()=>true,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:fn=>0,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>0},history:{},getComputedStyle:()=>({getPropertyValue:()=>''}),NodeFilter:{SHOW_TEXT:4},Date,Math,JSON,Number,String,Array,Object,Map,Set,URLSearchParams,FormData:class{},Blob:class{},URL:{createObjectURL(){return""},revokeObjectURL(){}},location:{search:''},navigator:{},FLYMPUS_AUTH:{can:()=>true,role:()=>'owner',isAdmin:()=>true,profile:{email:'or@example.test'},currentUser:{email:'or@example.test'},mountUserManagementPage(){}}};
context.window=context;vm.createContext(context);
for(const file of ["assets/fleet-model.js","assets/fleet-views.js","assets/ep-catalog.js","assets/aerostar-platform.js","assets/ip-catalog.js","assets/technician-catalog.js","assets/training-core.js","assets/ep-lessons-screening.js","assets/ep-lessons-rc-1.js","assets/ep-lessons-rc-2.js","assets/ep-lessons-half.js","assets/ep-lessons-full-day-a.js","assets/ep-lessons-full-day-b.js","assets/ep-lessons-night.js"]){vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file})}
vm.runInContext(fs.readFileSync("assets/evaluation-voice.js","utf8"),context,{filename:"assets/evaluation-voice.js"});
// Home delegates course-scoped flight counts and trainee attention to this production helper.
vm.runInContext(fs.readFileSync("assets/home-operations.js","utf8"),context,{filename:"assets/home-operations.js"});
for(const file of ["assets/safety-workflow.js","assets/safety-global-inbox.js","assets/safety-ui.js"])vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
assert.equal(typeof context.FLYMPUS_FLEET_MODEL?.plannedFlightCounts,"function","The UI smoke environment must load real fleet planning helpers");
assert.equal(typeof context.FLYMPUS_FLEET_VIEW?.home,"function","The UI smoke environment must load real fleet UI helpers");
assert.equal(typeof context.FLYMPUS_HOME_OPERATIONS?.weeklyFlights,"function",
  "The UI smoke environment must load the same Home operations module as the application");
const voiceParse=context.FLYMPUS_EVALUATION_VOICE?.parse;
assert.equal(typeof voiceParse,"function","Evaluation voice helper must expose a deterministic parser without a paid AI dependency");
const voiceSample=voiceParse("כל הקריטריונים ארבע חוץ מ Altitude Control שלוש. ביצענו Vertigo ו SBX. שתי המראות ושלוש נחיתות.",{
  criteria:[{id:"alt",name:"Altitude Control"},{id:"air",name:"Airmanship"},{id:"work",name:"Work Method"}],
  emergencies:[{id:"vertigo",name:"Vertigo"},{id:"flightbox",name:"Flight Box Malfunction"}],
  grading:{min:1,max:5}
});
assert.equal(voiceSample.criteria.find(x=>x.id==="alt")?.score,3,"Explicit spoken criterion grade must override the all-criteria grade");
assert.equal(voiceSample.criteria.find(x=>x.id==="air")?.score,4,"All-criteria voice command must populate remaining configured criteria");
assert.equal(voiceSample.emergencies.find(x=>x.id==="vertigo")?.count,1,"Spoken emergency name must be detected");
assert.equal(voiceSample.emergencies.find(x=>x.id==="flightbox")?.count,1,"Configured emergency aliases such as SBX must resolve deterministically");
assert.equal(voiceSample.counters.takeoffs,2,"Hebrew spoken takeoff count must be parsed");
assert.equal(voiceSample.counters.landings,3,"Hebrew spoken landing count must be parsed");
const negatedEmergency=voiceParse("לא ביצענו Vertigo",{criteria:[],emergencies:[{id:"vertigo",name:"Vertigo"}],grading:{min:1,max:5}});
assert.equal(negatedEmergency.emergencies.length,0,"Negated emergency phrases must never be applied");
const html=fs.readFileSync("index.html","utf8");
const manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));
assert.equal(manifest.short_name,"FLYMPUS","Web app manifest must identify FLYMPUS consistently");
assert.equal(manifest.display,"standalone","Home Screen installation must use standalone display mode");
assert.equal(manifest.start_url,"./","Home Screen app must start inside the same GitHub Pages scope");
assert(html.includes('rel="manifest" href="./manifest.webmanifest"')&&html.includes('apple-mobile-web-app-title" content="FLYMPUS"'),"Index must advertise the FLYMPUS manifest and iOS app title");
assert(html.includes('maximum-scale=1, user-scalable=no')&&html.includes('id="flympus-mobile-zoom-guard"'),"Mobile application pages must suppress accidental browser zoom");
assert(html.includes('./assets/evaluation-voice.js?v=0742'),"Evaluation must load the local zero-cost voice helper");
assert(html.includes('id="evaluationVoiceBlock"'),"Evaluation must render the voice-input beta block");
assert(html.includes('id="evaluationVoiceLanguageTrigger"')&&html.includes('data-evaluation-voice-language="auto"')&&!html.includes('<select id="evaluationVoiceLanguage"'),"Evaluation voice language must default to compact device/browser Automatic mode with manual override available");
assert(html.includes('bindEvaluationVoiceInput(f'),"Evaluation must bind voice input only through the Evaluation form workflow");
assert(html.includes('Apply detected values')&&html.includes('Transcription is provided by your browser or device. FLYMPUS does not use a paid AI/API and does not store the audio.'),"Voice Evaluation must require review/apply and clearly state its zero-paid-AI behavior");
assert(html.includes("event.touches?.length>1&&!insideCrop(event.target)")&&html.includes("closest('.personalCropViewport')"),"Global mobile zoom suppression must preserve the intentional profile-photo crop pinch gesture");
assert(html.includes('<main id="content"><div class="flympusBootShell" aria-hidden="true">'),"The initial HTML must contain the first-paint shell so standalone iOS never waits for hydration JS before showing app-owned content");
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
assert(html.includes('class="topCourseContext"')&&html.includes('id="topCourseName"')&&!html.includes('aria-controls="topCourseDropdown"'),"Desktop header must show non-interactive current-course context instead of a duplicate course switcher");
assert(html.includes('id="topNotificationBtn"')&&html.includes('aria-label="Notifications"'),"Header must expose an accessible notifications bell");
assert(html.includes('id="topNotificationDropdown"')&&html.includes("No new notifications"),"Notifications bell must open a notification panel with an empty state");
assert(html.includes("<span>Personal</span>")&&html.includes("across all courses"),"Notifications must be personal to the user rather than scoped to the selected course");
assert(html.includes('id="notificationSettingsLink"')&&html.includes('id="notificationSettingsCard"')&&!html.includes('id="notificationPreferences"'),"The bell must stay a focused notification center and link to the full notification settings screen");
assert(html.includes("const attr=channel==='push'?'data-push-notification-pref':'data-inapp-notification-pref'")&&html.includes("notificationCategoryDefinitions")&&html.includes("notificationAlwaysOn"),"Settings must separate in-app categories from Push categories while keeping required in-app actions always visible");
assert(html.includes("getNotificationPreferences()")&&html.includes("saveNotificationPreferences")&&html.includes("getPushNotificationPreferences()")&&html.includes("savePushNotificationPreferences"),"In-app and Push notification preferences must persist independently");
assert(html.includes("prefs.requiredActions=true")&&html.includes("preferences:getPushNotificationPreferences()"),"Required actions must remain in the in-app center while the Push backend receives only Push category preferences");
assert(html.includes('id="topPersonalProfileBtn"')&&html.includes('aria-label="Account menu"'),"The top-right personal avatar must open a compact account menu");
assert(html.includes("@keyframes flympusHeaderPopoverIn")&&
  html.includes(".topNotificationDropdown.headerPopoverOpening")&&
  html.includes(".topPersonalProfileDropdown.headerPopoverOpening")&&
  html.includes("function playHeaderPopoverOpen(menu,btn,positioner)")&&
  html.includes("--header-popover-origin-x")&&
  html.includes("playHeaderPopoverOpen(notificationMenu,notificationBtn,positionNotificationDropdown)")&&
  html.includes("playHeaderPopoverOpen(profileMenu,profileBtn,positionPersonalProfileDropdown)"),
  "Bell and personal-profile popovers must zoom/fade from the actual pressed header controls instead of appearing abruptly");
assert(html.includes('id="personalPhotoInput"')&&html.includes('id="myProfilePhotoEdit"')&&html.includes('id="myProfileRemovePhoto"'),"My Profile must edit the photo through the avatar pencil and support removal");
assert(html.includes('class="personalProfileHead accountProfileShortcut" id="quickMyProfile"')&&html.includes('id="quickSignOut"')&&!html.includes('id="quickSettings"')&&!html.includes('id="quickUserManagement"'),"The identity header itself must open My Profile without a duplicate My Profile row");
assert(html.includes(".accountQuickActions::before{content:\"\";display:block;height:1px")&&html.includes(".accountQuickSignOut b{color:#b43242!important}")&&html.includes(".accountQuickSignOut .accountQuickIcon{background:#fff0f2;color:#b43242}"),"Account menu must use a visible divider plus restrained red styling to separate Sign out from profile identity");
assert(html.includes('id="personalCropModal"')&&html.includes('id="personalCropViewport"')&&html.includes('id="personalCropImage"'),"Personal photo selection must open a crop-and-adjust editor");
assert(html.includes("function personalCropDataUrl(")&&html.includes("function renderPersonalPhotoCrop()"),"Profile photo cropper must support repositioning, zooming and exporting the adjusted square");
assert(html.includes("onpointerdown")&&html.includes("onpointermove")&&html.includes("personalCropState.zoom"),"Profile photo cropper must support touch/pointer drag and zoom adjustment");
assert(html.includes("function myProfileScreen()")&&html.includes("Official full name")&&html.includes("Nickname")&&html.includes("isInstructor=courses.length>0")&&html.includes("updateNickname"),"My Profile must keep official identity stable and expose Nickname self-service only for assigned instructors");
assert(html.includes('class="myProfileEmailValue"')&&html.includes('<span>Role</span><b class="myProfileRoleValue">')&&html.includes('Profile + drawer visual polish · 0747'),"My Profile must use the simplified Role label and the shared responsive card-alignment layer");
assert(html.includes('Single frozen canvas drawer · 0751 Facebook timing')&&html.includes('Frozen viewport canvas drawer · 0750')&&html.includes('--drawer-open-duration:200ms')&&html.includes('--drawer-close-duration:230ms')&&html.includes('--drawer-open-ease:cubic-bezier(0,.37,.665,1)')&&html.includes('--drawer-close-ease:cubic-bezier(.036,0,.21,0)')&&html.includes('body.drawerCanvasFrozen .app')&&html.includes('position:fixed!important')&&html.includes('height:100dvh!important')&&html.includes('body.drawerCanvasFrozen.drawerPushOpen .app')&&html.includes('transform:translate3d(var(--drawer-push-width),0,0)!important')&&html.includes('body.drawerCanvasFrozen main')&&html.includes('overflow:visible!important'),"Drawer must keep the approved frozen single-canvas architecture while matching the supplied 30fps Facebook reference: ~200ms ease-out opening and ~230ms accelerating close");
assert(html.includes('function freezeDrawerCanvas()')&&html.includes("if(content?.style)content.style.top=(-drawerCanvasFreezeY)+'px'")&&html.includes("body.classList.add('drawerCanvasFrozen')")&&html.includes('function releaseDrawerCanvas()')&&html.includes("if(content?.style)content.style.top=''")&&html.includes("body.classList.remove('drawerCanvasFrozen')"),"Drawer canvas freeze must be temporary: capture the live scroll position for open/close and fully restore normal scrolling afterward");
assert(html.includes("window.FLYMPUS_AUTH?.refreshSession?.()")&&!html.includes("if(refresh)location.reload();"),"Pull-to-refresh must refresh in place instead of restarting the document/auth bootstrap");
assert(html.includes('class="menuBtnWrap"')&&html.includes('function ensureFlympusMenuHapticOverlay(menuBtn)')&&html.includes("input.setAttribute('switch','')")&&html.includes('triggerFlympusPortableHaptic(8)')&&html.includes('menuHaptic.ontouchstart'),"Opening the sidebar must provide haptic feedback, using the native iOS switch technique with portable vibration fallback");
assert(html.includes("classList.contains('flympusAuthReturning')||document.documentElement.classList.contains('flympusAuthResuming')")&&html.includes("if(returning){r.hidden=true;return}"),"Returning-auth first paint must never present the sign-in/opening card during refresh or cold open");
assert(html.includes('id="flympus-auth-critical-gate"')&&html.indexOf('id="flympus-auth-critical-gate"')<html.indexOf('./auth.css?v=')&&html.includes('html.flympusAuthReturning .app')&&html.includes('visibility:hidden!important')&&html.includes('html.flympusAuthResuming .app')&&html.includes("navigator.onLine!==false")&&html.includes("flympus-auth-verified-active-v1"),"First paint must stay opaque offline/unverified while a previously ACTIVE online session may preserve the current screen with interaction disabled");
assert(html.includes("navigator.storage?.persist")&&html.includes("ensurePersistentDeviceStorage();"),"The app must request persistent device storage when the browser supports it");
assert(html.includes("function positionNotificationDropdown()"),"Notifications panel must position safely on mobile");
assert(html.includes(".panel{display:flex;flex-direction:column;padding-bottom:calc(8px + env(safe-area-inset-bottom))}.panel #nav{flex:0 0 auto}.drawerFooter{margin-top:auto;margin-bottom:6px}"),"Mobile account card should sit close to the true bottom while respecting the safe area");
assert(html.includes('id="drawerProfileShortcut"')&&html.includes('data-go="my-profile"'),"The sidebar account card must navigate to My Profile");
assert(html.includes("case'my-profile':html=myProfileScreen()"),"My Profile must participate in normal application navigation");
assert(!html.includes('class="card myProfileLinks"'),"My Profile must not duplicate Settings or User Management navigation");
assert(html.includes("const role=instructorCourseRole(currentCourseId,currentUserId)||currentUserCourseRole()"),"Account chrome must derive the selected-course role from the same membership source as Course roles");
assert(html.includes("html[data-flympus-language=\"he\"] .accountQuickAction>i")&&html.includes("html[data-flympus-language=\"he\"] .drawerProfileArrow"),"Directional account-menu arrows must mirror in Hebrew");
assert(html.includes(".topNotificationDropdown,.topPersonalProfileDropdown{position:fixed;left:calc(14px + env(safe-area-inset-left));right:calc(14px + env(safe-area-inset-right))"),"Mobile notification and personal-profile panels must stay within the viewport");
assert(html.includes("@media(max-width:899px){\n  .topCourseContext{display:none!important}"),"Mobile header must keep current-course context hidden to preserve space");
assert(html.includes("position:absolute!important;")&&html.includes("left:50%!important;")&&html.includes("transform:translate(-50%,-50%)!important;"),"Desktop current-course context must be visually centered independent of RTL/LTR");
assert(html.includes('<b id="topCourseName" aria-live="polite">&nbsp;</b>'),"Header must not hard-code Aerostar EP Course before persisted course state is restored");
assert(html.includes("active.courseName||'Aerostar EP Course'"),"Header must restore the persisted selected course name before loading the large application scripts");
assert(html.includes("function navIconSvg(name)")&&html.includes("class=\"navIcon\""),"Sidebar navigation must use a consistent SVG icon system instead of decorative glyphs");
assert(html.includes('id="mobileBottomNav"')&&html.includes("function renderMobileBottomNav()"),"Mobile layout must expose the premium bottom navigation");
assert(html.includes("['roster','roster','Roster'],['planned','planned','Plan'],['home','home','Home'],['record','record','Forms'],['reports','reports','Reports']"),"Mobile bottom navigation must use five top-level tabs with Home exactly centered and Forms grouping the three entry workflows");
assert(html.includes("const state={screen:'home'"),"A fresh session must default to Home while saved session state can still restore the previous screen");
assert(html.includes("const nav=[['__label','','COURSE'],['courses','courses','My Courses'],['settings','settings','Course Management'],['__label','','APP'],['preferences','preferences','Settings']]"),"Sidebar must not duplicate Fleet, which is available from the Home fleet status card and Plan flight board");
assert(html.includes("n.querySelectorAll('[data-nav]').forEach(b=>{b.onclick=e=>")&&!html.includes("n.querySelectorAll('[data-nav]').forEach(b=>{const pressSound=bindFlympusNavPressSound(b)"),"My Courses and Course Management must remain completely silent; navigation click audio belongs only to the bottom bar");
assert(html.includes("function normalizeDateValue(v)")&&html.includes("function formatDateDMY(v)")&&html.includes('placeholder="DD/MM/YYYY"'),"All date entry/display must use the deterministic DD/MM/YYYY layer");
assert(!/<input[^>]+type="date"/i.test(html),"Native locale-dependent date inputs must not remain in the review UI");
assert(html.includes(".dateDmy{width:100%!important;max-width:100%!important;min-width:0!important"),"Date inputs must be constrained to their container on mobile");
assert(!html.includes('${epCurrentSuitSummaryHtml()}\n<div class="twoCol">'),"Evaluation must not render the redundant Active Suit overview");
assert(!html.includes("activeSuitOverviewHtml()+\n '<div class=\"twoCol\" style=\"margin-top:14px\">"),"Exams must not render the redundant Active Package overview");
assert(html.includes("Analytics are scoped to the active course and its resolved training suit.</p>'+activeSuitOverviewHtml()"),"Course Analytics must keep the active Training Suit overview");
assert(!html.includes('<h3>Filter scope</h3>')&&!html.includes('Filters are applied consistently'),"Course Analytics must hide the Filter scope explainer card");
assert(html.includes("flightDate:normalizeDateValue(fd.get('date'))")&&html.includes("const normalized=normalizeDateValue(e.target.value)")&&html.includes("state.planDate=normalized")&&html.includes("date=state.planDate||todayIsoDate(),soloCount="),"Daily Flight Plan is the sole editable DD/MM/YYYY date; reports reuse the normalized ISO date for storage and comparisons");
assert(html.includes("function builderStartLabel(startsOn){return startsOn?formatDateDMY(startsOn):''}"),"Course-builder date labels must follow DD/MM/YYYY too");
assert(html.includes("submitted Evaluations on '+esc(formatDateDMY(date))"),"Planned vs Executed must never expose the internal ISO date to users");
assert(html.includes("function siteConfirm(")&&!(/\bconfirm\s*\(/.test(html))&&!(/\balert\s*\(/.test(html))&&!(/\bprompt\s*\(/.test(html)),"Native browser dialogs must be replaced by the branded FLYMPUS dialog");
assert(html.includes("function showFormInvalid(")&&html.includes("form.noValidate=true")&&html.includes("submitCopy=/submit/i.test"),"Forms must provide branded validation feedback using Save/Submit-aware copy instead of silent or Safari-native validation");
assert(html.includes('class="card recordActionIsland"')&&html.includes('class="toolbar recordFormActions pveRecordActions"')&&html.includes('id="pveSave" type="button">')&&html.includes("isDutyTrainee()?'Send report for approval':'Submit daily report'")&&html.includes('class="btn secondary discardDraft" id="discardPlannedDraft"'),"Plan must keep Submit/Discard in a dedicated action island while matching the Forms workflow button pattern");
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
assert(html.includes("function forcePageTop()")&&html.includes("const startAtTop=target!==previous&&['fleet','profile','instructor','my-profile','preferences','settings','user-management'].includes(target)")&&html.includes("if(startAtTop&&!options.focusNotificationSettings)forcePageTop()")&&html.includes("if(target==='preferences'&&options.focusNotificationSettings)focusNotificationSettings()")&&html.includes("const openPersonCard=(screen,extra)=>go(screen,screen==='profile'?{...extra,profileTab:'overview'}:extra)")&&html.includes("openPersonCard('profile',{selectedTrainee:b.dataset.trainee})")&&html.includes("openPersonCard('instructor',{selectedInstructor:b.dataset.instructor})"),"Every standalone profile, settings or administration entry path must hard-reset the page to the top");
assert(!html.includes('mobileBottomShell')&&!html.includes('shellGold'),"Dark brand navigation must not retain the failed custom vector shell");
assert(html.includes(".mobileBottomItem .mobileBottomLabel{display:block;width:100%;white-space:nowrap;overflow:visible")&&html.includes("class=\"mobileBottomLabel\" aria-hidden=\"true\""),"Mobile navigation labels must remain visible but non-interactive");
assert(html.includes(".mobileBottomItem.homeCenter{transform:none;height:55px}")&&html.includes("width:25px;height:25px;margin:0"),"Centered Home must use the same icon size and treatment as the other tabs");
assert(html.includes("height:74px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr))")&&html.includes("padding:5px 8px calc(7px + env(safe-area-inset-bottom))")&&html.includes("padding:3px 0 7px")&&html.includes("height:34px;min-width:0;min-height:34px"),"Five-tab mobile bottom navigation must stay compact while using seamless horizontal hit areas and extra label-to-underline spacing");
assert(html.includes("function recordHub()")&&html.includes("COURSE FORMS")&&html.includes('<h1 class="pageTitle">Forms</h1>')&&html.includes("Choose the form you want to complete for ")&&html.includes("['evaluation','evaluation','Evaluation'")&&html.includes("['safety','safety','Safety'")&&html.includes("['exams','exams','Exams'"),"Forms must open a dedicated three-choice hub for Evaluation, Safety and Exams");
assert(!html.includes("function recordActionDock(active)")&&!html.includes(".recordActionDockWrap{position:sticky"),"Forms child screens must not show the floating three-action bar");
assert(html.includes("function globalBackControl()")&&html.includes('id="appBackBtn"')&&html.includes('aria-label="Back"')&&html.includes(".recordReturnBtn{width:36px;height:36px")&&html.includes("function bindGlobalBackGesture()")&&html.includes("state.screen!=='home'")&&html.includes("startX<=56")&&html.includes("dx>=72")&&html.includes("e.preventDefault?.()"),"Every non-Home screen must provide the same compact blue back control plus a guarded left-edge swipe");
assert(html.includes("let appNavHistory=[]")&&html.includes("function saveAppNavHistory()")&&html.includes("function goBack(){")&&html.includes("if(target==='home')appNavHistory=[]")&&html.includes("if(screen!=='home')html=globalBackControl()+html"),"Global navigation history must always resolve back to Home as its root");
assert(html.includes("const appRootScreens=new Set(['courses','roster','planned','record','reports','settings','preferences','fleet'])")&&html.includes("else if(appRootScreens.has(target)&&!(target==='fleet'&&previous==='planned'&&options.fromPlan))appNavHistory=['home'];"),"Top-level destinations must be sibling screens whose Back action returns directly to Home");
assert(html.includes("const menuBtn=$('#menuBtn'),drawer=$('#drawer'),backdrop=$('#backdrop')")&&html.includes("const opening=!drawer?.classList?.contains('open')")&&html.includes("setDrawerOpen(opening)")&&html.includes("backdrop.onclick=()=>setDrawerOpen(false)"),"Hamburger and backdrop handlers must be rebound on every render so the sidebar always opens and closes");
assert(!html.includes("function recordReturnControl()")&&!html.includes("function bindRecordBackGesture()")&&!html.includes('id="backRoster"'),"Forms-only and profile-only back controls must be replaced by the single global back system");

assert(html.includes("function traineeRecordDock(traineeId)")&&html.includes(".profileRecordDock{")&&html.includes("position:sticky!important")&&html.includes("top:78px!important")&&html.includes("traineeRecordDock(t.id)")&&html.includes("--record-safety:#c84444"),"Trainee profiles must own the sticky Evaluation, Safety and Exam action bar with Safety in red");
assert(html.includes("function courseAttentionCounts()")&&html.includes("record:evaluation+safety+exams")&&html.includes("attentionBadgeHtml('record','mobileNavAttention mobileNavRecordAttention',true)")&&html.includes('data-attention-dot="true"'),"Any unfinished Forms draft must roll up into a dot-only attention indicator on the Forms bottom-nav item");
assert(html.includes(".attentionBadge[hidden]{display:none!important}")&&html.includes("el.hidden=!n")&&
  html.includes("el.textContent=n?(dotOnly?'':formatAttentionCount(n)):''")&&
  !html.includes("key==='planned'?String(n):formatAttentionCount(n)"),
  "Zero-value badges must be hidden and all attention badges must use shared 9+ formatting");
assert(html.includes("const attentionSummary=attention.record?")&&html.includes("recordAttentionSummary")&&html.includes("recordCardAttention"),"Forms must render aggregate and per-workflow unfinished indicators only when attention exists");
assert(!html.includes("counts.evaluation+' saved'")&&!html.includes("counts.safety+' saved'")&&!html.includes("counts.exams+' saved'")&&!html.includes('<span class="recordHubCount">'),"Forms cards must not display saved-record counts");
assert(html.includes("function traineeDraftNeedsAttention")&&html.includes("draftTrainee===id")&&html.includes("data-trainee-attention")&&html.includes("profileActionAttention"),"Trainee floating record actions must show an attention badge only when the unfinished draft belongs to that exact trainee");
assert(html.includes("id==='planned'?'planned':''")&&html.includes("planned=plannedAttentionCount()")&&
  html.includes("function plannedCompleteness()")&&html.includes("plan.planMissing.length"),
  "Plan must show exactly the same missing requirements as its Required panel");
assert(html.includes("b.closest?.('.coursePlanWorkspace')")&&html.includes("options.fromPlan"),"Opening Fleet from the Plan workspace must keep Plan as its return screen");
assert(html.includes('class="planRequiredTabCount"')&&fs.readFileSync('assets/course-operations.css','utf8').includes('.coursePlanTabs .planRequiredTabCount'),"Plan subtab attention must be visible and styled on mobile and desktop");
const planWorkspaceSource=html.slice(html.indexOf('function planWorkspace(){'),html.indexOf('function bindPlanWorkspace(){'));
const mockPlanWorkspace=missing=>vm.runInNewContext(planWorkspaceSource+'planWorkspace()',{
 state:{planView:'board'},plannedAttentionCount:()=>missing,planUiText:en=>en,esc:x=>String(x),
 dutyOperations:{count:()=>0,connectionMarkup:()=>''},isDutyTrainee:()=>false,dailyFlightPlan:()=>'<div>daily</div>'
});
const missingTab=mockPlanWorkspace(2),completeTab=mockPlanWorkspace(0);
assert.match(missingTab,/data-plan-view="report"[^>]*>2 · Planned vs Executed<span class="planRequiredTabCount" data-plan-missing-count="2"[^>]*>2<\/span><\/button>/,"Only step 2 Planned vs Executed should identify missing report requirements");
assert.doesNotMatch(completeTab,/planRequiredTabCount/,"No misleading subtab badge may remain after report completion");
const planBadgeCss=fs.readFileSync('assets/course-operations.css','utf8');
assert.ok(planBadgeCss.includes('.coursePlanMenu>.coursePlanTabs .planRequiredTabCount{')&&planBadgeCss.includes('position:absolute;top:3px;right:3px;left:auto'),'Required badge must be in the top-right of step 2');
assert.match(planBadgeCss,/background:#d64545;color:#fff;/,'Plan required badge must be red with white text');
assert.doesNotMatch(planBadgeCss,/\.planRequiredTabCount\{[^}]*background:#fff0cd/,'No yellow background on Plan badge');

assert(html.includes("safety:'<path d=\"M12 3.5 19 6v5.3c0 4.5-2.7 7.7-7 9.2-4.3-1.5-7-4.7-7-9.2V6l7-2.5Z\"></path><path d=\"M12 8.2v5.1\"></path><path d=\"M12 16.4h.01\"></path>'")&&html.includes("homeQuickIcon safety")+html.includes("icon safetyIcon"),"Safety must use the shield-with-exclamation icon consistently across relevant surfaces");
assert(html.includes(".recordHubCard.eval{border-top:3px solid var(--record-eval)}")&&html.includes(".recordHubCard.safety{border-top:3px solid var(--record-safety)}")&&html.includes(".recordHubCard.exam{border-top:3px solid var(--record-exam)}"),"Forms hub cards must keep the Evaluation, Safety and Exam color identity used by trainee record actions");

assert(html.includes("Course safety history")&&html.includes("safetyHistorySearch")&&html.includes("safetyHistorySeverity")&&html.includes("safetyHistoryClassification")&&html.includes("safetyHistoryTrainee")&&html.includes("safetyHistoryInstructor"),"Safety must provide course-specific history with search and operational filters");
assert(html.includes("const SAFETY_SEVERITY_DEFS=Object.freeze([")&&html.includes("value:'Minor'")&&html.includes("value:'Moderate'")&&html.includes("value:'Major'")&&html.includes("value:'Critical'"),"Safety must use the four-level Minor, Moderate, Major and Critical severity model");
assert(html.includes("function normalizeSafetySeverity(value)")&&html.includes("low:'Minor'")&&html.includes("medium:'Moderate'")&&html.includes("high:'Major'")&&html.includes("'נמוכה':'Minor'")&&html.includes("'בינונית':'Moderate'")&&html.includes("'גבוהה':'Major'"),"Legacy English and Hebrew Safety severity records must normalize into the new four-level model");
assert(html.includes('class="safetySeverityGuide"')&&html.includes('id="safetySeverityGuideTitle"')&&html.includes('aria-describedby="safetySeverityGuideIntro"'),"Safety severity guidance must be visible and programmatically associated with the severity control");
assert(html.includes("Minor impact, with no real danger or significant effect on the mission.")&&html.includes("Immediate or significant danger to the aircraft, personnel, or flight safety."),"Safety severity guide must explain the operational meaning of the lowest and highest levels");
assert(html.includes(".safetySeverity-minor{--severity:#2ca66f")&&html.includes(".safetySeverity-moderate{--severity:#d9a000")&&html.includes(".safetySeverity-major{--severity:#e98216")&&html.includes(".safetySeverity-critical{--severity:#cf3f4d"),"Safety severity guide must preserve green, amber, orange and red visual coding");
assert(html.includes('html[data-flympus-language="he"] .safetySeverityGuide')&&html.includes('html[data-flympus-theme="dark"] .safetySeverityGuide')&&html.includes('html.flympusLargeText .safetySeverityGuideHead h3'),"Safety severity guide must support Hebrew RTL, dark mode and Larger Text");
assert(html.includes("const severityOptionDots={Minor:'🟢',Moderate:'🟡',Major:'🟠',Critical:'🔴'}")&&html.includes("SAFETY_SEVERITY_DEFS.map(x=>'<option value=\"'+esc(x.value)+'\">'+esc((severityOptionDots[x.value]||'●')+' '+x.value)+'</option>')")&&!html.includes('<option>Low</option><option>Medium</option><option>High</option>'),"Safety form must keep canonical severity values while showing the reference color dots in the dropdown");
assert(html.includes("safetyRows.map(x=>normalizeSafetySeverity(x.severity)).filter(Boolean)"),"Safety analytics must group legacy and current records using normalized severity values");
assert(html.includes('class="safetyEventDetailsSection"')&&html.includes('id="safetyEventDetailsTitle"')&&html.includes('class="safetyEventDetailsCard"'),"Safety must render Event Details as one fixed-label grouped card matching the reference structure");
assert(html.includes('name="briefDescription" required')&&html.includes('name="findings"')&&html.includes('name="lessonsLearned"'),"Safety Event Details must include brief description, findings and lessons learned/conclusions fields");
assert(html.includes('placeholder="Type here..."')&&html.includes('.safetyEventDetailBlock label{display:block')&&html.includes('.safetyEventDetailBlock textarea{display:block;width:100%;min-height:72px'),"Safety Event Details must keep fixed blue headings with editable text areas beneath and Type here placeholders");
assert(html.includes("details:briefDescription,briefDescription,findings,lessonsLearned"),"Safety submissions must persist structured Event Details while preserving the legacy details alias");
assert(html.includes("briefDescription:String(draft.data.briefDescription||draft.data.details||'')"),"Legacy Safety drafts must restore their old Details content into Brief event description");
assert(html.includes("['trainee','instructor','severity','classification','title','briefDescription','findings','lessonsLearned','details']"),"Safety draft attention must recognize all structured Event Details fields");
assert(html.includes('html[data-flympus-language="he"] .safetyEventDetailsSection')&&html.includes('html[data-flympus-theme="dark"] .safetyEventDetailsCard')&&html.includes('html.flympusLargeText .safetyEventDetailBlock label'),"Safety Event Details must support Hebrew RTL, dark mode and Larger Text");
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
assert(html.includes('class="rosterInstructorNickname"')&&html.includes("instructorOfficialName(t)")&&html.includes("instructorNickname(t)"),"Instructor roster cards must keep official full name primary and show Nickname as secondary identity when set");
assert(html.includes("type==='TRAINEE'?'Trainee identity is managed by course management.")&&html.includes("Instructor official identity and nickname are managed at account level."),"Course Roster must keep trainee names course-managed while instructor identity remains account-managed");
assert(html.includes('<span class="rosterChevron" aria-hidden="true">›</span>')&&html.includes("if(b.matches?.('.personCard'))b.onkeydown"),"Roster chevrons must be decorative while the full card supports click and keyboard activation");
assert(html.includes("manage?'manageCard':'personCardOpen'")&&html.includes("data-person-edit=\"TRAINEE:")&&html.includes("data-person-edit=\"INSTRUCTOR:"),"Roster Manage mode must keep Edit actions instead of making management cards open profiles");
assert(!html.includes("Restore original Package defaults"),"Bulk Package restore-to-defaults must be removed");
assert(!html.includes("Revert to Package defaults"),"Bulk course revert-to-defaults must be removed");
assert(html.includes(".packageRules>summary>span{font-size:9px;color:#8092a5}"),"Summary helper styling must target only the direct helper span so counts inside titles keep the title font");
assert(html.includes('.drawer.open .panel::before{')&&html.includes('top:calc(env(safe-area-inset-top) - 2px)')&&html.includes('height:5px;')&&html.includes('background:#102f51;'),"iOS drawer must paint the status-bar boundary with panel-owned navy, not a global fixed underlay");
assert(!html.includes("drawerRole.textContent=appRole+' · '+courseRole"),"Drawer footer must never append a course-specific position to the system role");

const approvedSidebarLogo='assets/flympus-sidebar-uploaded-0762.webp';
const serviceWorker=fs.readFileSync('sw.js','utf8');
assert(serviceWorker.includes("'./"+approvedSidebarLogo+"'")&&!serviceWorker.includes("'./assets/flympus-sidebar-final.webp'"),
  "Offline/PWA shell cache must preload the new approved sidebar logo rather than the previous one");
assert(html.includes('class="sidebarFlympusWordmark" src="./'+approvedSidebarLogo+'"'),"Sidebar must use the exact user-provided replacement logo");
assert(!html.includes('class="sidebarFlympusWordmark" src="./assets/flympus-sidebar-final.webp"'),"Sidebar must no longer render the previous logo");
assert(html.includes('.panel .brand .sidebarFlympusWordmark{')&&
  html.includes('width:min(198px,100%)!important;')&&
  html.includes('margin:0 auto!important;')&&
  html.includes('object-position:center center!important;')&&
  html.includes('justify-content:center!important;'),
  "The user-approved logo must keep its centered layout and balanced 198px width, with full aspect ratio, on phone and desktop");
assert(fs.existsSync(approvedSidebarLogo)&&fs.statSync(approvedSidebarLogo).size>10000,
  "The new logo must be bundled locally in the site, not linked to a transient upload");
assert.equal(fs.readFileSync(approvedSidebarLogo).toString('ascii',0,4),'RIFF',
  "The replacement logo must be a valid local WebP file");
assert(html.includes('id="flympus-desktop-chrome-drawer-parity"'),"Desktop cross-device shell regression layer must load in the final head");
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(x=>x.trim());
assert(scripts.length>=2);const appSource=scripts.at(-1).split('const earlyNavTarget=')[0];vm.runInContext(appSource,context,{filename:"index-inline.js"});
// Drawer footer is global identity. A person's course-role membership must not
// leak into the footer, even if the current course assigns Course Manager.
elements.set("#drawerProfileRole",new ElementStub());
const previousAppRole=context.FLYMPUS_AUTH.role;
for(const [systemRole,expectedLabel] of [["owner","Owner"],["admin","Administrator"],["training_manager","Training Manager"],["user","User"]]){
  context.FLYMPUS_AUTH.role=()=>systemRole;
  vm.runInContext("renderPersonalIdentity()",context);
  assert.equal(elements.get("#drawerProfileRole").textContent,expectedLabel,
    "Drawer footer must show only the active user's app role ("+systemRole+"), never Course Manager/Instructor");
}
context.FLYMPUS_AUTH.role=previousAppRole;
vm.runInContext("renderPersonalIdentity()",context);
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
vm.runInContext("go('planned',{planView:'report'});go('fleet',{}, {fromPlan:true})",context);
assert.equal(vm.runInContext("appNavHistory.join(',')",context),"home,planned","Fleet opened inside Plan must keep Plan as the immediate back destination");
vm.runInContext("goBack()",context);
assert.equal(vm.runInContext("state.screen",context),"planned","Back from Fleet opened inside Plan must return to Plan");
assert.equal(vm.runInContext("state.planView",context),"report","Back from Fleet must preserve the previously selected Plan subtab");
vm.runInContext("goBack();go('planned');go('fleet')",context);
assert.equal(vm.runInContext("appNavHistory.join(',')",context),"home","Independent Fleet navigation must remain top-level");
vm.runInContext("goBack()",context);
assert.equal(vm.runInContext("state.screen",context),"home","Back from independent Fleet must return Home");
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
assert.ok(editingTailorHtml.includes('id="courseTailorDoneDock" type="button">✓ Done editing</button>'), 'Mobile Tailor dock should show ✓ Done editing');
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
assert.match(advancedHtml,/class="advancedStepLabel advancedStepEditEntry"[\s\S]*id="advancedArchitectureEdit">✎ Edit advanced setup<\/button>/,"Advanced view mode must expose one contextual Edit action at the start of the setup flow");
assert.doesNotMatch(advancedHtml,/packageSaveBar advancedArchitectureActions/,"Advanced Edit must never float over content or the bottom navigation");
assert.doesNotMatch(advancedHtml,/id="cfgSaveCatalogs"/,"Save controls must not appear before Advanced edit mode starts");
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
assert.doesNotMatch(advancedEditingHtml,/packageSaveBar advancedArchitectureActions/,"Advanced save/discard controls must stay in normal document flow");
assert.match(advancedEditingHtml,/class="pill blue advancedEditingState">Editing<\/span>/,"Advanced must make edit mode obvious without a floating button");
assert.match(advancedEditingHtml,/class="advancedArchitectureActions editDecisionBar"[\s\S]*id="cfgDiscardCatalogs"[\s\S]*id="cfgSaveCatalogs">Save changes<\/button>/,"Advanced edit decisions must be an inline end-of-flow action block");
assert(advancedEditingHtml.indexOf('Final step · create and manage reusable Packages.')<advancedEditingHtml.indexOf('id="cfgSaveCatalogs"'),"Advanced Save changes must come after Packages so the action clearly applies to the full setup");
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
assert(html.includes("const coarseTouch=Number(navigator.maxTouchPoints||0)>0&&!!window.matchMedia?.('(hover:none) and (pointer:coarse)')?.matches")&&html.includes("const hapticsRelevant=isFlympusIOSHapticTarget()||coarseTouch"),
  "Settings must detect touch/coarse-pointer devices and iOS haptic targets");
assert(html.includes("(hapticsRelevant?appPreferenceSwitch('haptics','Haptic feedback'")&&html.includes("appPreferenceUnavailable('Haptic feedback','Available only on supported touch devices.','Touch only')"),
  "Desktop Settings must keep Haptic feedback visible but disabled with a clear touch-only explanation");
assert(html.includes("pullRefreshRelevant?appPreferenceSwitch('refreshSound'")&&html.includes("appPreferenceUnavailable('Pull-to-refresh sound','Available only in the installed mobile/touch app.','Mobile / touch only')"),
  "Pull-to-refresh feedback must be active only in a relevant installed touch app and otherwise explain why it is unavailable");

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
assert(html.includes("snap.visualVersion===12")&&html.includes("snapFresh=snapAge<=24*60*60*1000")&&
  html.includes("snap.localDay===localDay")&&html.includes("snap.resolvedTheme===currentResolvedTheme")&&html.includes("viewportCompatible")&&
  html.includes("localStorage.getItem('ct-review-cold-home-snapshot')")&&html.includes("snap.screen==='home'"),
  "Cold-launch first paint may use only a same-day, compatible HOME snapshot; previous non-Home screens must never become a killed-app launch destination");
assert(html.includes("visualVersion:12")&&html.includes("resolvedTheme:resolvedTheme==='dark'?'dark':'light'")&&
  html.includes("largerText:!!root?.classList.contains('flympusLargeText')")&&
  html.includes("if(snapshot.screen==='home')localStorage.setItem('ct-review-cold-home-snapshot',serialized)"),
  "HOME must keep a dedicated compatible first-paint snapshot without promoting later screens into cold-launch state");
assert(html.indexOf('<meta name="theme-color" content="#0b3157" />')<html.indexOf('id="flympus-theme-bootstrap"')&&
  html.includes("document.documentElement.classList.add('flympusColdBoot')")&&
  html.includes("html.flympusColdBoot body")&&html.includes("background:#0b3157!important"),
  "iOS cold launch must start on the branded navy canvas before any light application paint can occur");
assert(html.includes('<meta name="color-scheme" content="light" />')&&
  themeController.includes("document.querySelector('meta[name=\"color-scheme\"]')?.setAttribute('content',resolved)"),
  "Native controls follow the exact committed resolution");

assert(html.includes("function flympusContinuitySnapshotHtml(content)")&&
  html.includes("clone.querySelectorAll?.('.modal.open')")&&
  html.includes("clone.querySelectorAll?.('.multiFilterMenu,.datePickerPanel')"),
  "Continuity snapshots must strip transient dialogs, menus and picker overlays that would otherwise flash on resume");
assert(html.includes("topHidden:scrollY>64&&")&&html.includes("window.__FLYMPUS_RELOAD_SNAPSHOT__={...firstPaintSnap,scrollY:0,topHidden:false,screen:targetScreen}")&&
  html.includes("window.scrollTo?.(0,0)"),
  "First-paint restoration must preserve the requested screen with visible chrome at scroll zero");
assert(!html.includes("touchChromeStable?false:!!hidden")&&
  html.includes("const flympusTouchPullMode=()=>flympusStandaloneMode();")&&
  html.includes("if(!customPull||top>2)return;")&&html.includes("pullStandaloneGesture=true"),
  "Touch auto-hide stays enabled while custom pull-to-refresh is isolated to an explicit top-start gesture in the installed PWA");
assert(html.includes("iOS top-chrome upward extension · 0757")&&
  html.includes(".top::after{")&&
  html.includes("bottom:100%")&&
  html.includes("height:calc(180px + env(safe-area-inset-top))")&&
  html.includes("background:inherit")&&
  !html.includes("iOS top-chrome slot underlay · 0756")&&!html.includes(".app::before{content:none}"),
  "Fast iOS reverse/pull motion must be covered by a navy extension attached to the moving header itself, not by a static document underlay or changed chrome timing");
assert(html.includes("Viewport-owned mobile chrome · 0758")&&
  html.includes(":root{--flympus-top-chrome-height:78px}")&&
  html.includes("padding-top:var(--flympus-top-chrome-height,78px)!important")&&
  html.includes("position:fixed!important")&&html.includes("top:0!important")&&
  html.includes("right:0!important")&&html.includes("width:100%!important"),
  "Touch/mobile top chrome must be viewport-owned with a preserved 78px document footprint so its approved transform timing is not distorted by sticky scroll geometry");
assert(html.includes("snap.localDay===localDay"),
  "A snapshot from a previous local day must never flash before today's plan renders");
assert(html.includes("sessionStorage.getItem('ct-review-reload-snapshot')")&&
  html.includes("reloadSnap?.uid===reloadUid")&&html.includes("reloadVerified&&navigator.onLine!==false")&&
  html.includes("reloadSnap.screen===targetScreen")&&
  html.includes("reloadSnapAge<=30*60*1000")&&
  html.includes("const firstPaintSnap=reloadSnapMatches?reloadSnap:(snapMatches?snap:null)")&&
  html.includes("content.innerHTML=firstPaintSnap.html")&&
  html.includes("uid:String(window.FLYMPUS_STORAGE_SCOPE?.currentUid?.()||'').trim()"),
  "A desktop or mobile refresh must paint the exact saved screen only for the same verified active UID");
assert(html.includes("targetScreen==='home'&&snap")&&
  html.includes("!new URLSearchParams(location.search).has('pushScreen')")&&
  html.includes("!reloadSnap.html.includes('flympusBootShell')"),
  "Cold starts, deep links and loading skeletons must not masquerade as same-screen refresh snapshots");
assert(html.includes("if(!flympusRealPageReload||!appScreenIds.has(String(initialUiState.screen||'')))initialUiState.screen='home'")&&
  html.includes("if(flympusPushBootScreen&&")&&
  html.includes("targetScreen==='home'&&snap")&&
  !html.includes("const landing=getFlympusAppPreferences().startScreen"),
  "Only fresh/cold launches must start HOME. Reload restores valid saved screens without flashing a HOME snapshot; push targets override either.");
// Functional regression for Desktop F5/Ctrl+R, mobile reload, and PWA cold launch.
{
  const start=html.indexOf("const appScreenIds=new Set(['home','courses'");
  const end=html.indexOf('const state={screen:',start);
  assert(start>=0&&end>start,'Shared navigation bootstrap must be present');
  const bootstrap=html.slice(start,end);
  const run=({screen='home',navigation='navigate',push='',fallback=false}={})=>{
    const result=vm.runInNewContext(bootstrap+'\n({screen:initialUiState.screen,params:flympusPushBootScreen})',{
      sessionStorage:{getItem:key=>key==='ct-review-ui'?JSON.stringify({screen,settingsTab:'catalog'}):null},
      location:{search:push?('?pushScreen='+encodeURIComponent(push)):''},
      URLSearchParams,
      performance:fallback?{getEntriesByType:()=>[],navigation:{type:navigation==='reload'?1:0}}:
        {getEntriesByType:()=>[{type:navigation}]}
    });
    return result;
  };
  for(const screen of ['roster','profile','instructor','courses','settings','preferences','my-profile','user-management','reports','planned','record','evaluation','safety','exams']){
    assert.equal(run({screen,navigation:'reload'}).screen,screen,'Refresh must stay on '+screen);
  }
  assert.equal(run({screen:'reports',navigation:'navigate'}).screen,'home','Fresh tab starts HOME');
  assert.equal(run({screen:'invalid-screen',navigation:'reload'}).screen,'home','Unknown screen resets safely');
  assert.equal(run({screen:'settings',navigation:'reload',push:'roster'}).screen,'roster','Push deep link overrides saved screen');
  assert.equal(run({screen:'roster',navigation:'reload',fallback:true}).screen,'roster','Legacy navigation timing fallback restores screen');
}



/* Plan navigation badge regression: count all required items accurately,
   but continue to abbreviate the visual badge as 9+ above nine. */
{
  const start=html.indexOf("function plannedCompleteness(){");
  const end=html.indexOf("function plannedVsExecuted(){",start);
  assert(start>=0&&end>start,'Plan completeness helper must exist');
  const helper=html.slice(start,end);
  const run=({plan,executedInstructed=0,executedSolo=0,savedReports=[],selectedDate}={})=>{
    const draft=plan?{data:plan}:null;
    const date=selectedDate||plan?.date||'2026-10-08';
    const records=Array.from({length:executedInstructed},(_,i)=>({date,id:'evaluation-'+i}));
    const solos=Array.from({length:executedSolo},(_,i)=>({date,id:'solo-'+i}));
    const scope={
      dutyOperations:null,todayIsoDate:()=>date,getPlanExecutedInstructed:d=>records.filter(x=>x.date===d).length,getPlanWorkingSoloFlights:()=>solos,
      getDailyReports:()=>savedReports,getActivityDraft:()=>draft,
      flightBoardPlanStatus:()=>({linked:false,instructed:0,solo:0}),
      getEvaluations:()=>records,getSoloFlights:()=>solos,
      state:{planDate:selectedDate||null},cfgGet:()=>({cancellationReasons:[{id:'weather',name:'Weather'}]}),
      Date,Number,Math,String,Array,Set
    };
    return vm.runInNewContext(helper+'\n({count:plannedAttentionCount(),missing:plannedCompleteness().planMissing.map(x=>x.label)})',scope);
  };
  const plan={date:'2026-10-08',plannedInstructed:1,plannedSolo:11,cancellations:[],__attentionCount:1};
  const missing12=run({plan});
  assert.equal(missing12.count,12,'The Plan nav badge shows twelve missing reasons, not the stale one');
  assert.equal(missing12.missing.length,missing12.count,'Badge and missing panel have identical counts');
  const twoReasons={...plan,cancellations:[
    {key:'INSTRUCTED_1',type:'Instructed',reasonId:'weather',reasonLabel:'Weather'},
    {key:'SOLO_1',type:'Solo',reasonId:'weather',reasonLabel:'Weather'}]};
  assert.equal(run({plan:twoReasons}).count,10,'Completing two reasons reduces the badge count to ten');
  const fullyComplete={...plan,cancellations:[
    {key:'INSTRUCTED_1',type:'Instructed',reasonId:'weather'},
    ...Array.from({length:11},(_,i)=>({key:'SOLO_'+(i+1),type:'Solo',reasonId:'weather'}))]};
  assert.equal(run({plan:fullyComplete}).count,0,'All reasons completed removes the badge');
  assert.equal(run({plan,executedInstructed:1}).count,11,'Executed flights reduce missing cancellations');
  assert.equal(run({}).count,0,'No entered plan and no saved report require no badge');
  assert.equal(run({savedReports:[{date:'2026-10-08',plannedInstructed:1,plannedSolo:11,cancellations:[]}],selectedDate:'2026-10-08'}).count,12,
    'The badge reflects missing reasons even when the plan comes from a saved report');
  const badgeStart=html.indexOf('function formatCompactBadgeCount(value){');
  const badgeEnd=html.indexOf('function courseAttentionCounts(){',badgeStart);
  assert(badgeStart>=0&&badgeEnd>badgeStart,'Shared compact badge formatter is required');
  const formatted=vm.runInNewContext(html.slice(badgeStart,badgeEnd)+'\n[formatAttentionCount(0),formatAttentionCount(1),formatAttentionCount(9),formatAttentionCount(10),formatAttentionCount(12)]');
  assert.equal(Array.from(formatted).join(','),'0,1,9,9+,9+','Plan badge shows 9+ for 10 or more missing items');
  assert(html.includes("const n=Number(courseAttentionCounts()[key]||0),content=n?(dotOnly?'':formatAttentionCount(n)):'';")&&
    html.includes("el.textContent=n?(dotOnly?'':formatAttentionCount(n)):''"),
    'Initial and live-updated badges both share the compact formatter');
}

/* Navigation audio must never escape its initiating physical gesture, and the
   first press after cold launch/reload must not be sacrificed to audio warm-up. */
assert(html.includes("window.__FLYMPUS_CLAIM_NAV_SOUND_GESTURE__")&&html.includes("if(!e||e.isTrusted===false)return false"),
  "Navigation sound must require a trusted physical event");
assert(html.includes("if(ctx.state!=='running')return false;")&&html.includes("return playFlympusNavFileFallback();"),
  "A deferred AudioContext resume must immediately fall back on the same trusted nav press instead of sacrificing early taps");
assert(html.includes("Capture phase is deliberately silent")&&!html.includes("Claiming this exact event guarantees target phase"),
  "Capture-phase audio warm-up must never consume the audible navigation gesture before target phase");
assert(html.includes("ensureEarlyNavAudio();")&&html.includes("window.__FLYMPUS_EARLY_NAV_AUDIO__=a")&&html.includes("earlyMatches?[early]:[]"),
  "The baked fallback must preload during parser startup and be reused by runtime so the first press is not a cold media entry");
assert(html.includes("cancelFlympusPendingNavSources()"),
  "Navigation sources must remain cancellable at lifecycle boundaries");
assert(html.includes("playFlympusBottomNavSound(e);"),
  "Bottom-nav binding must pass the originating event into the audible path");


/* Notification category switches are rendered directly from persisted state. */
assert(html.includes("function notificationSettingsRows(channel,prefs)")&&
  html.includes("aria-checked=\"'+(checked?'true':'false')+'\"")&&html.includes("(checked?'checked':'')"),
  "Notification category switches must paint their persisted checked and aria state synchronously");
assert(html.includes("function syncNotificationPreferenceControls()")&&
  html.includes("[data-inapp-notification-pref]")&&html.includes("[data-push-notification-pref]"),
  "Notification Settings must keep both in-app and Push controls synchronized after render");
assert(html.includes("aria-checked=\"'+(checked?'true':'false')+'\""),
  "App Settings switches must render accessibility state together with their checked state");
assert(html.includes("el.setAttribute('aria-checked',el.checked?'true':'false')"),
  "Visual switches must keep aria state aligned after real user changes");

assert(html.includes('Full-site typography alignment · 2026-10-06')&&
  html.includes('html.flympusLargeText .evaluationVoiceTranscript')&&
  html.includes('body{font-size:14px}'),
  'Typography must use one final site-wide scale and Larger Text must cover late-loaded Evaluation voice controls');

// Bell settings deep-link: center the section heading after routing.
assert(html.includes("go('preferences',{}, {focusNotificationSettings:true})"),'Bell settings must target Notifications, not merely open Settings');
assert(html.includes("function focusNotificationSettings()"),'Notifications focus helper must exist');
assert(html.includes("heading.scrollIntoView?.({behavior:reduceMotion?'auto':'smooth',block:'center',inline:'nearest'})"),
  'Notifications section header must center after render, supporting reduced motion');
assert(html.includes("if(startAtTop&&!options.focusNotificationSettings)forcePageTop()"),'Top reset must not undo the Notifications focus');
assert(html.includes("id=\"accountSwitchList\"")&&html.includes("id=\"accountAddAnother\""),'Account picker must be part of shared desktop/mobile profile menu');
assert(html.includes('class="personalProfileEmail" id="personalProfileEmail"'),'Email must appear immediately below active account name');
assert(html.includes('Sign out of this account'),'Signout explanation must replace account email in destructive action');

/* Duty Trainee hard-deny runtime smoke: direct function invocation cannot render forbidden screens. */
{
 const previous={role:context.FLYMPUS_AUTH.role,isActive:context.FLYMPUS_AUTH.isActive,can:context.FLYMPUS_AUTH.can,
  profile:context.FLYMPUS_AUTH.profile,currentUser:context.FLYMPUS_AUTH.currentUser};
 Object.assign(context.FLYMPUS_AUTH,{
  role:()=>'duty_trainee',isActive:()=>true,can:()=>true,
  profile:{uid:'test-duty',role:'duty_trainee',status:'active',displayName:'Duty Tester',email:'duty@example.invalid'},
  currentUser:{uid:'test-duty',displayName:'Duty Tester',email:'duty@example.invalid'}
 });
 assert.equal(vm.runInContext("isDutyTrainee()",context),true);
 assert.equal(vm.runInContext("canViewDutyScreen('home')",context),true,
   'Unassigned Duty Trainee must still see a safe Home');
 assert.equal(vm.runInContext("canViewDutyScreen('preferences')",context),true,
   'Unassigned Duty Trainee must still see personal Settings');
 for(const screen of ['roster','profile','instructor','courses','record','evaluation','safety','exams','reports','settings','user-management','my-profile']){
   assert.equal(vm.runInContext('canViewDutyScreen('+JSON.stringify(screen)+')',context),false,screen+' must be forbidden');
   const result=vm.runInContext('buildFlympusScreenHtml('+JSON.stringify(screen)+')',context);
   assert(result.includes('accessDeniedCard')&&!result.includes('recentEvalCard'),screen+' must render no private data');
 }
 assert.equal(vm.runInContext("canViewDutyScreen('planned')",context),false,'Unassigned Duty Trainee must not read Plan');
 assert.equal(vm.runInContext("canViewDutyScreen('fleet')",context),false,'Unassigned Duty Trainee must not read Maintenance');
 for(const cap of ['roster.manage','evaluations.write','users.manage','courses.create','courses.manageAssigned','packages.overrideCourse','packages.manageGlobal']){
   assert.equal(vm.runInContext('flympusCan('+JSON.stringify(cap)+')',context),false,cap+' must remain denied even when underlying can() says true');
 }
 const safeHome=vm.runInContext('home()',context);
 assert(safeHome.includes('Course access not assigned')&&!safeHome.includes('Course Pulse')&&!safeHome.includes('Start Evaluation'));
 const settings=vm.runInContext('appPreferencesScreen()',context);
 assert(settings.includes('myProfilePhotoEdit')&&settings.includes('Official full name'));
 assert(!settings.includes('myProfileEditOfficialName')&&!settings.includes('myProfileNicknameEditor')&&!settings.includes('openUserManagementSettings'));
 const dutyState=vm.runInContext('state.screen',context);
 vm.runInContext("go('roster')",context);
 assert.equal(vm.runInContext('state.screen',context),dutyState,'Direct navigation must not change active screen');
 vm.runInContext("go('my-profile')",context);
 assert.equal(vm.runInContext('state.screen',context),'preferences','Profile menu must lead into restricted personal Settings');
 Object.assign(context.FLYMPUS_AUTH,previous);
}

assert(html.includes('.topNotificationBtn[hidden],.topNotificationDropdown[hidden]{display:none!important}'),
  'Duty Trainee hidden notification controls must override the explicit grid display rules');
assert(html.includes("if(isDutyTrainee())return {evaluation:0,safety:0,exams:0,record:0,planned:isDutyTraineeAssigned()?plannedAttentionCount():0}"),
  'Duty Trainee attention badge calculation must not read evaluation, safety or exam drafts');

/* Duty Trainee runs a purpose-built 3-tab dock, not hidden or disabled general tabs. */
{
 const dutyDock=html.match(/const items=isDutyTrainee\(\)\?(\[\['planned','planned','Plan'\][^;]+):\[\['roster'/);
 assert(dutyDock,'Duty Trainee dock must be independently composed from allowed screens');
 const dutyItems=dutyDock[1];
 assert.equal((dutyItems.match(/\['(?:planned|home|fleet)'/g)||[]).length,3,
   'Duty Trainee must have exactly three bottom tabs');
 assert(dutyItems.startsWith("[['planned','planned','Plan'],['home','home','Home'],['fleet','fleet','Fleet']]"),
   'The physical dock order must be Plan (left), Home (middle), Maintenance (right)');
 assert(!dutyItems.includes('preferences')&&!dutyItems.includes('roster')&&!dutyItems.includes('record')&&!dutyItems.includes('reports'),
   'Forbidden and account settings tabs must never be constructed for Duty Trainee');
 assert(html.includes('.mobileBottomNav.dutyDock{')&&html.includes('direction:ltr;')&&html.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),
   'Dock must be three equal columns with physical placement stable in Hebrew RTL');
 assert(html.includes("const visible=isDutyTrainee()?[['__label','','OPERATIONS'],['home','home','Home'],['planned','planned','Plan']]"),
   'Duty Trainee sidebar must not duplicate Fleet, which stays in the bottom dock and Home');
 assert(html.includes("if(isDutyTrainee()&&screen==='my-profile')screen='preferences';")&&
    html.includes("data-go=\"my-profile\""),
   'Personal settings must remain available through the existing account/profile menu');
 assert(html.includes("const DUTY_ALLOWED_SCREENS=new Set(['home','planned','fleet','preferences'])")&&
    html.includes("if(!canViewDutyScreen(screen))return flympusAccessDenied('Access unavailable')"),
   'Removing UI entries must not remove underlying security checks');
 assert(html.includes("fleet:'<path d=\"M12 2.5 9.5 10"),
   'Maintenance must use a recognizable aircraft icon, not the old four-point emblem');
}

assert(!html.includes("['fleet','fleet','Aircraft Serviceability']"),"Neither standard sidebar nor Duty sidebar should duplicate Fleet");
assert(html.includes("['planned','planned','Plan'],['home','home','Home'],['fleet','fleet','Fleet']"),"Duty must show Fleet to the right of Home");
assert(html.includes('data-go="fleet">Open Fleet</button>'),"Duty Home must still provide a direct Fleet entry");
assert(fs.readFileSync('assets/fleet-views.js','utf8').includes('data-go="fleet"'),
  "Other roles must retain Fleet access from Home and Plan rather than the sidebar");

(()=>{
 const source=fs.readFileSync('index.html','utf8');
 const start=source.indexOf("if(tab==='catalog'&&canGlobalPackages)");
 const piece=source.slice(start,source.indexOf("if(tab==='profiles')",start));
 assert.ok(piece.includes('btn edit small advancedEditStart'));
 assert.ok(piece.includes('✎ Edit advanced setup'));
 assert.ok(piece.indexOf('<section class="advancedSequence"')<piece.indexOf('<fieldset class="advancedEditFieldset"'));
})();
