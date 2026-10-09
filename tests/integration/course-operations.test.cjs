/* Run with the Firestore emulator, never with a production project. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const dependencyRequire=createRequire(path.join(process.env.FLYMPUS_TEST_DEPS||path.join(__dirname,'deps'),'package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=dependencyRequire('@firebase/rules-unit-testing');
const sdk=dependencyRequire('firebase/firestore');
sdk.setLogLevel('silent');
const Model=require('../../assets/duty-approval-model.js');
const Cloud=require('../../assets/operations-cloud.js');
const projectId='demo-flympus-approvals',course='course-test',date='2026-10-09';
const profiles={manager:{uid:'manager_01',role:'training_manager',displayName:'Manager',status:'active'},instructor:{uid:'instructor_01',role:'user',displayName:'Instructor',status:'active'},duty:{uid:'duty_01',role:'duty_trainee',displayName:'Duty Trainee',status:'active'},otherDuty:{uid:'duty_02',role:'duty_trainee',displayName:'Other Duty',status:'active'},outsider:{uid:'outsider_01',role:'user',displayName:'Outsider',status:'active'},blocked:{uid:'blocked_01',role:'user',displayName:'Blocked',status:'blocked'}};
const context={courseMeta:{courseName:'Training course',platformId:'shahak',type:'EP'},trainees:[{id:'t1',name:'Trainee',email:'duty_01@example.invalid'}],instructors:[{id:'i1',name:'Instructor',email:'instructor_01@example.invalid',role:'INSTRUCTOR'}],syllabi:['Basic','Solo'],soloSyllabi:['Solo'],syllabusDefs:[{name:'Basic',mode:'INSTRUCTED'},{name:'Solo',mode:'SOLO'}],counters:[],cancellationReasons:[{id:'weather',name:'Weather'}]};
const fleet={aircraft:[{id:'a1',tail:'01',platformId:'shahak',status:'SERVICEABLE',reason:'',since:'',history:[]}],timingDefaults:{}};
const flight={id:'flight_01',date,time:'08:00',aircraftId:'a1',mode:'SOLO',traineeId:'t1',instructorId:'',syllabus:'Solo',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15,createdAt:'2026-10-09T06:00:00Z',updatedAt:'2026-10-09T06:00:00Z'};
let env,dbs,apis;
const doc=(db,...p)=>sdk.doc(db,'courseOperations',course,...p);
test.before(async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('FIRESTORE_EMULATOR_HOST is required; production is prohibited');
 const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
 if(!['127.0.0.1','localhost'].includes(host))throw new Error('Only a local emulator is authorized');
 env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync(process.env.FLYMPUS_RULES_PATH||path.join(__dirname,'../../firestore.rules'),'utf8')}});
 dbs=Object.fromEntries(Object.entries(profiles).map(([key,p])=>[key,env.authenticatedContext(p.uid,{email:p.uid+'@example.invalid'}).firestore()]));
 apis=Object.fromEntries(Object.entries(profiles).map(([key,p])=>[key,Cloud.create({model:Model,sdk:()=>sdk,db:()=>dbs[key],user:()=>p,profile:()=>p,active:()=>true})]));
});
test.beforeEach(async()=>{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();for(const p of Object.values(profiles))await sdk.setDoc(sdk.doc(db,'users',p.uid),{...p,email:p.uid+'@example.invalid'});
  const members={manager_01:{role:'COURSE_MANAGER',name:'Manager',personId:''},instructor_01:{role:'INSTRUCTOR',name:'Instructor',personId:'i1'},duty_01:{role:'DUTY_TRAINEE',name:'Duty Trainee',personId:'t1'},duty_02:{role:'DUTY_TRAINEE',name:'Other Duty',personId:'t1'},blocked_01:{role:'INSTRUCTOR',name:'Blocked',personId:'i1'}};
  await sdk.setDoc(doc(db),{courseId:course,name:'Training course',context,members,memberUids:Object.keys(members),updatedBy:'manager_01',updatedAt:sdk.serverTimestamp()});
  await sdk.setDoc(doc(db,'fleet','current'),{...fleet,platformId:'shahak',revision:0,updatedBy:'manager_01',updatedAt:sdk.serverTimestamp()});
 });
});
test.after(async()=>env?.cleanup());

test('Manager connects verified accounts without exposing emails or replacing official data',async()=>{
 const preview=await apis.manager.preview(context);
 assert.equal(preview.matched.filter(x=>x.role==='DUTY_TRAINEE').length,1);
 const connected='new-connected-course';
 const payload=Model.payload('PLAN',{flights:[flight]},context,fleet,Model.emptyDay(date),date);
 await assertSucceeds(apis.manager.enroll(connected,context,preview,fleet,[{date,plan:payload}]));
 const ref=(...p)=>sdk.doc(dbs.duty,'courseOperations',connected,...p);
 const manifest=(await sdk.getDoc(ref())).data();
 assert.equal((await apis.manager.course(connected)).members.duty_01.role,'DUTY_TRAINEE');
 assert.equal(manifest.members.duty_01.role,'DUTY_TRAINEE');
 assert.equal(Object.hasOwn(manifest.context.trainees[0],'email'),false);
 const before=(await sdk.getDoc(ref('days',date))).data();
 await assertSucceeds(apis.manager.enroll(connected,context,preview,{aircraft:[],timingDefaults:{}},[{date,plan:{flights:[]}}]));
 assert.deepEqual((await sdk.getDoc(ref('days',date))).data(),before);
 assert.equal((await sdk.getDoc(ref('fleet','current'))).data().aircraft.length,1);
});

test('Duty cannot promote its account or read hidden training and other user records',async()=>{
 await assertFails(sdk.updateDoc(sdk.doc(dbs.duty,'users','duty_01'),{role:'user'}));
 await assertFails(sdk.getDoc(sdk.doc(dbs.duty,'users','instructor_01')));
 for(const name of ['evaluations','exams','courses']){
  await assertFails(sdk.getDoc(sdk.doc(dbs.duty,name,'private_record')));
  await assertFails(sdk.setDoc(sdk.doc(dbs.duty,name,'private_record'),{createdBy:'duty_01'}));
 }
});

test('Duty sends an immutable request; no official day exists before approval',async()=>{
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 assert.equal((await sdk.getDoc(doc(dbs.instructor,'days',date))).exists(),false);
 const request=await sdk.getDoc(doc(dbs.duty,'requests','request_plan_01'));assert.equal(request.data().status,'PENDING');
 await assertFails(sdk.updateDoc(request.ref,{payload:{flights:[]}}));
 await assertFails(sdk.updateDoc(request.ref,{status:'APPROVED',reviewedBy:'duty_01',reviewedAt:sdk.serverTimestamp()}));
 await assertFails(sdk.setDoc(doc(dbs.duty,'days',date),{...Model.emptyDay(date),revision:1,plan:{flights:[]},sourceRequestId:'',updatedBy:'duty_01',updatedAt:sdk.serverTimestamp()}));
});
test('Instructor approval atomically publishes the reviewed snapshot once',async()=>{
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 const ref=doc(dbs.instructor,'requests','request_plan_01');
 await assertFails(sdk.updateDoc(ref,{status:'APPROVED',reviewedBy:'instructor_01',reviewedAt:sdk.serverTimestamp()}));
 await apis.instructor.review(course,'request_plan_01','APPROVED');
 const official=(await sdk.getDoc(doc(dbs.duty,'days',date))).data();assert.equal(official.revision,1);assert.equal(official.plan.flights.length,1);assert.equal(official.sourceRequestId,'request_plan_01');
 await assert.rejects(apis.instructor.review(course,'request_plan_01','APPROVED'),/already been reviewed/);
 assert.equal((await sdk.getDoc(doc(dbs.instructor,'days',date))).data().revision,1);
});
test('Concurrent instructors cannot double-approve the same request',async()=>{
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 const results=await Promise.allSettled([apis.instructor.review(course,'request_plan_01','APPROVED'),apis.manager.review(course,'request_plan_01','APPROVED')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await sdk.getDoc(doc(dbs.instructor,'days',date))).data().revision,1);
});
test('Returned and withdrawn requests preserve official data and audit history',async()=>{
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 await assert.rejects(apis.instructor.review(course,'request_plan_01','RETURNED',''),/correction note/);
 await apis.instructor.review(course,'request_plan_01','RETURNED','Use a later departure');
 assert.equal((await sdk.getDoc(doc(dbs.duty,'requests','request_plan_01'))).data().reviewNote,'Use a later departure');
 assert.equal((await sdk.getDoc(doc(dbs.instructor,'days',date))).exists(),false);
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_02');await apis.duty.withdraw(course,'request_plan_02');
 await assertFails(sdk.deleteDoc(doc(dbs.duty,'requests','request_plan_01')));
 assert.equal((await sdk.getDoc(doc(dbs.instructor,'days',date))).exists(),false);
});
test('Duty cannot access another trainee request, another course, or enroll itself',async()=>{
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 await assertFails(sdk.getDoc(doc(dbs.otherDuty,'requests','request_plan_01')));
 await assertFails(sdk.getDocs(sdk.collection(dbs.duty,'courseOperations',course,'requests')));
 await assertSucceeds(sdk.getDocs(sdk.query(sdk.collection(dbs.duty,'courseOperations',course,'requests'),sdk.where('submittedBy','==','duty_01'))));
 await assertFails(sdk.getDoc(doc(dbs.outsider,'days',date)));
 await assertFails(sdk.updateDoc(doc(dbs.duty),{members:{duty_01:{role:'COURSE_MANAGER'}}}));
 await assertFails(sdk.getDoc(doc(dbs.blocked,'fleet','current')));
});
test('Fleet is the direct-save exception for assigned Duty Trainees',async()=>{
 await apis.duty.saveFleet(course,{...fleet,aircraft:[{...fleet.aircraft[0],status:'UNSERVICEABLE',reason:'Inspection',since:date}]},0);
 const official=(await sdk.getDoc(doc(dbs.instructor,'fleet','current'))).data();assert.equal(official.aircraft[0].status,'UNSERVICEABLE');assert.equal(official.revision,1);
 await assert.rejects(apis.duty.saveFleet(course,fleet,0),/Fleet changed/);
 await assertFails(sdk.deleteDoc(doc(dbs.duty,'fleet','current')));
});
test('A stale proposal cannot overwrite a newer approved plan',async()=>{
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 await apis.instructor.publish(course,'PLAN',date,{flights:[]});
 await assert.rejects(apis.manager.review(course,'request_plan_01','APPROVED'),/Approved data changed/);
 await apis.instructor.review(course,'request_plan_01','RETURNED','Reload the approved version');
 assert.equal((await sdk.getDoc(doc(dbs.instructor,'days',date))).data().plan.flights.length,0);
});
test('A report publishes solos and cancellations together only after approval',async()=>{
 await apis.instructor.publish(course,'PLAN',date,{flights:[flight]});
 const report={plannedInstructed:0,plannedSolo:1,instructedExecuted:0,cancellations:[],solos:[{id:'solo_01',date,traineeId:'t1',syllabus:'Solo',takeoffs:2,landings:2,minutes:30}]};
 await apis.duty.submit(course,'REPORT',date,report,1,'request_report_01');
 assert.equal((await sdk.getDoc(doc(dbs.instructor,'days',date))).data().report,null);
 await apis.instructor.review(course,'request_report_01','APPROVED');
 const official=(await sdk.getDoc(doc(dbs.duty,'days',date))).data();assert.equal(official.report.solos.length,1);assert.equal(Model.soloEvents(official.report.solos).length,3);
});
test('A Duty Trainee cannot obtain approval by a forged instructor course role',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await sdk.updateDoc(doc(c.firestore()),new sdk.FieldPath('members','duty_01','role'),'INSTRUCTOR');});
 await assertFails(sdk.setDoc(doc(dbs.duty,'days',date),{...Model.emptyDay(date),revision:1,plan:{flights:[]},sourceRequestId:'',updatedBy:'duty_01',updatedAt:sdk.serverTimestamp()}));
});
test('Rejected malformed data and duplicate submission never create official records',async()=>{
 await assert.rejects(apis.duty.submit(course,'PLAN',date,{flights:[{...flight,estimatedMinutes:-1}]},0,'request_bad_01'));
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 await apis.duty.submit(course,'PLAN',date,{flights:[flight]},0,'request_plan_01');
 const docs=await sdk.getDocs(sdk.query(sdk.collection(dbs.duty,'courseOperations',course,'requests'),sdk.where('submittedBy','==','duty_01')));assert.equal(docs.size,1);
});
