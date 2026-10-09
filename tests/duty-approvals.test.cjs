const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Model=require('../assets/duty-approval-model.js');
const UI=require('../assets/course-operations.js');
const Release=require('../scripts/course-operations-release.cjs');
const {deploymentResult}=require('../scripts/deployment-result.cjs');
const date='2026-10-09';
const context={courseMeta:{platformId:'shahak',courseName:'Course'},trainees:[{id:'t1',name:'Trainee'}],instructors:[{id:'i1',name:'Instructor'}],syllabi:['Solo'],soloSyllabi:['Solo'],cancellationReasons:[{id:'weather',name:'Weather'}]};
const fleet={aircraft:[{id:'a1',tail:'01',platformId:'shahak',status:'SERVICEABLE',history:[]}],timingDefaults:{},revision:0};
const flight={id:'flight_01',date,time:'08:00',aircraftId:'a1',mode:'SOLO',traineeId:'t1',instructorId:'',syllabus:'Solo',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15,createdAt:'2026-10-09T06:00:00Z',updatedAt:'2026-10-09T06:00:00Z'};
const solo={id:'solo_01',date,traineeId:'t1',syllabus:'Solo',takeoffs:2,landings:2,minutes:30};
const report={date,plannedInstructed:0,plannedSolo:1,instructedExecuted:0,cancellations:[],solos:[solo]};

function fixture(){
  let uid='duty_01',drafts={},callbacks,indexCallback,idCounter=0,offline=false;
  const sends=[],fleetWrites=[],resolved=[],sounds=[],alerts=[];
  const course={courseId:'course_01',name:'Course',context,members:{duty_01:{role:'DUTY_TRAINEE',name:'Duty Trainee'}}};
  const cloud={ready:()=>true,uid:()=>uid,manager:()=>false,watchCourses(cb){indexCallback=cb;cb([course]);return ()=>{};},listen(id,cb){callbacks=cb;cb.course(course);cb.fleet(fleet);cb.days([]);cb.requests([]);return ()=>{};},async submit(...args){sends.push(args);if(offline)throw new Error('Network disconnected');return args[5];},async saveFleet(...args){fleetWrites.push(args);}};
  const controller=UI.create({model:Model,cloud:()=>cloud,profile:()=>({status:'active',role:'duty_trainee'}),language:()=> 'en',escape:v=>String(v),isDuty:()=>true,courseId:()=>course.courseId,date:()=>date,readDrafts:()=>Model.clone(drafts),writeDrafts:value=>{drafts=Model.clone(value);return true;},officialFlights:()=>[],officialSolos:()=>[],render:()=>{},root:()=>null,toast:()=>{},sharedCourses:()=>{},submitSound:()=>sounds.push('submit'),notifyApproval:e=>alerts.push(e),rememberApprovalNotice:()=>true,resolved:r=>resolved.push(r),id:()=> 'stable_id_'+(++idCounter)});
  controller.connect();
  return {controller,sends,fleetWrites,resolved,sounds,alerts,get callbacks(){return callbacks;},get indexCallback(){return indexCallback;},setOffline:value=>{offline=value;},switchUid:value=>{uid=value;}};
}

test('Pending plans and solo drafts never enter official counts or experience',async t=>{
  const f=fixture();t.after(()=>f.controller.stop());
  f.controller.saveDraft('PLAN',{flights:[flight]});
  f.controller.saveWorkingSolos([solo]);
  assert.equal(f.controller.workingFlights().length,1);
  assert.equal(f.controller.workingSolos().length,1);
  assert.deepEqual(Model.mergeFlights([],f.controller.days()),[]);
  assert.deepEqual(Model.mergeReports([],f.controller.days()),[]);
  assert.deepEqual(Model.mergeSolos([],f.controller.days()),[]);
  assert.deepEqual(Model.soloEvents(Model.mergeSolos([],f.controller.days())),[]);
  await f.controller.send('PLAN',{flights:[flight]});
  assert.equal(f.controller.pending('PLAN').status,'PENDING');
  assert.throws(()=>f.controller.saveDraft('PLAN',{flights:[]}),/Withdraw/);
  assert.deepEqual(Model.mergeFlights([],f.controller.days()),[]);
});

