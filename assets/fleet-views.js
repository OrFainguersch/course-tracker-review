(function(root){
'use strict';
const M=root.FLYMPUS_FLEET_MODEL;
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=(en,he)=>root.FLYMPUS_FLEET_LANGUAGE?.()==='he'?he:en;
const F=d=>/^\d{4}-\d\d-\d\d$/.test(String(d||''))?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'—';
const O=(value,label,selected)=>'<option value="'+E(value)+'" '+(String(value)===String(selected)?'selected':'')+'>'+E(label)+'</option>';
const status=s=>s===M.AVAILABLE?L('Serviceable','שמיש'):L('Unserviceable','לא שמיש');
const statusBadge=s=>'<span class="fleetStatusBadge '+(s===M.AVAILABLE?'ready':'down')+'"><i aria-hidden="true"></i>'+status(s)+'</span>';
const metrics=(rows,platform)=>{
 const c=M.count(rows,platform);
 return '<div class="fleetStats" aria-label="'+L('Fleet totals','סיכום מצבת כלים')+'"><span><b>'+c.total+'</b> '+L('Total aircraft','כלים בסך הכול')+'</span><span class="ready"><b>'+c.serviceable+'</b> '+L('Serviceable','שמישים')+'</span><span class="down"><b>'+c.unserviceable+'</b> '+L('Unserviceable','לא שמישים')+'</span></div>';
};
function home(c){
 const rows=M.active(c.fleet,c.platformId),counts=M.count(c.fleet,c.platformId),shown=rows.slice(0,6);
 const body=shown.map(x=>'<tr class="'+(x.status===M.UNAVAILABLE?'fleetRowDown':'')+'"><td class="fleetHomeTail">'+E(x.tail)+'</td><td>'+statusBadge(x.status)+(x.reason?'<small class="fleetCellReason" title="'+E(x.reason)+'">'+E(x.reason)+'</small>':'')+'</td><td class="fleetDate">'+F(x.since)+'</td></tr>').join('');
 return '<section class="homePanel homePanelPad fleetHomePanel" data-fleet-home>'+
  '<div class="homeBlockHead"><div class="homeBlockTitle"><div><h2>'+L('Aircraft Serviceability','שמישויות כלי טיס')+'</h2><p>'+E(c.platformLabel)+' · '+L('Fleet status','מצב צי הכלים')+'</p></div></div><button type="button" class="homeInlineLink" data-go="fleet">'+L('Manage','ניהול')+'</button></div>'+
  '<div class="fleetHomeSummary"><span class="fleetHomeCount '+(counts.unserviceable?'hasDown':'')+'"><b>'+counts.serviceable+'</b> / '+counts.total+' '+L('serviceable','שמישים')+'</span>'+(counts.unserviceable?'<span class="fleetHomeWarning">'+counts.unserviceable+' '+L('unserviceable','לא שמישים')+'</span>':'')+'</div>'+
  (rows.length?'<div class="fleetTableWrap fleetHomeTableWrap"><table class="fleetTable fleetHomeTable"><thead><tr><th scope="col">'+L('Aircraft','כלי טיס')+'</th><th scope="col">'+L('Status / reason','סטטוס / סיבה')+'</th><th scope="col">'+L('Since','מתאריך')+'</th></tr></thead><tbody>'+body+'</tbody></table></div>'+(rows.length>shown.length?'<p class="fleetHomeMore">'+L('Showing','מוצגים')+' '+shown.length+' '+L('of','מתוך')+' '+rows.length+' · '+L('Open board for all aircraft','פתח את הלוח להצגת כל הכלים')+'</p>':''):'<p class="fleetQuiet">'+L('No aircraft registered. Open Manage to add your fleet.','טרם נרשמו כלים. ניתן להוסיף אותם דרך ניהול השמישויות.')+'</p>')+
  '</section>';
}
function fleet(c){
 const rows=M.active(c.fleet,c.platformId),current=rows.find(x=>x.id===c.editId),can=c.canWrite;
 const field=(label,input,extra='')=>'<div class="field" '+extra+'><label>'+label+'</label>'+input+'</div>';
 const history=x=>x.history?.length>1?'<details class="fleetHistory"><summary>'+L('Status history','היסטוריית שמישות')+' ('+x.history.length+')</summary><div class="fleetHistoryList">'+x.history.slice().reverse().map(h=>'<p><strong>'+status(h.status)+'</strong> · '+F(h.since)+(h.reason?' · '+E(h.reason):'')+(h.recordedBy?' · '+E(h.recordedBy):'')+'</p>').join('')+'</div></details>':'';
 return '<div class="fleetPage"><div class="fleetPageTop"><div><div class="eyebrow">'+L('COURSE OPERATIONS','תפעול הקורס')+'</div><h1 class="pageTitle">'+L('Aircraft Serviceability','שמישויות כלי טיס')+'</h1><p class="sub">'+E(c.courseLabel)+' · '+E(c.platformLabel)+'</p></div>'+(can?'<button class="btn sky fleetAddBtn" type="button" data-fleet-add>+ '+L('Add aircraft','הוסף כלי טיס')+'</button>':'')+'</div>'+
 '<section class="card fleetOverview">'+metrics(c.fleet,c.platformId)+'<p class="fleetQuiet">'+L('Only serviceable aircraft can be selected for the daily flight board. Changes to a scheduled aircraft are flagged there.','רק כלים שמישים זמינים לשיבוץ בלוח הטיסות. שינוי שמישות של כלי שכבר שובץ יסומן בלוח.')+'</p></section>'+
 '<section class="card fleetInventory"><div class="fleetSectionHead"><h2>'+L('Fleet inventory','מצבת כלי הטיס')+'</h2><span class="fleetInventoryCount">'+rows.length+' '+L('aircraft','כלים')+'</span></div>'+
 (rows.length?'<div class="fleetTableWrap"><table class="fleetTable fleetInventoryTable"><thead><tr><th scope="col">'+L('Aircraft','כלי טיס')+'</th><th scope="col">'+L('Status','שמישות')+'</th><th scope="col">'+L('Effective date','תאריך סטטוס')+'</th><th scope="col">'+L('Reason / history','סיבה / היסטוריה')+'</th>'+(can?'<th scope="col">'+L('Actions','פעולות')+'</th>':'')+'</tr></thead><tbody>'+
 rows.map(x=>'<tr class="'+(x.status===M.UNAVAILABLE?'fleetRowDown':'')+'"><td data-label="'+L('Aircraft','כלי טיס')+'" class="fleetInventoryTail">'+E(x.tail)+'</td><td data-label="'+L('Status','שמישות')+'">'+statusBadge(x.status)+'</td><td data-label="'+L('Effective date','תאריך סטטוס')+'" class="fleetDate">'+F(x.since)+'</td><td data-label="'+L('Reason / history','סיבה / היסטוריה')+'" class="fleetReasonCell">'+(x.reason?'<span class="fleetReasonText">'+E(x.reason)+'</span>':'<span class="fleetMuted">—</span>')+history(x)+'</td>'+(can?'<td data-label="'+L('Actions','פעולות')+'"><div class="fleetItemActions"><button type="button" class="btn secondary small" data-fleet-edit="'+E(x.id)+'">'+L('Edit','עריכה')+'</button><button type="button" class="btn danger small" data-fleet-archive="'+E(x.id)+'">'+L('Remove','הסר')+'</button></div></td>':'')+'</tr>').join('')+'</tbody></table></div>':
 '<div class="fleetEmpty"><span aria-hidden="true">✈</span><strong>'+L('No aircraft registered','לא נרשמו כלי טיס')+'</strong><p>'+L('Add the first aircraft to start tracking serviceability.','הוסף את הכלי הראשון לניהול השמישויות.')+'</p></div>')+
 '</section>'+
 (can?'<section class="card fleetEditor" id="fleetEditorPanel" '+(current?'':'hidden')+'><div class="fleetSectionHead"><h2>'+L(current?'Edit aircraft':'Add aircraft',current?'עריכת כלי טיס':'הוספת כלי טיס')+'</h2><button type="button" class="btn secondary small" id="fleetCancelEdit">'+L('Close','סגור')+'</button></div><form id="fleetAircraftForm"><input name="id" type="hidden" value="'+E(current?.id||'')+'"><div class="fleetFormGrid">'+
 field(L('Aircraft number','מספר כלי טיס'),'<input class="input" name="tail" maxlength="48" required placeholder="01" value="'+E(current?.tail||'')+'">')+
 field(L('Serviceability','שמישות'),'<select class="input" name="status" id="fleetStatus">'+O(M.AVAILABLE,status(M.AVAILABLE),current?.status||M.AVAILABLE)+O(M.UNAVAILABLE,status(M.UNAVAILABLE),current?.status)+'</select>')+
 field(L('Effective date','תאריך שינוי סטטוס'),'<input class="input dateDmy" type="text" name="since" required inputmode="numeric" autocomplete="off" maxlength="10" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" placeholder="DD/MM/YYYY" value="'+F(current?.since||c.today)+'">')+
 field(L('Unserviceability reason','סיבת אי־שמישות'),'<textarea class="input" name="reason" id="fleetReason" rows="2" maxlength="500" placeholder="'+L('Describe fault or limitation','תיאור התקלה או המגבלה')+'">'+E(current?.reason||'')+'</textarea>','data-fleet-reason-field')+
 '</div><div class="toolbar"><button class="btn sky" type="submit">'+L(current?'Save changes':'Add aircraft',current?'שמור שינויים':'הוסף כלי טיס')+'</button></div></form></section>':'')+
 '</div>';
}
function schedule(c){
 const available=M.active(c.fleet,c.platformId).filter(x=>x.status===M.AVAILABLE);
 const flights=c.flights.filter(x=>x.date===c.date&&x.platformId===c.platformId).sort((a,b)=>a.time.localeCompare(b.time));
 const current=flights.find(x=>x.id===c.editId),can=c.canWrite;
 const select=(name,items,value,required=true)=>'<select class="input" name="'+name+'" '+(required?'required':'')+'><option value="" disabled '+(!value?'selected':'')+'>'+L('Select','בחר')+'</option>'+items.map(x=>O(x.id,x.name||x.tail,value)).join('')+'</select>';
 const field=(label,inner)=>'<div class="field"><label>'+label+'</label>'+inner+'</div>';
 return '<section class="card fleetSchedule" id="fleetFlightBoard"><div class="fleetSectionHead"><div><h2>'+L('Daily Flight Board','לוח טיסות יומי')+'</h2><p class="sub">'+F(c.date)+' · '+E(c.platformLabel)+'</p></div><button class="btn secondary small" type="button" data-go="fleet">'+L('Serviceability','שמישויות')+'</button></div><p class="fleetQuiet">'+L('Only serviceable aircraft can be selected. Existing flights are flagged if an aircraft becomes unavailable.','ניתן לשבץ רק כלים שמישים; שיבוצים קיימים יסומנו אם כלי יוצא משמישות.')+'</p>'+
 '<div class="fleetSorties">'+(flights.length?flights.map(f=>{const issue=M.flightIssues(f,c.fleet,c.platformId);
 return '<div class="fleetSortie '+(issue?'conflict':'')+'"><div class="fleetSortieMain"><b>'+E(f.time)+'</b><b class="fleetSortieTail">'+E(f.tail)+'</b><div><strong>'+E(f.traineeName||f.traineeId)+'</strong><small>'+E(f.syllabus)+' · '+(f.mode==='SOLO'?'Solo':L('Instructed','מודרכת'))+(f.instructorName?' · '+E(f.instructorName):'')+'</small>'+(issue?'<small class="fleetConflict">'+E(issue)+'</small>':'')+'</div></div>'+(can?'<div class="fleetSortieActions"><button class="btn secondary small" type="button" data-flight-edit="'+E(f.id)+'">'+L('Edit','ערוך')+'</button><button class="btn danger small" type="button" data-flight-delete="'+E(f.id)+'">'+L('Remove','הסר')+'</button></div>':'')+'</div>';
 }).join(''):'<p class="fleetQuiet">'+L('No scheduled flights for this day.','אין טיסות משובצות לתאריך זה.')+'</p>')+'</div>'+
 (can?'<form id="fleetSortieForm" class="fleetSortieForm"><h3>'+L(current?'Edit scheduled flight':'Add scheduled flight',current?'עריכת שיבוץ':'הוספת שיבוץ')+'</h3><input type="hidden" name="id" value="'+E(current?.id||'')+'"><div class="fleetSortieFormGrid">'+
 field(L('Takeoff time','שעת המראה'),'<input class="input" name="time" type="time" required value="'+E(current?.time||'08:00')+'">')+
 field(L('Aircraft','כלי טיס'),select('aircraftId',available.map(x=>({id:x.id,name:x.tail})),current?.aircraftId||''))+
 field(L('Flight type','סוג טיסה'),'<select class="input" name="mode" id="fleetFlightMode">'+O('INSTRUCTED',L('Instructed','מודרכת'),current?.mode||'INSTRUCTED')+O('SOLO',L('Solo','סולו'),current?.mode)+'</select>')+
 field(L('Trainee','חניך'),select('traineeId',c.trainees,current?.traineeId||''))+
 '<div class="field" data-fleet-instructor-field><label>'+L('Instructor','מדריך')+'</label>'+select('instructorId',c.instructors,current?.instructorId||'',false)+'</div>'+
 field(L('Syllabus','סילבוס'),select('syllabus',c.syllabi.map(s=>({id:s,name:s})),current?.syllabus||''))+
 '</div><div class="toolbar"><button class="btn sky small" type="submit" '+(!available.length?'disabled':'')+'>'+L(current?'Save flight':'Add to board',current?'שמור טיסה':'הוסף ללוח')+'</button>'+(current?'<button class="btn secondary small" type="button" id="fleetFlightCancel">'+L('Cancel','ביטול')+'</button>':'')+'</div>'+(available.length?'':'<p class="fleetConflict">'+L('No serviceable aircraft. Update fleet status first.','אין כלים שמישים. יש לעדכן תחילה את לוח השמישויות.')+'</p>')+'</form>':'')+'</section>';
}
root.FLYMPUS_FLEET_VIEW=Object.freeze({home,fleet,schedule});
})(window);