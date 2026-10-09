/* Instructor approval UI and working copies. Official data is read-only here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FLYMPUS_COURSE_OPERATIONS=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function create(env){
  const M=env.model,E=env.escape,L=(en,he)=>env.language()==='he'?he:en;
  let identity='',watchIndex=null,watchCourse=null,watching='',courses=[],course=null,fleet=null,days=[],requests=[],error='',renderTimer=null,busy=false,generation=0,requestSnapshotReady=false,focusedRequest='',notifiedEvents=new Set(),submitSounds=new Set();
  const cloud=()=>env.cloud(),uid=()=>cloud()?.uid?.()||'',current=()=>String(env.courseId()),date=()=>env.date(),member=()=>course?.members?.[uid()],enabled=()=>Boolean(member()&&fleet);
  const day=d=>days.find(x=>x.date===d)||M.emptyDay(d);
  const redraw=()=>{if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;env.render();},40);};
  const pending=(kind,d=date())=>requests.find(r=>r.kind===kind&&r.date===d&&r.status==='PENDING'&&r.submittedBy===uid());
  const latest=(kind,d=date())=>requests.filter(r=>r.kind===kind&&r.date===d&&r.submittedBy===uid()).sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)))[0];
  const readDraft=(kind,d=date())=>env.readDrafts()?.[d]?.[kind]||null;
  function saveDraft(kind,value,d=date()){
   if(pending(kind,d))throw new Error(L('Withdraw the pending request before editing','יש לבטל את הבקשה הממתינה לפני עריכה'));
   const all=env.readDrafts(),prior=all[d]?.[kind];
   all[d]={...(all[d]||{}),[kind]:{...prior,baseRevision:prior?.baseRevision??day(d).revision,value:M.clone(value),requestId:prior&&M.same(prior.value,value)?prior.requestId||'':''}};
   if(!env.writeDrafts(all))throw new Error(L('Unable to save this draft on the device','לא ניתן לשמור את הטיוטה במכשיר'));
  }
  function clearDraft(kind,d){const all=env.readDrafts();if(all[d]){delete all[d][kind];if(!Object.keys(all[d]).length)delete all[d];env.writeDrafts(all);}}
  function savePlanForm(value,d=date()){
   if(pending('PLAN',d))return;
   const all=env.readDrafts(),prior=all[d]?.PLAN||{baseRevision:day(d).revision,value:{flights:workingFlights(d).filter(x=>x.date===d)},requestId:''};
   all[d]={...(all[d]||{}),PLAN:{...prior,forms:{...(prior.forms||{}),[value.id||'new']:M.clone(value)}}};
   if(!env.writeDrafts(all))throw new Error(L('Unable to save flight fields on the device','לא ניתן לשמור את שדות הטיסה במכשיר'));
  }
  function clearPlanForm(id,d=date()){const all=env.readDrafts(),draft=all[d]?.PLAN;if(draft?.forms){delete draft.forms[id||'new'];env.writeDrafts(all);}}
  function stop(){generation++;requestSnapshotReady=false;focusedRequest='';notifiedEvents.clear();submitSounds.clear();rosterSync={key:'',signature:'',checkedAt:0,busy:false,error:'',missing:[]};if(renderTimer)clearTimeout(renderTimer);renderTimer=null;watchIndex?.();watchCourse?.();watchIndex=watchCourse=null;watching=identity='';courses=[];course=fleet=null;days=[];requests=[];error='';env.sharedCourses([]);}
  let rosterSync={key:'',signature:'',checkedAt:0,busy:false,error:'',missing:[]};
  async function reconcile(){
   const c=cloud(),key=current(),actor=c?.uid?.(),epoch=generation,session=rosterSync;
   if(!c?.ready?.()||!c.manager?.()||env.isDuty()||!env.autoEnrollmentAllowed?.()||!key||!actor||session.busy)return;
   const context=env.contextSnapshot?.();
   if(!context?.courseMeta?.courseName||!Array.isArray(context.instructors)||!Array.isArray(context.trainees))return;
   const signature=JSON.stringify(context),now=Date.now();
   if(session.key===key&&session.signature===signature&&now-session.checkedAt<60000)return;
   session.key=key;session.signature=signature;session.checkedAt=now;session.busy=true;
   const currentSession=()=>rosterSync===session&&generation===epoch&&cloud()===c&&c.uid()===actor&&current()===key&&c.manager?.();
   try{
    const preview=await c.preview(context);
    if(!currentSession())return;
    const existing=await c.course(key);
    if(!currentSession())return;
    const members=Object.fromEntries(preview.matched.map(p=>[p.uid,{role:p.role,personId:p.personId||'',name:p.name}]));
    const clean={...context,trainees:context.trainees.map(({email,...person})=>person),instructors:context.instructors.map(({email,...person})=>person)};
    const changed=!existing||existing.name!==context.courseMeta.courseName||
     JSON.stringify(existing.members)!==JSON.stringify(members)||
     JSON.stringify(existing.context)!==JSON.stringify(clean);
    if(changed){
     // Seed only the initial link: re-enrollment cannot overwrite approved days, fleet or requests.
     const seeds=existing?[]:env.seedDays();
     if(seeds.length>200)throw new Error('More than 200 existing operation days require controlled migration; nothing was changed');
     if(!currentSession())return;
     await c.enroll(key,context,preview,env.fleetSnapshot(),seeds);
    }
    if(currentSession()){session.error='';session.missing=preview.missing||[];if(changed)redraw();}
   }catch(e){
    if(currentSession()){session.error=String(e?.message||e);session.checkedAt=Date.now()-45000;redraw();}
   }finally{
    session.busy=false;
    // An asynchronous response must never enroll a course switched away from.
    if(rosterSync===session&&current()!==key&&c.ready?.()&&c.manager?.())void reconcile();
   }
  }
  function connect(){
   const c=cloud();if(!c?.ready?.()){if(identity)stop();return;}
   if(identity&&identity!==c.uid())stop();
   if(c.manager?.()&&!env.isDuty())void reconcile();
   if(!watchIndex){identity=c.uid();const session=identity,epoch=generation;watchIndex=c.watchCourses(rows=>{if(identity!==session||generation!==epoch)return;courses=rows;env.sharedCourses(rows);redraw();},e=>{if(identity!==session||generation!==epoch)return;error=e.message||'Could not load course approvals';redraw();});}
   const id=current(),enrolled=courses.find(x=>x.courseId===id);
   if(!enrolled){if(watchCourse){watchCourse();watchCourse=null;}watching='';course=fleet=null;days=[];requests=[];requestSnapshotReady=false;return;}
   if(watching===id)return;
   watchCourse?.();course=enrolled;fleet=null;days=[];requests=[];watching=id;error='';requestSnapshotReady=false;focusedRequest='';
   const session=identity,epoch=generation,guard=fn=>value=>{if(identity===session&&generation===epoch&&watching===id)fn(value);};
   const callbacks={
    course:v=>{course=v;if(!v?.members?.[identity]){watchCourse?.();watchCourse=null;watching='';fleet=null;days=[];requests=[];}redraw();},
    fleet:v=>{fleet=v;redraw();},days:v=>{days=v;if(env.isDuty())env.preserveLegacyDrafts?.(v);redraw();},
    requests:acceptRequests,
    error:e=>{error=e.message||'Could not load shared operations';redraw();}
   };
   watchCourse=c.listen(id,Object.fromEntries(Object.entries(callbacks).map(([key,fn])=>[key,guard(fn)])));
  }
  function acceptRequests(rows){
   const initial=!requestSnapshotReady;requestSnapshotReady=true;
   for(const r of rows){
    const decision=env.isDuty()&&r.submittedBy===uid()&&['APPROVED','RETURNED'].includes(r.status);
    const reviewable=!env.isDuty()&&r.status==='PENDING'&&r.submittedBy!==uid()&&M.canReview(env.profile(),member());
    if(!decision&&!reviewable)continue;
    const eventKey=current()+'|'+r.id+'|'+r.status;
    if(notifiedEvents.has(eventKey))continue;
    notifiedEvents.add(eventKey);
    // Initial snapshots are silent. Remember event IDs to suppress tab/reload repeats.
    const firstNotice=env.rememberApprovalNotice?.(eventKey);
    if(!initial&&firstNotice!==false)env.notifyApproval?.({id:r.id,kind:r.kind,date:r.date,status:r.status,courseId:current()});
   }
   requests=rows;
   for(const r of rows){
    let draft=readDraft(r.kind,r.date);
    if(r.status==='PENDING'&&!draft){const all=env.readDrafts();all[r.date]={...(all[r.date]||{}),[r.kind]:{value:M.clone(r.payload),baseRevision:r.baseRevision,requestId:r.id}};env.writeDrafts(all);draft=readDraft(r.kind,r.date);}
    if(r.status==='APPROVED'&&draft?.requestId===r.id){
     if(r.kind==='PLAN'&&Object.keys(draft.forms||{}).length){const all=env.readDrafts();all[r.date].PLAN={value:M.clone(r.payload),baseRevision:r.baseRevision+1,requestId:'',forms:draft.forms};env.writeDrafts(all);}
     else clearDraft(r.kind,r.date);
     env.resolved?.(r);
    }
   }
   redraw();
  }
  function workingFlights(d=date()){
   const official=env.officialFlights();if(!env.isDuty())return official;
   const draft=readDraft('PLAN',d),p=pending('PLAN',d),value=p?.payload||draft?.value;
   return value?official.filter(x=>x.date!==d).concat(value.flights||[]):official;
  }
  function workingSolos(d=date()){
   const official=env.officialSolos();if(!env.isDuty()&&!enabled())return official;
   const draft=readDraft('REPORT',d),p=pending('REPORT',d),value=p?.payload||draft?.value;
   return value?.solos?official.filter(x=>x.date!==d).concat(value.solos):official;
  }
  function saveWorkingSolos(rows,d=date()){saveDraft('REPORT',{...(readDraft('REPORT',d)?.value||{}),solos:rows.filter(x=>x.date===d)},d);}
  const kindLabel=kind=>kind==='PLAN'?L('Daily Flight Plan','תוכנית טיסות יומית'):L('Planned vs Executed','מתוכנן מול בוצע');
  const label=status=>({PENDING:L('Pending instructor approval','ממתין לאישור מדריך'),RETURNED:L('Returned for correction','הוחזר לתיקון'),APPROVED:L('Approved','אושר'),WITHDRAWN:L('Withdrawn','בוטל'),DRAFT:L('Draft','טיוטה')})[status]||status;
  function connectionMarkup(){
   if(enabled())return '';
   if(!env.isDuty()&&!rosterSync.error)return '';
   const description=rosterSync.error
    ?L('Automatic instructor approvals setup failed. Existing course records were not changed. Check roster accounts.','ההגדרה האוטומטית של אישורי המדריך נכשלה. הנתונים הקיימים בקורס לא שונו. יש לבדוק את חשבונות המשתתפים.')
    :L('Instructor approvals are being prepared automatically. Ask your Training Manager to verify your account if this persists.','אישורי המדריך מוגדרים באופן אוטומטי. אם ההודעה נשארת, יש לפנות למנהל ההדרכה לבדיקת החשבון.');
   return '<section class="card dutyApprovalConnect" role="status"><div><h2>'+L('Instructor approvals','אישורי מדריך')+'</h2><p>'+description+'</p>'+
    (rosterSync.error?'<p class="dutyApprovalError" role="alert">'+E(rosterSync.error)+'</p>':'')+'</div></section>';
  }
  function statusMarkup(kind,d=date()){
   if(!enabled())return '';
   if(!env.isDuty())return day(d)[kind==='PLAN'?'plan':'report']?'<div class="dutyApprovalStatus approved"><b>'+label('APPROVED')+'</b><span>'+L('This is the current official version.','זו הגרסה הרשמית הנוכחית.')+'</span></div>':'';
   const request=pending(kind,d)||latest(kind,d),draft=readDraft(kind,d),status=pending(kind,d)?'PENDING':draft?'DRAFT':request?.status||'DRAFT';
   return '<section class="dutyApprovalStatus '+status.toLowerCase()+'" role="status"><div><b>'+label(status)+'</b><p>'+L('Pending changes do not update reports, flight counts or experience.','שינויים שממתינים לאישור אינם מעדכנים דוחות, מוני טיסות או ניסיון.')+'</p>'+(request?.status==='RETURNED'?'<p class="dutyApprovalCorrection"><strong>'+L('Instructor note: ','הערת המדריך: ')+'</strong>'+E(request.reviewNote)+'</p>':'')+'</div>'+
    (status==='PENDING'?'<button type="button" class="btn secondary small" data-duty-withdraw="'+E(request.id)+'">'+L('Withdraw and edit','ביטול הבקשה ועריכה')+'</button>':(draft&&draft.baseRevision!==day(d).revision?'<button type="button" class="btn secondary small" data-duty-rebase="'+kind+'">'+L('Update approval base · keep my entries','עדכון בסיס האישור ושמירת ההזנות שלי')+'</button>':'')+'<button type="button" class="btn secondary small" data-duty-reload="'+kind+'">'+L('Reload approved version','טעינת הגרסה המאושרת')+'</button>')+'</section>';
  }
  function planAction(){
   if(!env.isDuty())return '';
   const count=workingFlights().filter(x=>x.date===date()).length,locked=Boolean(pending('PLAN'));
   return '<section class="card recordActionIsland"><div class="toolbar"><button type="button" class="btn sky" data-duty-send-plan '+(!enabled()||locked?'disabled':'')+'>'+L('Send plan for approval','שליחת תכנון לאישור')+'</button><span class="sub">'+count+' '+L('flights in this proposal','טיסות בהצעה זו')+'</span></div>'+(Object.keys(readDraft('PLAN')?.forms||{}).length?'<p class="sub">'+L('Unsaved flight fields are kept on this device. Add the flight to the draft to include it in the request.','שדות טיסה שטרם נשמרו נשמרים במכשיר. יש להוסיף את הטיסה לטיוטה כדי לכלול אותה בבקשה.')+'</p>':'')+'</section>';
  }
  function table(headers,rows){return '<div class="dutyApprovalTableWrap"><table class="dutyApprovalTable"><thead><tr>'+headers.map(h=>'<th>'+E(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<td data-label="'+E(headers[i])+'">'+E(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
  function preview(r){
   const before=day(r.date);
   if(r.kind==='PLAN'){
    const incoming=r.payload.flights||[],prior=before.plan?.flights||[],old=new Map(prior.map(x=>[x.id,x])),next=new Set(incoming.map(x=>x.id));
    const changes=incoming.map(f=>({...f,change:!old.has(f.id)?L('Added','נוסף'):M.same(f,old.get(f.id))?L('Unchanged','ללא שינוי'):L('Changed','שונה')})).concat(prior.filter(f=>!next.has(f.id)).map(f=>({...f,change:L('Removed','הוסר')})));
    return '<p class="sub">'+L('Approved flights','טיסות מאושרות')+': '+prior.length+' → '+L('Proposed flights','טיסות מוצעות')+': '+incoming.length+'</p>'+table([L('Change','שינוי'),L('Time','שעה'),L('Aircraft','כלי טיס'),L('Trainee','חניך'),L('Instructor','מדריך'),L('Syllabus','סילבוס'),L('Duration','משך')],changes.map(f=>[f.change,f.time,f.tail,f.traineeName,f.instructorName||L('Solo','סולו'),f.syllabus,String(f.estimatedMinutes)+' '+L('min','דקות')]));
   }
   const p=r.payload;
   return '<div class="dutyApprovalSummary"><span>'+L('Planned instructed','תכנון מודרכות')+': <b>'+p.plannedInstructed+'</b></span><span>'+L('Planned solo','תכנון סולו')+': <b>'+p.plannedSolo+'</b></span><span>'+L('Executed instructed','ביצוע מודרכות')+': <b>'+p.instructedExecuted+'</b></span><span>'+L('Executed solo','ביצוע סולו')+': <b>'+p.solos.length+'</b></span></div>'+
    table([L('Trainee','חניך'),L('Syllabus','סילבוס'),L('Takeoffs','המראות'),L('Landings','נחיתות'),L('Minutes','דקות')],p.solos.map(f=>[f.traineeName,f.syllabus,f.takeoffs,f.landings,f.minutes]))+
    '<h4>'+L('Cancellations','ביטולים')+'</h4>'+table([L('Flight type','סוג טיסה'),L('Quantity','כמות'),L('Reason','סיבה')],p.cancellations.map(x=>[x.type==='Solo'?L('Solo','סולו'):L('Instructed','מודרכת'),x.quantity,x.reasonLabel]));
  }
  function queueMarkup(){
   if(env.isDuty())return '<section class="card dutyApprovalInbox"><h2>'+L('My requests','הבקשות שלי')+'</h2>'+(requests.length?requests.slice().sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt))).slice(0,30).map(r=>'<details class="dutyApprovalRequest"'+(r.id===focusedRequest?' open':'')+'><summary><b>'+kindLabel(r.kind)+'</b><span dir="ltr">'+E(r.date)+'</span><span class="dutyApprovalPill '+r.status.toLowerCase()+'">'+label(r.status)+'</span></summary><div class="dutyApprovalRequestBody">'+(r.reviewNote?'<p class="dutyApprovalCorrection">'+E(r.reviewNote)+'</p>':'')+preview(r)+'</div></details>').join(''):'<p class="sub">'+L('No requests sent yet.','עדיין לא נשלחו בקשות.')+'</p>')+'</section>';
   if(!enabled()||!M.canReview(env.profile(),member()))return '<section class="card dutyApprovalInbox"><h2>'+L('Pending approvals','ממתינים לאישור')+'</h2><p class="sub">'+L('Assigned instructors can review requests once account synchronization completes.','מדריכים משויכים יכולים לבדוק בקשות לאחר השלמת סנכרון החשבונות.')+'</p></section>';
   const pendingRows=requests.filter(x=>x.status==='PENDING').sort((a,b)=>String(a.submittedAt).localeCompare(String(b.submittedAt)));
   return '<section class="card dutyApprovalInbox"><div class="formTitle"><h2>'+L('Pending instructor approvals','בקשות שממתינות לאישור מדריך')+'</h2><span class="dutyApprovalCount">'+pendingRows.length+'</span></div>'+(pendingRows.length?pendingRows.map(r=>{
    const stale=r.baseRevision!==day(r.date).revision;
    return '<details class="dutyApprovalRequest"><summary><b>'+kindLabel(r.kind)+'</b><span>'+E(r.submittedName)+'</span><span dir="ltr">'+E(r.date)+'</span><span class="dutyApprovalPill pending">'+label('PENDING')+'</span></summary><div class="dutyApprovalRequestBody">'+preview(r)+(stale?'<p class="dutyApprovalError">'+L('The official version changed. Return this request for correction.','הגרסה הרשמית השתנתה. יש להחזיר את הבקשה לתיקון.')+'</p>':'')+'<label class="dutyApprovalNote">'+L('Correction note — required when returning','הערת תיקון — חובה בהחזרה')+'<textarea class="input" maxlength="2000" data-duty-note="'+E(r.id)+'"></textarea></label><div class="toolbar"><button class="btn sky" type="button" data-duty-approve="'+E(r.id)+'" '+(stale?'disabled':'')+'>'+L(r.kind==='PLAN'?'Approve and publish plan':'Approve and submit report',r.kind==='PLAN'?'אישור ופרסום התכנון':'אישור והגשת הדוח')+'</button><button class="btn secondary" type="button" data-duty-return="'+E(r.id)+'">'+L('Return for correction','החזרה לתיקון')+'</button></div></div></details>';
   }).join(''):'<p class="sub">'+L('No requests are waiting for your approval.','אין בקשות שממתינות לאישורך.')+'</p>')+'</section>';
  }
  async function action(fn){if(busy)return;busy=true;try{await fn();}catch(e){env.toast(env.translateError?.(e.message)||e.message,'error');}finally{busy=false;redraw();}}
  async function send(kind,value){
   if(!enabled())throw new Error(L('Instructor approvals are not ready. Ask your Training Manager to verify your roster account','אישורי המדריך עדיין אינם זמינים. יש לפנות למנהל ההדרכה לבדיקת חשבונך ברשימת המשתתפים'));
   if(pending(kind))throw new Error(L('This request is already waiting for approval','הבקשה כבר ממתינה לאישור'));
   const d=date(),target=current(),actor=uid();let normalized;
   try{normalized=M.payload(kind,value,course.context,fleet,day(d),d);}catch(error){saveDraft(kind,value,d);throw error;}
   saveDraft(kind,normalized,d);const all=env.readDrafts(),draft=all[d][kind],id=draft.requestId||'op_'+(env.id?.()||Date.now()+'_'+Math.random().toString(36).slice(2));
   draft.requestId=id;if(!env.writeDrafts(all))throw new Error(L('Unable to save this draft on the device','לא ניתן לשמור את הטיוטה במכשיר'));
   await cloud().submit(target,kind,d,normalized,draft.baseRevision,id);
   if(current()!==target||uid()!==actor)return id;
   requests=requests.filter(x=>x.id!==id).concat([{id,kind,date:d,payload:normalized,baseRevision:draft.baseRevision,submittedBy:uid(),submittedAt:new Date().toISOString(),status:'PENDING',submittedName:env.profile()?.displayName||''}]);
   if(!submitSounds.has(id)){submitSounds.add(id);env.submitSound?.();}
   env.toast(L('Sent for instructor approval. Official data is unchanged.','נשלח לאישור מדריך. הנתונים הרשמיים נשארו כפי שהיו.'),'success');redraw();return id;
  }
  function bind(){
   const root=env.root();if(!root)return;
   const form=root.querySelector('#fleetSortieForm');
   if(env.isDuty()&&form&&enabled()&&!pending('PLAN')){
    const saved=readDraft('PLAN')?.forms?.[form.elements.namedItem('id')?.value||'new'];
    if(saved)for(const [name,value] of Object.entries(saved)){const field=form.elements.namedItem(name);if(field)field.value=value;}
    if(!form.dataset.dutyDraftBound){form.dataset.dutyDraftBound='true';const preserve=()=>{try{savePlanForm(Object.fromEntries(new FormData(form).entries()));}catch(error){env.toast(error.message,'error');}};form.addEventListener('input',preserve);form.addEventListener('change',preserve);}
   }
   root.querySelectorAll('[data-duty-send-plan]').forEach(b=>b.onclick=()=>action(()=>send('PLAN',{flights:workingFlights().filter(x=>x.date===date())})));
   root.querySelectorAll('#dutyCourseSelect').forEach(select=>select.onchange=()=>env.switchCourse?.(select.value));
   root.querySelectorAll('[data-duty-withdraw]').forEach(b=>b.onclick=()=>action(async()=>{if(!await env.confirm(L('Withdraw this request so you can edit and send it again?','לבטל את הבקשה כדי לערוך ולשלוח מחדש?'),{title:L('Withdraw request?','לבטל בקשה?'),confirmLabel:L('Withdraw and edit','ביטול ועריכה')}))return;await cloud().withdraw(current(),b.dataset.dutyWithdraw);requests=requests.map(r=>r.id===b.dataset.dutyWithdraw?{...r,status:'WITHDRAWN'}:r);}));
   root.querySelectorAll('[data-duty-reload]').forEach(b=>b.onclick=()=>action(async()=>{if(!await env.confirm(L('Replace this working copy with the current approved version?','להחליף את העותק לעריכה בגרסה המאושרת הנוכחית?'),{title:L('Reload approved version?','לטעון גרסה מאושרת?'),confirmLabel:L('Reload','טעינה')}))return;clearDraft(b.dataset.dutyReload,date());env.resolved?.({kind:b.dataset.dutyReload,date:date()});}));
   root.querySelectorAll('[data-duty-rebase]').forEach(b=>b.onclick=()=>action(async()=>{if(!await env.confirm(L('Keep your entries and request approval against the current official version?','לשמור את ההזנות שלך ולבקש אישור ביחס לגרסה הרשמית הנוכחית?'),{title:L('Update approval base','עדכון בסיס האישור'),confirmLabel:L('Keep entries and continue','שמירת ההזנות והמשך')}))return;const all=env.readDrafts(),draft=all[date()]?.[b.dataset.dutyRebase];if(draft){draft.baseRevision=day(date()).revision;draft.requestId='';if(!env.writeDrafts(all))throw new Error('Could not save the approval draft');}}));
   root.querySelectorAll('[data-duty-approve],[data-duty-return]').forEach(b=>b.onclick=()=>action(async()=>{
    const id=b.dataset.dutyApprove||b.dataset.dutyReturn,note=root.querySelector('[data-duty-note="'+id+'"]')?.value||'';
    b.disabled=true;await cloud().review(current(),id,b.dataset.dutyApprove?'APPROVED':'RETURNED',note);env.submitSound?.();requests=requests.filter(r=>r.id!==id);env.toast(L(b.dataset.dutyApprove?'Approved and submitted':'Returned for correction',b.dataset.dutyApprove?'אושר ונשמר':'הוחזר לתיקון'),'success');
   }));
   if(env.isDuty()&&(!enabled()||pending('PLAN')))root.querySelectorAll('#fleetSortieForm input,#fleetSortieForm select,#fleetSortieForm textarea,#fleetSortieForm button,[data-flight-edit],[data-flight-delete]').forEach(x=>x.disabled=true);
   if(env.isDuty()&&(!enabled()||pending('REPORT')))root.querySelectorAll('.pvePage input,.pvePage select,.pvePage textarea,.pvePage button').forEach(x=>x.disabled=true);
  }
  function count(){return requests.filter(r=>r.status==='PENDING').length;}
  function focusRequest(id){focusedRequest=String(id||'');}
  function notificationMarkup(){
   if(env.isDuty()){
    const decisions=requests.filter(r=>r.submittedBy===uid()&&['APPROVED','RETURNED'].includes(r.status))
     .slice().sort((a,b)=>String(b.reviewedAt||b.submittedAt||'').localeCompare(String(a.reviewedAt||a.submittedAt||''))).slice(0,5);
    return decisions.map(r=>'<button type="button" class="dutyApprovalNotification" data-duty-open-inbox="'+E(r.id)+'"><b>'+
     (r.status==='APPROVED'?L('Approved','אושר'):L('Returned for correction','הוחזר לתיקון'))+' · '+kindLabel(r.kind)+
     '</b><small>'+E(r.date)+' · '+E(course?.name||'')+'</small></button>').join('');
   }
   if(!M.canReview(env.profile(),member()))return '';
   const n=count();return n?'<button type="button" class="dutyApprovalNotification" data-duty-open-inbox><b>'+
    L('Pending instructor approvals','בקשות שממתינות לאישור מדריך')+' · '+n+'</b><small>'+E(course?.name||'')+'</small></button>':'';
  }
  return Object.freeze({connect,stop,enabled,context:()=>course?.context||null,courses:()=>courses,memberRole:(id=current())=>courses.find(x=>x.courseId===id)?.members?.[uid()]?.role||'',fleet:()=>fleet,days:()=>days,day,requests:()=>requests,pending,readDraft,saveDraft,workingFlights,workingSolos,saveWorkingSolos,send,
   publish:(kind,d,value,count)=>cloud().publish(current(),kind,d,value,count),saveFleet:value=>cloud().saveFleet(current(),value,fleet?.revision),syncEvaluations:(d,count)=>enabled()?cloud().evaluationCount(current(),d,count):Promise.resolve(),
   clearDraft,savePlanForm,clearPlanForm,focusRequest,connectionMarkup,statusMarkup,planAction,queueMarkup,notificationMarkup,count,bind});
 }
 return {create};
});