test('Disconnected submission preserves entries and reuses the request ID on retry',async t=>{
  const f=fixture();t.after(()=>f.controller.stop());f.setOffline(true);
  await assert.rejects(f.controller.send('REPORT',{...report,savedAt:'first'}),/Network disconnected/);
  const first=f.controller.readDraft('REPORT');
  assert.equal(first.value.solos[0].minutes,30);assert.ok(first.requestId);
  f.setOffline(false);await f.controller.send('REPORT',{...report,savedAt:'second'});
  assert.equal(f.sends[0][5],first.requestId);assert.equal(f.sends[0][5],f.sends[1][5]);
  assert.equal(f.controller.readDraft('REPORT').requestId,first.requestId);
});

test('Returned drafts stay editable; only the matching approved request clears them',async t=>{
  const f=fixture();t.after(()=>f.controller.stop());
  const id=await f.controller.send('REPORT',report);
  const request={id,kind:'REPORT',date,payload:report,submittedBy:'duty_01',baseRevision:0,status:'RETURNED',reviewNote:'Fix duration'};
  f.callbacks.requests([request]);
  assert.equal(f.controller.readDraft('REPORT').value.solos.length,1);
  assert.match(f.controller.statusMarkup('REPORT'),/Fix duration/);
  f.callbacks.requests([{...request,id:'unrelated_01',status:'APPROVED'}]);
  assert.ok(f.controller.readDraft('REPORT'));
  f.callbacks.requests([{...request,status:'APPROVED'}]);
  assert.equal(f.controller.readDraft('REPORT'),null);assert.equal(f.resolved.length,1);
});

test('Fleet saves directly, without creating an instructor approval request',async t=>{
  const f=fixture();t.after(()=>f.controller.stop());
  await f.controller.saveFleet(fleet);
  assert.equal(f.fleetWrites.length,1);assert.equal(f.sends.length,0);
});

test('Unfinished flight fields survive refreshes and approval of the saved day',async t=>{
  const f=fixture();t.after(()=>f.controller.stop());
  f.controller.savePlanForm({id:'',traineeId:'t1',note:'Entered but not added yet'});
  f.callbacks.days([{...Model.emptyDay(date),revision:0}]);
  assert.equal(f.controller.readDraft('PLAN').forms.new.note,'Entered but not added yet');
  const id=await f.controller.send('PLAN',{flights:[]});
  f.callbacks.requests([{id,kind:'PLAN',date,baseRevision:0,status:'APPROVED',submittedBy:'duty_01',payload:{flights:[]}}]);
  assert.equal(f.controller.readDraft('PLAN').forms.new.traineeId,'t1');
  assert.equal(f.controller.readDraft('PLAN').requestId,'');
  assert.equal(f.controller.readDraft('PLAN').baseRevision,1);
});

test('Late callbacks from a previous identity cannot expose its course or requests',t=>{
  const f=fixture();t.after(()=>f.controller.stop());
  const stale=f.callbacks,oldIndex=f.indexCallback;
  f.switchUid('new_user');f.controller.connect();
  oldIndex([{courseId:'private_old_course',members:{duty_01:{role:'DUTY_TRAINEE'}}}]);
  stale.requests([{id:'private_request',kind:'PLAN',date,status:'PENDING',submittedBy:'duty_01',payload:{flights:[flight]}}]);
  assert.equal(f.controller.requests().length,0);
  assert.equal(f.controller.courses().some(c=>c.courseId==='private_old_course'),false);
  assert.equal(f.controller.enabled(),false);
});

