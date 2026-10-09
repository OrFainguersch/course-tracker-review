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
  const sends=[],fleetWrites=[],resolved=[];
  const course={courseId:'course_01',name:'Course',context,members:{duty_01:{role:'DUTY_TRAINEE',name:'Duty Trainee'}}};
  const cloud={ready:()=>true,uid:()=>uid,manager:()=>false,watchCourses(cb){indexCallback=cb;cb([course]);return ()=>{};},listen(id,cb){callbacks=cb;cb.course(course);cb.fleet(fleet);cb.days([]);cb.requests([]);return ()=>{};},async submit(...args){sends.push(args);if(offline)throw new Error('Network disconnected');return args[5];},async saveFleet(...args){fleetWrites.push(args);}};
  const controller=UI.create({model:Model,cloud:()=>cloud,profile:()=>({status:'active',role:'duty_trainee'}),language:()=> 'en',escape:v=>String(v),isDuty:()=>true,courseId:()=>course.courseId,date:()=>date,readDrafts:()=>Model.clone(drafts),writeDrafts:value=>{drafts=Model.clone(value);return true;},officialFlights:()=>[],officialSolos:()=>[],render:()=>{},root:()=>null,toast:()=>{},sharedCourses:()=>{},resolved:r=>resolved.push(r),id:()=> 'stable_id_'+(++idCounter)});
  controller.connect();
  return {controller,sends,fleetWrites,resolved,get callbacks(){return callbacks;},get indexCallback(){return indexCallback;},setOffline:value=>{offline=value;},switchUid:value=>{uid=value;}};
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

test('The live entry point wires immutable approval drafts, preserved legacy entries and updated PWA assets',()=>{
  const html=fs.readFileSync('index.html','utf8'),worker=fs.readFileSync('sw.js','utf8');
  assert.match(html,/isDutyTrainee\(\)\?\[\]:readCourseArray\('ct-review-daily-reports'\)/);
  assert.match(html,/preserveLegacyDrafts:preserveDutyLegacyDrafts/);
  assert.match(html,/__legacyPreserved/);
  assert.match(html,/if\(isDutyTrainee\(\)\)\{await dutyOperations.send\('REPORT'/);
  assert.match(html,/data-plan-view="approvals"/);
  for(const asset of ['duty-approval-model.js','operations-cloud.js','course-operations.js','course-operations.css']){
    const url='./assets/'+asset+'?v=20261009-duty-approval-0792';assert.ok(html.includes(url));assert.ok(worker.includes(url));
  }
  assert.match(html,/build 0792/);assert.match(worker,/2026-10-09-duty-approval-0792/);
});
