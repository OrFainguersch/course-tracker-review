(function(root){
'use strict';
const M=root.FLYMPUS_FLEET_MODEL;
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=(en,he)=>root.FLYMPUS_FLEET_LANGUAGE?.()==='he'?he:en;
const F=d=>/^\d{4}-\d\d-\d\d$/.test(String(d||''))?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'—';
/* Aircraft platform is presentation-only: stored tail and aircraft ID stay stable. */
const aircraftDisplayName=(c,tail)=>{
 const platform=String(c?.platformLabel??'').trim(),number=String(tail??'').trim();
 if(!platform||platform==='—')return number;
 if(!number)return platform;
 const prefix=platform.toLocaleLowerCase();
 if(number.toLocaleLowerCase().startsWith(prefix+'-'))return platform+'-'+number.slice(platform.length+1).trim();
 if(number.toLocaleLowerCase().startsWith(prefix+' '))return platform+'-'+number.slice(platform.length).trim();
 return platform+'-'+number;
};
const O=(value,label,selected)=>'<option value="'+E(value)+'" '+(String(value)===String(selected)?'selected':'')+'>'+E(label)+'</option>';
const MINUTE_PRESETS=Object.freeze([10,15,20,25,30,35,40]);
const minuteOptions=value=>{
 const current=Number(value),values=[...MINUTE_PRESETS];
 if(String(value??'')!==''&&Number.isInteger(current)&&current>=0&&current<=720&&!values.includes(current))values.push(current);
 values.sort((a,b)=>a-b);
 return values.map(n=>O(n,L(n+' min',n+' דקות')+(MINUTE_PRESETS.includes(n)?'':L(' (existing)',' (ערך קיים)')),value)).join('');
};
const minuteSelect=(name,value)=>'<select class="input" name="'+E(name)+'" required>'+minuteOptions(value)+'</select>';
const status=s=>s===M.AVAILABLE?L('Serviceable','שמיש'):L('Unserviceable','לא שמיש');
const statusBadge=s=>'<span class="fleetStatusBadge '+(s===M.AVAILABLE?'ready':'down')+'"><i aria-hidden="true"></i>'+status(s)+'</span>';
const metrics=(rows,platform)=>{
 const c=M.count(rows,platform);
 return '<div class="fleetStats" aria-label="'+L('Fleet totals','סיכום מצבת כלים')+'"><span><b>'+c.total+'</b> '+L('Total aircraft','כלים בסך הכול')+'</span><span class="ready"><b>'+c.serviceable+'</b> '+L('Serviceable','שמישים')+'</span><span class="down"><b>'+c.unserviceable+'</b> '+L('Unserviceable','לא שמישים')+'</span></div>';
};
function home(c){
 const rows=M.active(c.fleet,c.platformId),counts=M.count(c.fleet,c.platformId),shown=rows.slice(0,6);
 const body=shown.map(x=>'<tr class="'+(x.status===M.UNAVAILABLE?'fleetRowDown':'')+'"><td class="fleetHomeTail">'+E(aircraftDisplayName(c,x.tail))+'</td><td>'+statusBadge(x.status)+(x.reason?'<small class="fleetCellReason" title="'+E(x.reason)+'">'+E(x.reason)+'</small>':'')+'</td><td class="fleetDate">'+F(x.since)+'</td></tr>').join('');
 return '<section class="homePanel homePanelPad fleetHomePanel" data-fleet-home>'+
  '<div class="homeBlockHead"><div class="homeBlockTitle"><div><h2>'+L('Fleet','צי כלי טיס')+'</h2><p>'+E(c.platformLabel)+' · '+L('Serviceability status','מצב שמישות')+'</p></div></div><button type="button" class="homeInlineLink" data-go="fleet">'+L('Manage','ניהול')+'</button></div>'+
  '<div class="fleetHomeSummary"><span class="fleetHomeCount '+(counts.unserviceable?'hasDown':'')+'"><b>'+counts.serviceable+'</b> / '+counts.total+' '+L('serviceable','שמישים')+'</span>'+(counts.unserviceable?'<span class="fleetHomeWarning">'+counts.unserviceable+' '+L('unserviceable','לא שמישים')+'</span>':'')+'</div>'+
  (rows.length?'<div class="fleetTableWrap fleetHomeTableWrap"><table class="fleetTable fleetHomeTable"><thead><tr><th scope="col">'+L('Tail number','מספר זנב')+'</th><th scope="col">'+L('Status / reason','סטטוס / סיבה')+'</th><th scope="col">'+L('Since','מתאריך')+'</th></tr></thead><tbody>'+body+'</tbody></table></div>'+(rows.length>shown.length?'<p class="fleetHomeMore">'+L('Showing','מוצגים')+' '+shown.length+' '+L('of','מתוך')+' '+rows.length+' · '+L('Open board for all aircraft','פתח את הלוח להצגת כל הכלים')+'</p>':''):'<p class="fleetQuiet">'+L('No aircraft registered. Open Manage to add your fleet.','טרם נרשמו כלים. ניתן להוסיף אותם דרך ניהול השמישויות.')+'</p>')+
  '</section>';
}
function fleet(c){
 const rows=M.active(c.fleet,c.platformId).sort((a,b)=>Number(b.status===M.AVAILABLE)-Number(a.status===M.AVAILABLE)),
  current=rows.find(x=>x.id===c.editId),can=c.canWrite,manage=c.canWrite&&c.manage===true,filter=['SERVICEABLE','UNSERVICEABLE'].includes(c.statusFilter)?c.statusFilter:'ALL',
  shown=rows.filter(x=>filter==='ALL'||x.status===filter);
 const field=(label,input,extra='')=>'<div class="field" '+extra+'><label>'+label+'</label>'+input+'</div>';
 const history=x=>x.history?.length>1?'<details class="fleetHistory"><summary>'+L('Status history','היסטוריית שמישות')+' ('+x.history.length+')</summary><div class="fleetHistoryList">'+x.history.slice().reverse().map(h=>'<p><strong>'+status(h.status)+'</strong> · '+F(h.since)+(h.reason?' · '+E(h.reason):'')+(h.recordedBy?' · '+E(h.recordedBy):'')+'</p>').join('')+'</div></details>':'';
 const editorHtml=(can?'<section class="card fleetEditor" id="fleetEditorPanel" '+(current?'':'hidden')+'><div class="fleetSectionHead"><h2>'+L(current?'Edit aircraft':'Add aircraft',current?'עריכת כלי טיס':'הוספת כלי טיס')+'</h2></div><form id="fleetAircraftForm"><input name="id" type="hidden" value="'+E(current?.id||'')+'"><div class="fleetFormGrid">'+
 field(L('Tail number','מספר זנב (מס״ז)'),'<input class="input" name="tail" maxlength="48" required placeholder="01" value="'+E(current?.tail||'')+'">')+
 field(L('Serviceability','שמישות'),'<select class="input" name="status" id="fleetStatus">'+O(M.AVAILABLE,status(M.AVAILABLE),current?.status||M.AVAILABLE)+O(M.UNAVAILABLE,status(M.UNAVAILABLE),current?.status)+'</select>')+
 field(L('Effective date','תאריך שינוי סטטוס'),'<input class="input dateDmy" type="text" name="since" required inputmode="numeric" autocomplete="off" maxlength="10" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" placeholder="DD/MM/YYYY" value="'+F(current?.since||c.today)+'">')+
 field(L('Unserviceability reason','סיבת אי־שמישות'),'<textarea class="input" name="reason" id="fleetReason" rows="2" maxlength="500" placeholder="'+L('Describe fault or limitation','תיאור התקלה או המגבלה')+'">'+E(current?.reason||'')+'</textarea>','data-fleet-reason-field')+
 '</div><div class="toolbar fleetEditorActions"><button class="btn sky" type="submit">'+L(current?'Save changes':'Add aircraft',current?'שמור שינויים':'הוסף כלי טיס')+'</button><button type="button" class="btn secondary" id="fleetCancelEdit">'+L('Cancel','ביטול')+'</button></div></form></section>':'');
 return '<div class="fleetPage"><div class="fleetPageTop rosterTopbar"><div><div class="eyebrow">'+L('COURSE OPERATIONS','תפעול הקורס')+'</div><h1 class="pageTitle">'+L('Fleet','צי כלי טיס')+'</h1><p class="sub">'+E(c.courseLabel)+' · '+E(c.platformLabel)+'</p></div>'+(can?'<button class="btn '+(manage?'sky':'edit')+' fleetManageButton" type="button" id="fleetManageToggle">'+(manage?'✓ '+L('Done editing','סיום עריכה'):'✎ '+L('Manage','ניהול'))+'</button>':'')+'</div>'+
 '<section class="card fleetOverview">'+metrics(c.fleet,c.platformId)+'<p class="fleetQuiet">'+L('Only serviceable aircraft can be selected for the daily flight board. Changes to a scheduled aircraft are flagged there.','רק כלים שמישים זמינים לשיבוץ בלוח הטיסות. שינוי שמישות של כלי שכבר שובץ יסומן בלוח.')+'</p></section>'+
 '<section class="card fleetInventory"><div class="fleetSectionHead"><h2>'+L('Fleet inventory','מצבת כלי הטיס')+'</h2>'+(manage?'<button class="btn edit fleetAddBtn" type="button" data-fleet-add aria-label="'+L('Add aircraft','הוסף כלי טיס')+'">+ '+L('Add','הוסף')+'</button>':'')+'</div>'+
 '<div class="fleetInventoryFilter"><label for="fleetServiceFilter">'+L('Serviceability','שמישות')+'</label><select id="fleetServiceFilter" class="input" aria-label="'+L('Filter aircraft by serviceability','סינון כלי טיס לפי שמישות')+'">'+
 O('ALL',L('All aircraft','כל הכלים'),filter)+O(M.AVAILABLE,L('Serviceable','שמישים'),filter)+O(M.UNAVAILABLE,L('Unserviceable','לא שמישים'),filter)+'</select></div>'+
 (rows.length?'<div class="fleetTableWrap"><table class="fleetTable fleetInventoryTable"><thead><tr><th scope="col">'+L('Tail number','מספר זנב')+'</th><th scope="col">'+L('Status','שמישות')+'</th><th scope="col">'+L('Effective date','תאריך סטטוס')+'</th><th scope="col">'+L('Reason / history','סיבה / היסטוריה')+'</th>'+(manage?'<th scope="col" aria-label="'+L('Aircraft controls','אפשרויות עריכת כלי טיס')+'"></th>':'')+'</tr></thead><tbody>'+
 rows.map(x=>'<tr class="'+(x.status===M.UNAVAILABLE?'fleetRowDown':'')+'" data-fleet-status="'+E(x.status)+'" '+(filter!=='ALL'&&x.status!==filter?'hidden':'')+'><td data-label="'+L('Tail number','מספר זנב')+'" class="fleetInventoryTail">'+E(aircraftDisplayName(c,x.tail))+'</td><td data-label="'+L('Status','שמישות')+'">'+statusBadge(x.status)+'</td><td data-label="'+L('Effective date','תאריך סטטוס')+'" class="fleetDate">'+F(x.since)+'</td><td data-label="'+L('Reason / history','סיבה / היסטוריה')+'" class="fleetReasonCell">'+(x.reason?'<span class="fleetReasonText">'+E(x.reason)+'</span>':'<span class="fleetMuted">—</span>')+history(x)+'</td>'+(manage?'<td class="fleetInventoryActionsCell"><div class="fleetItemActions"><button type="button" class="btn edit small" data-fleet-edit="'+E(x.id)+'">✎ '+L('Edit','עריכה')+'</button><button type="button" class="btn danger small" data-fleet-archive="'+E(x.id)+'">'+L('Remove','הסר')+'</button></div></td>':'')+'</tr>'+(manage&&current?.id===x.id?'<tr class="fleetInlineEditRow" data-fleet-inline-editor="'+E(x.id)+'"><td class="fleetInlineEditorCell" colspan="5">'+editorHtml+'</td></tr>':'')).join('')+'</tbody></table></div><p class="fleetFilterEmpty" id="fleetFilteredEmpty" '+(shown.length?'hidden':'')+'>'+L('No aircraft match the selected status.','אין כלי טיס התואמים לסינון שנבחר.')+'</p>':
 '<div class="fleetEmpty"><span aria-hidden="true">✈</span><strong>'+L('No aircraft registered','לא נרשמו כלי טיס')+'</strong><p>'+L('Add the first aircraft to start tracking serviceability.','הוסף את הכלי הראשון לניהול השמישויות.')+'</p></div>')+
 '</section>'+
 (can&&!current?editorHtml:'')+
 '</div>';
}
function schedule(c){
 const available=M.active(c.fleet,c.platformId).filter(x=>x.status===M.AVAILABLE);
 const flights=c.flights.filter(x=>x.date===c.date&&String(x.platformId)===String(c.platformId)).sort((a,b)=>a.time.localeCompare(b.time));
 const studentPictogram="<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path d=\"m12 3 11 5-11 5L1 8l11-5Zm-6 9.2V16c3.6 2.6 8.4 2.6 12 0v-3.8l-6 2.8-6-2.8ZM21 10v6h-2v-6h2Z\"/></svg>";
 const teacherPictogram="<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M9 3h13v11h-7v-2h5V5H9v2H7V3h2Zm3 3h6v2h-6V6Zm-3.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM2 22v-1a5.5 5.5 0 0 1 11 0v1H2Zm12-5 3-3 1.4 1.4-3 3L14 17Z\"/></svg>";
 const crewLine=(role,name)=>'<span class="fleetSortiePerson fleetSortiePerson-'+role+'"><span class="fleetSortiePersonIcon" aria-hidden="true">'+(role==='student'?studentPictogram:teacherPictogram)+'</span><span>'+E(name)+'</span></span>';
 const miniMoment=(type,time,label)=>'<span class="fleetSortieMiniMoment fleetSortieMini-'+type+'"><b data-flight-slot-clock="'+type+'">'+E(time||'—')+'</b><em>'+E(label)+'</em></span>';

 const current=flights.find(x=>x.id===c.editId),can=c.canWrite;
 const mode=current?.mode||'INSTRUCTED',timing=M.configuredTimings(c.timingDefaults,mode);
 const briefing=current?.briefingMinutes??timing.briefingMinutes,debrief=current?.debriefMinutes??timing.debriefMinutes;
 const duration=current?.estimatedMinutes??timing.estimatedMinutes,depart=current?.time||'08:00';
 const timeline=M.flightTimeline({date:c.date,time:depart,mode,estimatedMinutes:duration,briefingMinutes:briefing,debriefMinutes:debrief},c.timingDefaults);
 const select=(name,items,value,required=true)=>'<select class="input" name="'+name+'" '+(required?'required':'')+'><option value="" disabled '+(!value?'selected':'')+'>'+L('Select','בחר')+'</option>'+items.map(x=>O(x.id,x.name||x.tail,value)).join('')+'</select>';
 const field=(label,inner,extra='',action='')=>'<div class="field" '+extra+'><div class="fleetFieldHead"><label>'+label+'</label>'+action+'</div>'+inner+'</div>';
 const requiredLabel=label=>label+' <span class="fleetRequired" aria-hidden="true">*</span>';
 const iconSvg=(content,extraClass='')=>'<svg class="fleetTimeFlowIcon'+(extraClass?' '+extraClass:'')+'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+content+'</svg>';
 const iconBrief=iconSvg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>');
 // Right-facing swept wings and split tail follow the instructor-card reference.
 // A closed, unfilled contour keeps the fuselage hollow at small icon sizes.
 const iconFlight=iconSvg('<path d="M21.5 10.5C22.65 10.5 23 11.15 23 12S22.65 13.5 21.5 13.5H14L8.4 22H6.4L10.2 13.5H4L2.2 15.5H1L2.1 12L1 8.5H2.2L4 10.5H10.2L6.4 2H8.4L14 10.5Z"/>','fleetTimeFlowFlightIcon');
 const iconDebrief=iconSvg('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="m9 13 2.2 2.2L16 10.5"/>');
 const phase=(key,label,icon)=>'<span data-phase="'+key+'"><span class="fleetTimeFlowPhaseLabel">'+icon+'<span class="fleetTimeFlowPhaseText">'+label+'</span></span></span>';
 const timeMark=(key,label,part)=>'<div class="fleetTimeFlowClock fleetTimeFlowClock'+part+'" role="group" aria-label="'+E(label)+'"><span class="fleetTimeFlowClockA11y">'+E(label)+'</span><strong dir="ltr" data-flight-clock="'+key+'">'+E(timeline?.clock[key]||'—')+'</strong></div>';
 const timelineBlock='<div class="fleetTimeFlow" aria-live="polite" style="--phase-brief:'+Math.max(0,Number(briefing))+'fr;--phase-flight:'+Math.max(0,Number(duration))+'fr;--phase-debrief:'+Math.max(0,Number(debrief))+'fr"><div class="fleetTimeFlowHeading"><b>'+L('Calculated timeline','ציר זמנים מחושב')+'</b><small>'+L('Instructor and trainee are reserved from briefing to the end of debriefing','המדריך והחניך משוריינים מתחילת התדריך ועד לסיום התחקיר')+'</small></div>'+
  '<div class="fleetTimeFlowBody"><div class="fleetTimeFlowTrack">'+phase('brief',L('Briefing','תדריך'),iconBrief)+phase('flight',L('Flight','טיסה'),iconFlight)+phase('debrief',L('Debriefing','תחקיר'),iconDebrief)+'</div>'+
  '<div class="fleetTimeFlowBoundaryTimes">'+timeMark('briefing',L('Briefing start','תחילת תדריך'),'Start')+timeMark('takeoff',L('Takeoff','המראה'),'Takeoff')+timeMark('landing',L('Landing','נחיתה'),'Landing')+timeMark('debrief',L('Debriefing end','סיום תחקיר'),'End')+'</div>'+  '<svg class="fleetTimeFlowLeaders" aria-hidden="true" focusable="false"></svg><div class="fleetTimeFlowFloatingLabels"></div></div>'+  '<div class="fleetTimeFlowFallback" hidden></div><div class="fleetTimeFlowDetails" role="status" hidden></div></div>';
 const booked=flights.length?'<section class="fleetBookedFlights"><div class="fleetBookedHeading"><h3>'+(c.draftMode?L('Proposed flights','טיסות מוצעות'):L('Scheduled flights','טיסות משובצות'))+'</h3><span>'+flights.length+'</span></div>'+(can&&flights.length>1?'<p class="fleetSortieDragHelp">'+L('Drag the grip to change takeoff slots. Conflicting assignments are rejected.','גררו את הידית לשינוי סדר משבצות ההמראה. שיבוץ שיוצר חפיפה יידחה.')+'</p>':'')+'<div class="fleetSorties" data-flight-sorties>'+flights.map(f=>{
  const issue=M.flightIssues(f,c.fleet,c.platformId),t=M.flightTimeline(f,c.timingDefaults);
  return '<div class="fleetSortie '+(issue?'conflict':'')+'" data-flight-id="'+E(f.id)+'"><div class="fleetSortieSlide">'+
 (can&&flights.length>1?'<button type="button" class="fleetSortieDragHandle" data-flight-drag aria-label="'+E(L('Drag to reschedule flight at ','גרור לשינוי שיבוץ הטיסה בשעה ')+f.time)+'" title="'+E(L('Drag to change takeoff time','גרור לשינוי שעת המראה'))+'"><svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></button>':'')+
 '<div class="fleetSortieMain"><b class="fleetSortieSlotSync" data-flight-slot-time aria-hidden="true">'+E(f.time)+'</b>'+
 '<div class="fleetSortieCrew">'+crewLine('student',f.traineeName||f.traineeId)+(f.mode!=='SOLO'&&f.instructorName?crewLine('teacher',f.instructorName):'')+
 '<small class="fleetSortieSyllabus">'+E(f.syllabus)+' · '+E(aircraftDisplayName(c,f.tail))+'</small>'+
 (f.note?'<small class="fleetSortieNote">'+E(f.note)+'</small>':'')+(issue?'<small class="fleetConflict">'+E(issue)+'</small>':'')+'</div>'+
 '<small data-flight-slot-details class="fleetSortieMiniTimeline">'+
 miniMoment('briefing',t?.clock.briefing,L('Briefing','תדריך'))+
 miniMoment('flight',t?.clock.takeoff||f.time,L('Flight','טיסה'))+
 miniMoment('debrief',t?.clock.landing,L('Debriefing','תחקיר'))+
 '</small></div>'+
 '<span class="fleetSortieMode '+(f.mode==='SOLO'?'solo':'instructed')+'">'+L(f.mode==='SOLO'?'Solo':'Instructed',f.mode==='SOLO'?'סולו':'מודרכת')+'</span>'+
 (can?'<div class="fleetSortieActions"><button class="btn edit small" type="button" data-flight-edit="'+E(f.id)+'">✎ '+L('Edit','ערוך')+'</button><button class="btn danger small" type="button" data-flight-delete="'+E(f.id)+'">'+L('Remove','הסר')+'</button></div>':'')+'</div></div>';
 }).join('')+'</div></section>':'';
 const settings=c.timingDefaults||M.TIMING_DEFAULTS;
 const defaultsBlock=c.canConfigureTiming?'<details class="fleetTimingSettings"><summary>'+L('Edit course timing defaults','עריכת ברירות מחדל לזמני הטיסה')+'</summary><form id="fleetTimingDefaultsForm"><div class="fleetTimingSettingsGrid">'+
  ['INSTRUCTED','SOLO'].map(type=>'<section class="fleetTimingModeGroup fleetTimingMode'+type+'"><div class="fleetTimingModeHeader"><strong>'+L(type==='INSTRUCTED'?'Instructed flights':'Solo flights',type==='INSTRUCTED'?'טיסות מודרכות':'טיסות סולו')+'</strong></div><div class="fleetTimingModeFields">'+
   ['briefingMinutes','estimatedMinutes','debriefMinutes'].map(key=>
    field(key==='briefingMinutes'?L('Briefing','תדריך'):key==='estimatedMinutes'?L('Flight duration','משך טיסה'):L('Debriefing','תחקיר'),minuteSelect(type+'_'+key,M.configuredTimings(settings,type)[key]))
   ).join('')+'</div></section>').join('')+
 '</div><button class="btn secondary small" type="submit">'+L('Save defaults','שמור ברירות מחדל')+'</button><p class="sub">'+L('Applies to newly scheduled flights. Existing flight times stay unchanged.','חל על שיבוצים חדשים; משכי טיסות שכבר נקבעו לא משתנים.')+'</p></form></details>':'';
 return '<div class="fleetSchedule fleetSchedulePlain" id="fleetFlightBoard">'+
 defaultsBlock+
 (can?'<form id="fleetSortieForm" class="fleetSortieForm"><div class="fleetPlanFormHeading"><div><h2>'+L(current?'Edit scheduled flight':'Add scheduled flight',current?'עריכת טיסה משובצת':'הוספת טיסה מתוכננת')+'</h2><p>'+L('Plan the complete flight, including briefing and debriefing.','תכנן את כל הטיסה, כולל תדריך ותחקיר.')+'</p></div></div>'+
 '<input type="hidden" name="id" value="'+E(current?.id||'')+'"><div class="fleetSortieFormGrid">'+
 field(L('Takeoff time','שעת המראה'),'<input class="input" name="time" type="time" required value="'+E(depart)+'">')+
 field(L('Aircraft','כלי טיס'),select('aircraftId',available.map(x=>({id:x.id,name:aircraftDisplayName(c,x.tail)})),current?.aircraftId||''),'','<button class="fleetInlineFleet" type="button" data-go="fleet">'+L('Open Fleet','פתח צי כלי טיס')+' ↗</button>')+
 field(L('Flight type','סוג טיסה'),'<select class="input" name="mode" id="fleetFlightMode">'+O('INSTRUCTED',L('Instructed','מודרכת'),mode)+O('SOLO',L('Solo','סולו'),mode)+'</select>')+
 field(L('Trainee','חניך'),select('traineeId',c.trainees,current?.traineeId||''))+
 '<div class="field" data-fleet-instructor-field><div class="fleetFieldHead"><label>'+requiredLabel(L('Instructor','מדריך'))+'</label></div>'+select('instructorId',c.instructors,current?.instructorId||'',false)+'</div>'+
 field(L('Syllabus','סילבוס'),select('syllabus',c.syllabi.map(s=>({id:s,name:s})),current?.syllabus||''))+
 '<fieldset class="fleetFlightDurations"><legend>'+L('Flight timing','זמני הטיסה')+'</legend><div class="fleetFlightDurationsGrid">'+
 field(L('Briefing','תדריך'),minuteSelect('briefingMinutes',briefing))+
 field(L('Flight duration','משך טיסה'),minuteSelect('estimatedMinutes',duration))+
 field(L('Debriefing','תחקיר'),minuteSelect('debriefMinutes',debrief))+
 '</div></fieldset>'+
 field(L('Planning notes (optional)','הערות לתכנון (לא חובה)'),'<textarea class="input" name="note" rows="2" maxlength="500" placeholder="'+L('Flight planning notes','הערות לתכנון הטיסה')+'">'+E(current?.note||'')+'</textarea>','data-plan-notes')+
 '</div>'+timelineBlock+'<div class="toolbar fleetPlanFormActions"><button class="btn sky" type="submit" '+(!available.length?'disabled':'')+'>'+(c.draftMode?L(current?'Save draft changes':'Add to draft',current?'שמירת שינויים בטיוטה':'הוספה לטיוטה'):L(current?'Save changes':'Add to board',current?'שמור שינויים':'הוסף ללוח'))+'</button>'+(current?'<button class="btn secondary" type="button" id="fleetFlightCancel">'+L('Cancel','ביטול')+'</button>':'')+'</div>'+
 (available.length?'':'<p class="fleetConflict">'+L('No serviceable aircraft. Update fleet status first.','אין כלים שמישים. יש לעדכן תחילה את לוח השמישויות.')+'</p>')+'<p class="fleetPlanScopeNote" role="note">'+(c.draftMode?L('Save flights to your draft, then send the complete day for instructor approval.','שמור טיסות בטיוטה, ואז שלח את התכנון היומי המלא לאישור מדריך.'):c.sharedMode?L('Changes are saved to the shared course plan.','השינויים נשמרים בתכנון הקורס המשותף.'):L('Conflict checks currently cover flights saved on this device only. Shared scheduling across devices is not yet enabled.','בדיקות חפיפה כוללות כעת רק טיסות השמורות במכשיר זה. שיבוץ משותף בין מכשירים עדיין אינו פעיל.'))+'</p></form>':'')+
 booked+'</div>';
}


/* Keep focused Fleet fields clear of the iOS keyboard and shared bottom dock.
   VisualViewport resizes after focus, so a single scrollIntoView is not enough. */
function installFleetEditorViewportGuard(){
 const doc=root.document;
 if(!doc?.addEventListener)return;
 let focused=null,pending=null;
 const reveal=()=>{
  const el=focused;
  if(!el?.isConnected||!el.closest?.('#fleetAircraftForm'))return;
  const vv=root.visualViewport,fullHeight=root.innerHeight||doc.documentElement?.clientHeight||0;
  const top=vv?.offsetTop||0,bottom=top+(vv?.height||fullHeight);
  const keyboardOpen=!!(vv&&vv.height<fullHeight-110);
  const safeTop=top+20,safeBottom=bottom-(keyboardOpen?28:104);
  if(safeBottom<=safeTop)return;
  const rect=el.getBoundingClientRect();
  const amount=rect.bottom>safeBottom?rect.bottom-safeBottom+6:rect.top<safeTop?rect.top-safeTop-6:0;
  if(Math.abs(amount)>4)root.scrollBy?.({top:amount,behavior:'auto'});
 };
 const queue=()=>{
  if(pending!==null)root.clearTimeout?.(pending);
  if(root.setTimeout)pending=root.setTimeout(()=>{pending=null;reveal()},140);
  else reveal();
 };
 doc.addEventListener('focusin',event=>{
  const el=event.target;
  if(!el?.matches?.('#fleetAircraftForm input:not([type="hidden"]), #fleetAircraftForm select, #fleetAircraftForm textarea'))return;
  focused=el;
  queue();
  root.setTimeout?.(reveal,420);
 });
 doc.addEventListener('focusout',event=>{if(event.target===focused)focused=null});
 root.visualViewport?.addEventListener?.('resize',queue);
 root.visualViewport?.addEventListener?.('scroll',queue);
}
installFleetEditorViewportGuard();

root.FLYMPUS_FLEET_VIEW=Object.freeze({home,fleet,schedule});
})(window);