test('Report validation preserves cancellation accounting and actual evaluation counts',()=>{
  const day=Model.emptyDay(date);
  assert.throws(()=>Model.payload('REPORT',{...report,instructedExecuted:1},context,fleet,day,date),/evaluations changed/);
  assert.throws(()=>Model.payload('REPORT',{...report,solos:[]},context,fleet,day,date),/Cancellation counts/);
  const approved=Model.payload('REPORT',report,context,fleet,day,date);
  assert.equal(Model.soloEvents(approved.solos).find(e=>e.type==='TRAINING_HOUR').quantity,.5);
  assert.throws(()=>Model.assertReview({status:'PENDING',submittedBy:'other',baseRevision:0},{revision:1},'instructor'),/Approved data changed/);
});

test('Returning to an earlier report date restores its fields instead of another day draft',()=>{
  const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('function plannedCompleteness(){'),end=html.indexOf('function plannedAttentionCount(){',start);
  const scope={state:{planDate:date},getDailyReports:()=>[],getActivityDraft:()=>({data:{date:'2026-10-10',plannedSolo:9}}),dutyOperations:{readDraft:(kind,d)=>d===date?{value:{date,plannedInstructed:0,plannedSolo:2,cancellations:[{type:'Solo',reasonId:'weather',quantity:2}]}}:null,pending:()=>null,enabled:()=>false},getPlanExecutedInstructed:()=>0,getPlanWorkingSoloFlights:()=>[],flightBoardPlanStatus:()=>({linked:false}),cfgGet:()=>({cancellationReasons:context.cancellationReasons})};
  require('node:vm').runInNewContext(html.slice(start,end),scope);
  const result=scope.plannedCompleteness();
  assert.equal(result.ps,2);assert.equal(result.date,date);assert.equal(result.cancellationRows[0].reasonId,'weather');
});

test('Additive rules merge preserves all surrounding live source and rejects ambiguous markers',()=>{
  const candidate=fs.readFileSync('firestore.rules','utf8'),addition=Release.block(candidate);
  const original=candidate.replace(addition+'\n','');
  const merged=Release.merge(original,candidate);
  assert.equal(merged.replace(addition+'\n',''),original);
  assert.equal(Release.merge(merged,candidate),merged);
  assert.throws(()=>Release.block(candidate+'\n'+addition),/Expected one/);
  assert.throws(()=>Release.authorize({enabled:true,project:'other'}),/not authorized/);
});

test('A green Hosting result cannot claim success if approval rules were skipped',()=>{
  const steps=Object.fromEntries(['regression','safety_preflight','firebase_cli','cli_compat','google_auth','adc_verify','prepare','hosting_deploy','production_verify'].map(k=>[k,'success']));
  const base={steps,current:'true',configured:'true',safetyReady:'true',intendedCommit:'a',actualCommit:'a',courseOperationsRequired:true};
  assert.equal(deploymentResult(base).status,'FAILED');
  for(const key of ['permission_tests','rules_backup','rules_backup_artifact','live_permission_tests','rules_deploy','rules_verify'])steps[key]='success';
  assert.equal(deploymentResult(base).status,'DEPLOYED');
});


test('Automatic manager enrollment seeds once and roster refresh preserves approved records',async t=>{
 let roster=Model.clone({...context,instructors:[{id:'i1',name:'Instructor',email:'instructor_01@example.invalid'}]});
 const saved=new Map(),enrollments=[],seeds=[{date,plan:{flights:[flight]}}];let onCourses=()=>{},courseId='auto_course';
 const cloud={
  ready:()=>true,uid:()=> 'manager_01',manager:()=>true,
  watchCourses(cb){onCourses=cb;cb([...saved.values()]);return ()=>{};},
  async preview(snapshot){return {matched:[{uid:'manager_01',role:'COURSE_MANAGER',name:'Manager',personId:''},{uid:'instructor_01',role:'INSTRUCTOR',name:'Instructor',personId:'i1'},...(snapshot.trainees.some(p=>p.email)?[{uid:'duty_01',role:'DUTY_TRAINEE',name:'Duty',personId:'t1'}]:[])],missing:[]};},
  async course(key){return saved.get(key)||null;},
  async enroll(key,snapshot,preview,_fleet,days){enrollments.push({key,days:Model.clone(days)});const prior=saved.get(key);const next={courseId:key,name:snapshot.courseMeta.courseName,context:{...snapshot,instructors:snapshot.instructors.map(({email,...p})=>p),trainees:snapshot.trainees.map(({email,...p})=>p)},members:Object.fromEntries(preview.matched.map(p=>[p.uid,{role:p.role,personId:p.personId||'',name:p.name}])),approvedDays:prior?.approvedDays||Model.clone(days)};saved.set(key,next);onCourses([...saved.values()]);},
  listen(key,cb){const row=saved.get(key);cb.course(row);cb.fleet(fleet);cb.days(row.approvedDays);cb.requests([]);return ()=>{};}
 };
 const controller=UI.create({model:Model,cloud:()=>cloud,profile:()=>({role:'training_manager',status:'active'}),language:()=> 'en',escape:String,isDuty:()=>false,
  courseId:()=>courseId,date:()=>date,readDrafts:()=>({}),writeDrafts:()=>true,officialFlights:()=>[],officialSolos:()=>[],render:()=>{},
  root:()=>null,toast:()=>{},sharedCourses:()=>{},autoEnrollmentAllowed:()=>true,contextSnapshot:()=>Model.clone(roster),
  fleetSnapshot:()=>Model.clone(fleet),seedDays:()=>Model.clone(seeds)});
 t.after(()=>controller.stop());
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 controller.connect();await tick();
 assert.equal(enrollments.length,1);assert.equal(enrollments[0].days.length,1);
 assert.doesNotMatch(controller.connectionMarkup(),/Connect course/);
 controller.connect();await tick();assert.equal(enrollments.length,1);
 roster.trainees[0].email='duty_01@example.invalid';
 controller.connect();await tick();
 assert.equal(enrollments.length,2);assert.deepEqual(enrollments[1].days,[]);
 assert.deepEqual(saved.get(courseId).approvedDays,seeds);
 assert.equal(saved.get(courseId).members.duty_01.role,'DUTY_TRAINEE');
});

test('Disconnected Duty Trainees cannot self-enroll or use a manual Connect course action',async t=>{
 const f=fixture();t.after(()=>f.controller.stop());f.indexCallback([]);f.controller.connect();
 assert.equal(f.controller.enabled(),false);
 assert.doesNotMatch(f.controller.connectionMarkup(),/Connect course/);
 await assert.rejects(f.controller.send('PLAN',{flights:[flight]}),/Instructor approvals are not ready/);
});


test('Duty Trainee confirmation sound fires only after a successful approval request write',async t=>{
 const f=fixture();t.after(()=>f.controller.stop());
 f.setOffline(true);await assert.rejects(f.controller.send('PLAN',{flights:[flight]}),/Network disconnected/);
 assert.equal(f.sounds.length,0);
 f.setOffline(false);const id=await f.controller.send('PLAN',{flights:[flight]});
 assert.equal(f.sounds.length,1);
 assert.equal(f.controller.pending('PLAN').id,id);
 await assert.rejects(f.controller.send('PLAN',{flights:[flight]}),/already waiting/);
 assert.equal(f.sounds.length,1);
});

test('Trainee decisions trigger Notification exactly once and are linked in the bell',async t=>{
 const f=fixture();t.after(()=>f.controller.stop());
 const id=await f.controller.send('REPORT',report);
 const returned={id,kind:'REPORT',date,payload:report,submittedBy:'duty_01',baseRevision:0,status:'RETURNED',reviewedAt:'2026-10-09T15:20:00Z',reviewNote:'Adjust duration'};
 f.callbacks.requests([returned]);
 assert.deepEqual(f.alerts.map(x=>x.status),['RETURNED']);
 f.callbacks.requests([returned]);
 assert.equal(f.alerts.length,1);
 assert.match(f.controller.notificationMarkup(),/Returned for correction/);
 assert.match(f.controller.notificationMarkup(),new RegExp(id));
 f.controller.focusRequest(id);
 assert.match(f.controller.queueMarkup(),/dutyApprovalRequest" open/);
 f.callbacks.requests([{...returned,status:'APPROVED',reviewedAt:'2026-10-09T15:30:00Z'}]);
 assert.deepEqual(f.alerts.map(x=>x.status),['RETURNED','APPROVED']);
 assert.match(f.controller.notificationMarkup(),/Approved/);
});

test('Instructor initial snapshot is silent, new pending request sounds once, and access filtering remains intact',async t=>{
 let cb, index, uid='instructor_01',alerts=[],sounds=[],accepted=[];
 const info={courseId:'course_alerts',name:'Course alerts',context,members:{[uid]:{role:'INSTRUCTOR',personId:'i1',name:'Instructor'}}};
 const cloud={ready:()=>true,uid:()=>uid,manager:()=>false,watchCourses(fn){index=fn;fn([info]);return ()=>{};},
  listen(_id,fn){cb=fn;fn.course(info);fn.fleet(fleet);fn.days([]);fn.requests([]);return ()=>{};},
  async review(...args){accepted.push(args);return 'APPROVED';}};
 const button={dataset:{dutyApprove:'req_a'},disabled:false},root={querySelectorAll(selector){return selector==='[data-duty-approve],[data-duty-return]'?[button]:[];},querySelector(){return {value:''}}};
 const ui=UI.create({model:Model,cloud:()=>cloud,profile:()=>({status:'active',role:'instructor'}),language:()=> 'en',escape:String,isDuty:()=>false,courseId:()=>info.courseId,date:()=>date,
  readDrafts:()=>({}),writeDrafts:()=>true,officialFlights:()=>[],officialSolos:()=>[],root:()=>root,render:()=>{},toast:()=>{},sharedCourses:()=>{},
  submitSound:()=>sounds.push('confirmed'),notifyApproval:e=>alerts.push(e),rememberApprovalNotice:()=>true});
 t.after(()=>ui.stop());ui.connect();
 const req={id:'req_a',kind:'PLAN',date,submittedBy:'duty_01',submittedAt:'2026-10-09T15:10:00Z',status:'PENDING',baseRevision:0,payload:{flights:[flight]}};
 cb.requests([req]);cb.requests([req]);assert.equal(alerts.length,1);assert.equal(alerts[0].status,'PENDING');
 assert.match(ui.notificationMarkup(),/Pending instructor approvals/);
 ui.bind();button.onclick();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(accepted.length,1);assert.equal(sounds.length,1);
});

test('Audio and foreground notification hook respects existing settings and only uses approved Firebase transitions',()=>{
 const code=fs.readFileSync('index.html','utf8');
 assert.match(code,/submitSound:playFlympusFormSubmitSound/);
 assert.match(code,/notifyApproval:announceDutyApproval/);
 assert.match(code,/rememberApprovalNotice:rememberDutyApprovalNotice/);
 assert.match(code,/if\(document.visibilityState!=='visible'\)return/);
 assert.match(code,/playFlympusNotificationSound\(\)/);
 assert.match(code,/dutyOperations\.focusRequest\(button\.dataset\.dutyOpenInbox/);
 assert.match(code,/if\(!dutyRestricted\)safetyUI\.inbox\(\);/);
});

test('The live entry point wires immutable approval drafts, preserved legacy entries and updated PWA assets',()=>{
  const html=fs.readFileSync('index.html','utf8'),worker=fs.readFileSync('sw.js','utf8');
  assert.match(html,/isDutyTrainee\(\)\?\[\]:readCourseArray\('ct-review-daily-reports'\)/);
  assert.match(html,/preserveLegacyDrafts:preserveDutyLegacyDrafts/);
  assert.match(html,/__legacyPreserved/);
  assert.match(html,/if\(isDutyTrainee\(\)\)\{await dutyOperations.send\('REPORT'/);
  assert.match(html,/data-plan-view="approvals"/);
  for(const asset of ['duty-approval-model.js','operations-cloud.js','course-operations.js','course-operations.css']){
    const url='./assets/'+asset+'?v=20261009-approval-sounds-0795';assert.ok(html.includes(url));assert.ok(worker.includes(url));
  }
  assert.match(html,/build 0797/);assert.match(worker,/2026-10-09-adaptive-timeline-0797/);
});
