const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../assets/fleet-model.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const auth=fs.readFileSync(path.join(__dirname,'../auth.js'),'utf8');
const rules=fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
const now='2026-10-08T09:00:00Z';
const add=(list,id,tail,status='SERVICEABLE',reason='',since='2026-10-08',platform='shahak')=>M.upsertAircraft(list,{tail,status,reason,since},platform,now,()=>id);
test('aircraft inventory is platform-scoped, editable, archived non-destructively',()=>{
 let rows=[];
 rows=add(rows,'a01','01');rows=add(rows,'a02','02');rows=add(rows,'a03','03','UNSERVICEABLE','Engine maintenance','2026-10-05');rows=add(rows,'a04','04');
 assert.deepEqual(M.count(rows,'shahak').serviceable,3);
 assert.deepEqual(M.count(rows,'shahak').unserviceable,1);
 assert.equal(M.count(rows,'aerostar').total,0);
 assert.equal(rows.find(x=>x.id==='a03').reason,'Engine maintenance');
 assert.equal(rows.find(x=>x.id==='a03').since,'2026-10-05');
 rows=M.upsertAircraft(rows,{id:'a03',tail:'03',status:'SERVICEABLE',since:'2026-10-08'},'shahak',now);
 assert.equal(M.count(rows,'shahak').serviceable,4);
 assert.equal(rows.find(x=>x.id==='a03').history.length,2);
 rows=M.archiveAircraft(rows,'a04','shahak',now);
 assert.equal(M.count(rows,'shahak').total,3);
 assert.ok(rows.find(x=>x.id==='a04').archivedAt);
 assert.throws(()=>M.archiveAircraft(rows,'a04','aerostar'));
});
test('unserviceability requires dated reason, prohibits duplicate identifiers and malformed dates',()=>{
 let rows=add([],'a01','01');
 assert.throws(()=>add(rows,'a02','01'),/already exists/);
 assert.throws(()=>add(rows,'a02','02','UNSERVICEABLE','', '2026-10-08'),/reason/);
 assert.throws(()=>add(rows,'a02','02','UNSERVICEABLE','Fault','2026-02-31'),/date/);
 assert.throws(()=>add(rows,'a02','02','SERVICEABLE','','2026-02-31'),/date/);
 assert.equal(M.dateValid('2026-10-08'),true);
 assert.equal(M.clockValid('23:59'),true);
 assert.equal(M.clockValid('25:00'),false);
});
test('scheduled flights can only select serviceable aircraft and valid assigned people',()=>{
 let planes=add([],'a01','01');
 planes=add(planes,'a03','03','UNSERVICEABLE','Needs propeller','2026-10-03');
 const ids={trainees:['t1'],instructors:['i1']};
 const base={time:'09:30',aircraftId:'a01',traineeId:'t1',traineeName:'Pilot 1',instructorId:'i1',instructorName:'Coach',syllabus:'Circuits',mode:'INSTRUCTED',estimatedMinutes:'30'};
 assert.throws(()=>M.upsertSortie([],{...base,aircraftId:'a03'},planes,'shahak','2026-10-08',ids),/not serviceable/);
 assert.throws(()=>M.upsertSortie([],{...base,traineeId:'else'},planes,'shahak','2026-10-08',ids),/assigned to this course/);
 assert.throws(()=>M.upsertSortie([],{...base,time:'25:00'},planes,'shahak','2026-10-08',ids),/valid flight date and time/);
 let board=M.upsertSortie([],{...base},planes,'shahak','2026-10-08',ids,now,()=> 'flight1');
 assert.equal(board.length,1);assert.equal(board[0].tail,'01');
 assert.throws(()=>M.upsertSortie(board,{...base},planes,'shahak','2026-10-08',ids,now,()=> 'flight2'),/already booked/);
 assert.equal(M.flightIssues(board[0],planes,'shahak'),'');
 planes=M.upsertAircraft(planes,{id:'a01',tail:'01',status:'UNSERVICEABLE',reason:'Fuel system',since:'2026-10-08'},'shahak',now);
 assert.match(M.flightIssues(board[0],planes,'shahak'),/Fuel system/);
 assert.equal(board[0].aircraftId,'a01');
 assert.throws(()=>M.upsertSortie(board,{...base,id:'flight1'},planes,'shahak','2026-10-08',ids),/not serviceable/);
});
test('User Management Duty Trainee role has operational permissions without structural admin',()=>{
 assert.ok(auth.includes("duty_trainee:Object.freeze({"));
 const duty=auth.match(/duty_trainee:Object.freeze\(\{[\s\S]*?capabilities:Object.freeze\(\[([^\]]+)\]\)/);
 assert.ok(duty);
 for(const cap of ['operations.daily.write','operations.flightBoard.write','operations.solo.write','fleet.serviceability.write'])assert.ok(duty[1].includes(cap));
 for(const cap of ['users.manage','roster.manage','courses.create','packages.manageGlobal'])assert.ok(!duty[1].includes(cap));
 assert.ok(auth.includes("'Daily flight operations'"));
 assert.ok(auth.includes("'Duty Trainee':'חניך תורן'"));
 assert.ok(rules.includes("'duty_trainee'"));
 assert.ok(html.includes("isDutyTraineeAssigned(courseKey=currentCourseId)"));
 assert.ok(html.includes("isDutyTraineeAssigned(courseKey(record))"));
 assert.ok(html.includes("if(!flympusCan('operations.daily.write'))"));
 assert.ok(html.includes("if(!flympusCan('operations.flightBoard.write'))"));
});
test('Fleet and daily board are accessible per course from Home; refresh and theme parity remain intact',()=>{
 for(const item of ["case'fleet'",'bindFleet()','bindDailyFlightBoard()',
 'appScreenIds=new Set(','getFleetAircraft()','getDailyFlightBoard()','courseScopedKey(base)','flightBoardEditId',
 'window.FLYMPUS_FLEET_VIEW?.home?.(currentFleetContext())','courseFlightScheduleHtml(date)'])assert.ok(html.includes(item),item);
 assert.ok(ui.includes("M.flightIssues(f,c.fleet,c.platformId)"));
 assert.ok(ui.includes("const available=M.active(c.fleet,c.platformId).filter(x=>x.status===M.AVAILABLE)"));
 assert.ok(html.includes('html[data-flympus-theme="dark"]')||fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8').includes('html[data-flympus-theme="dark"]'));
 assert.ok(fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8').includes('@media(max-width:560px)'));
});

test('Fleet Home uses real aircraft rows and places the inventory table in the primary Home grid',()=>{
 const vm=require('node:vm');
 const context={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=> 'en'}};
 vm.runInNewContext(ui,context,{filename:'fleet-views.js'});
 const V=context.window.FLYMPUS_FLEET_VIEW;
 const fleet=[...add([],'a01','01'),];
 const down=add(fleet,'a02','02','UNSERVICEABLE','Hydraulic inspection','2026-10-07');
 const ctx={fleet:down,platformId:'shahak',platformLabel:'Aerostar',courseLabel:'Training',today:'2026-10-08',canWrite:true};
 const home=V.home(ctx),detail=V.fleet(ctx),empty=V.home({...ctx,fleet:[]});
 assert.match(home,/fleetHomeTable/);
 assert.match(home,/01/);
 assert.match(home,/02/);
 assert.match(home,/Hydraulic inspection/);
 assert.match(home,/Unserviceable/);
 assert.match(home,/1<\/b> \/ 2/);
 assert.match(empty,/No aircraft registered/);
 assert.doesNotMatch(empty,/Hydraulic inspection/);
 assert.match(detail,/fleetInventoryTable/);
 assert.match(detail,/data-fleet-add/);
 assert.match(detail,/id="fleetEditorPanel" hidden/);
 assert.match(detail,/data-fleet-reason-field/);
 assert.ok(detail.indexOf('fleetInventoryTable')<detail.indexOf('id="fleetEditorPanel"'));
 const editing=V.fleet({...ctx,editId:'a02'});
 assert.match(editing,/id="fleetEditorPanel"/);
 assert.doesNotMatch(editing,/id="fleetEditorPanel" hidden/);
 const readonly=V.fleet({...ctx,canWrite:false});
 assert.doesNotMatch(readonly,/data-fleet-edit=/);
 assert.doesNotMatch(readonly,/fleetAircraftForm/);
 assert.ok(html.indexOf("FLYMPUS_FLEET_VIEW?.home?.(currentFleetContext())")>html.indexOf("'<section class=\"homePrimaryGrid\">'"));
 assert.ok(html.indexOf("<h2>Course Pulse</h2>")<html.indexOf("FLYMPUS_FLEET_VIEW?.home?.(currentFleetContext())"));
 assert.equal((html.match(/FLYMPUS_FLEET_VIEW\?\.home\?\.\(currentFleetContext\(\)\)/g)||[]).length,1);
 assert.ok(!html.includes("'<div class=\"homeTaskStrip\">'"),"Home no longer repeats quick actions");
 assert.ok(html.includes("holder.hidden=!down"),'Unavailable reason is only shown when relevant');
});
test('Serviceability history captures optional signed-in operator without changing old data',()=>{
 let aircraft=M.upsertAircraft([],{tail:'03',status:'SERVICEABLE',since:'2026-10-08'},'shahak',now,()=> 'a03','Instructor A');
 assert.equal(aircraft[0].history[0].recordedBy,'Instructor A');
 aircraft=M.upsertAircraft(aircraft,{id:'a03',tail:'03',status:'UNSERVICEABLE',reason:'Inspection',since:'2026-10-08'},'shahak',now,()=> 'unused','Duty Trainee');
 assert.deepEqual(aircraft[0].history.map(h=>h.recordedBy),['Instructor A','Duty Trainee']);
});


test('Fleet names replace old module headings while Serviceability remains the actual aircraft status',()=>{
 const vm=require('node:vm');
 const context={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=> 'en'}};
 vm.runInNewContext(ui,context,{filename:'fleet-views.js'});
 const V=context.window.FLYMPUS_FLEET_VIEW;
 const ctx={fleet:add([],'aircraft-1','01'),flights:[],platformId:'shahak',platformLabel:'Shahak',courseLabel:'EP',today:'2026-10-08',date:'2026-10-08',trainees:[],instructors:[],syllabi:['Circuits'],canWrite:true};
 assert.match(V.home(ctx),/<h2>Fleet<\/h2>/);
 assert.match(V.fleet(ctx),/<h1 class="pageTitle">Fleet<\/h1>/);
 assert.match(V.fleet(ctx),/Serviceability/);
 assert.doesNotMatch(V.fleet(ctx),/<h1 class="pageTitle">Aircraft Serviceability<\/h1>/);
 assert.match(V.schedule(ctx),/data-go="fleet"/);
 assert.match(html,/<h3>Fleet<\/h3>/);
 assert.doesNotMatch(html,/<h3>Aircraft Serviceability<\/h3>/);
 assert.ok(html.includes("flympusAccessDenied('Fleet')"));
});
test('Plan opens on the date-specific Daily Flight Plan with separate Planned vs Executed tab',()=>{
 const page=html.slice(html.indexOf('function dailyFlightPlan(){'),html.indexOf('function globalBackControl(){'));
 assert.match(page,/Daily Flight Plan/);
 assert.match(page,/Planned vs Executed/);
 assert.match(page,/data-plan-view="board"/);
 assert.match(page,/data-plan-view="report"/);
 assert.match(page,/id="dailyPlanDate"/);
 assert.ok(page.includes("courseFlightScheduleHtml(date)"));
 assert.ok(page.includes("view==='board'?dailyFlightPlan():plannedVsExecuted()"));
 assert.ok(html.includes("case'planned':html=planWorkspace();break"));
 assert.ok(html.includes("if(state.planView==='report')bindPlanned();else bindDailyFlightBoard()"));
 assert.ok(html.includes("b.dataset.planToday==='true'?{planView:'board',planDate:todayIsoDate()"));
 const homeSource=html.slice(html.indexOf('function home(){'),html.indexOf('function evaluationHistoryViewHtml('));
 assert.match(homeSource, /<h2>Today.*s Plan<\/h2>/);
 assert.ok(homeSource.includes('<span class="homeDateChip">'));
 assert.ok(homeSource.includes('<div class="homePlanRow">'));
 assert.ok(homeSource.includes('<div class="homePlanRow homePlanEmpty">'));
 assert.ok(!homeSource.includes('data-plan-today="true"'),'Home Today Plan must not navigate to Plan');
 assert.ok(!homeSource.includes('homePlanTitleButton'),'Home Today Plan title must not be a button');
 assert.ok(!homeSource.includes('homePlanDateButton'),'Home Today Plan date must not be a button');
 assert.ok(!homeSource.includes('data-go="reports"'),'Course Pulse no longer offers View Reports');
 assert.ok(html.includes("case'reports':html=reports();break"),'Reports navigation remains available');
 assert.ok(!html.includes("courseFlightScheduleHtml(date)+\n '<section class=\"card pvePanel\">"));
});
test('Scheduled sortie requires planned duration and preserves notes without changing serviceability constraints',()=>{
 const fleet=add([],'ac1','01'),allowed={trainees:['trainee1'],instructors:['ip1']};
 const flight={date:'2026-10-08',time:'11:30',mode:'INSTRUCTED',aircraftId:'ac1',traineeId:'trainee1',instructorId:'ip1',instructorName:'IP',traineeName:'EP',syllabus:'Circuits',estimatedMinutes:'35',note:'Winds and circuit work'};
 const result=M.upsertSortie([],flight,fleet,'shahak','2026-10-08',allowed,now,()=> 'sortie1');
 assert.equal(result[0].estimatedMinutes,35);
 assert.equal(result[0].note,'Winds and circuit work');
 const amended=M.upsertSortie(result,{...flight,id:'sortie1',estimatedMinutes:'45',note:'Revised'},fleet,'shahak','2026-10-08',allowed,now);
 assert.equal(amended[0].estimatedMinutes,45);
 assert.equal(amended[0].note,'Revised');
 assert.throws(()=>M.upsertSortie([],{...flight,estimatedMinutes:'721'},fleet,'shahak','2026-10-08',allowed),/duration/);
 assert.throws(()=>M.upsertSortie([],{...flight,estimatedMinutes:'0'},fleet,'shahak','2026-10-08',allowed),/duration/);
 assert.throws(()=>M.upsertSortie([],{...flight,aircraftId:'unknown'},fleet,'shahak','2026-10-08',allowed),/serviceable/);
 assert.ok(html.includes("estimatedMinutes:String(fd.get('estimatedMinutes')||'')"));
 assert.ok(html.includes("note:String(fd.get('note')||'')"));
});
test('Duty trainee can open Plan board, while Fleet and Plan restrictions stay scoped',()=>{
 assert.ok(html.includes("DUTY_ALLOWED_SCREENS=new Set(['home','planned','fleet','preferences'])"));
 assert.ok(html.includes("if(!flympusCan('operations.flightBoard.write'))return;"));
 assert.ok(html.includes("if(!flympusCan('operations.daily.write'))"));
 assert.ok(html.includes("if(!canViewDutyScreen(screen))"));
});

test('Flight planning timeline reserves briefing and debriefing across midnight',()=>{
 const flight={date:'2026-10-08',time:'23:50',mode:'INSTRUCTED',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15};
 const t=M.flightTimeline(flight);
 assert.deepEqual(t.clock,{briefing:'23:30',takeoff:'23:50',landing:'00:20 (+1d)',debrief:'00:35 (+1d)'});
 assert.equal(t.debriefEnd-t.briefingStart,65);
 assert.equal(M.flightTimeline({...flight,estimatedMinutes:0}),null);
 assert.deepEqual(M.configuredTimings(null,'INSTRUCTED'),{briefingMinutes:20,estimatedMinutes:30,debriefMinutes:15});
 assert.deepEqual(M.configuredTimings({SOLO:{briefingMinutes:5,debriefMinutes:12}},'SOLO'),{briefingMinutes:5,estimatedMinutes:30,debriefMinutes:12});
});
test('Aircraft, trainee, and instructor cannot be assigned within occupied time windows',()=>{
 const planes=[add([],'ac1','01')[0],add([],'ac2','02')[0]];
 const allowed={trainees:['t1','t2'],instructors:['i1','i2']};
 const base={time:'08:00',aircraftId:'ac1',traineeId:'t1',traineeName:'Trainee One',instructorId:'i1',instructorName:'Instructor One',mode:'INSTRUCTED',syllabus:'Circuits',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15};
 const first=M.upsertSortie([],{...base},planes,'shahak','2026-10-08',allowed,now,()=> 'one');
 const attempt=change=>M.upsertSortie(first,{...base,...change},planes,'shahak','2026-10-08',allowed,now,()=> 'two');
 assert.throws(()=>attempt({time:'08:20',traineeId:'t2',instructorId:'i2'}),/Aircraft .* already booked/);
 assert.throws(()=>attempt({time:'08:35',aircraftId:'ac2',traineeId:'t2'}),/Instructor .* briefing, flight or debriefing/);
 assert.throws(()=>attempt({time:'08:40',aircraftId:'ac2',instructorId:'i2'}),/Trainee .* briefing, flight or debriefing/);
 assert.throws(()=>attempt({time:'08:20',aircraftId:'ac2',traineeId:'t2',instructorId:'i2'}),/Another aircraft .* already has a flight/);
 assert.equal(attempt({time:'09:05',aircraftId:'ac2',traineeId:'t2'}).length,2);
 assert.equal(attempt({id:'one',time:'08:10'}).length,1);
 assert.throws(()=>attempt({estimatedMinutes:''}),/duration/);
 assert.throws(()=>attempt({briefingMinutes:-1}),/Briefing time/);
 assert.throws(()=>attempt({debriefMinutes:181}),/Debriefing time/);
});
test('Next-day activity and SOLO flight reservations respect human availability',()=>{
 const planes=[add([],'ac1','01')[0],add([],'ac2','02')[0]],ids={trainees:['t1','t2'],instructors:['i1','i2']};
 const first=M.upsertSortie([],{time:'23:50',mode:'INSTRUCTED',aircraftId:'ac1',traineeId:'t1',instructorId:'i1',syllabus:'Circuits',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15},planes,'shahak','2026-10-08',ids,now,()=> 'late');
 const solo={time:'00:25',mode:'SOLO',aircraftId:'ac2',traineeId:'t1',syllabus:'Solo',estimatedMinutes:20,briefingMinutes:10,debriefMinutes:10};
 assert.throws(()=>M.upsertSortie(first,solo,planes,'shahak','2026-10-09',ids),/Trainee/);
 assert.equal(M.upsertSortie(first,{...solo,time:'00:45'},planes,'shahak','2026-10-09',ids).length,2);
 assert.throws(()=>M.upsertSortie(first,{...solo,aircraftId:'ac1',traineeId:'t2',time:'00:05'},planes,'shahak','2026-10-09',ids),/Aircraft/);
 const legacy=[{...first[0],estimatedMinutes:null}];
 assert.throws(()=>M.upsertSortie(legacy,{...solo,time:'08:00'},planes,'shahak','2026-10-08',ids),/Existing flight/);
});
test('Plan shows one standalone form without old board chrome and displays computed timeline',()=>{
 const vm=require('node:vm'),context={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=> 'en'}};
 vm.runInNewContext(ui,context,{filename:'fleet-views.js'});
 const V=context.window.FLYMPUS_FLEET_VIEW;
 const planes=add([],'ac1','01'),ctx={fleet:planes,flights:[],date:'2026-10-08',platformId:'shahak',platformLabel:'Shahak',
   trainees:[{id:'t1',name:'Pilot'}],instructors:[{id:'i1',name:'Coach'}],syllabi:['Circuits'],canWrite:true,canConfigureTiming:true};
 const empty=V.schedule(ctx);
 assert.match(empty,/Add scheduled flight/);
 assert.match(empty,/Calculated timeline/);
 assert.match(empty,/data-flight-clock="briefing">07:40/);
 assert.match(empty,/name="estimatedMinutes"[^>]*required/);
 assert.match(empty,/name="briefingMinutes"/);
 assert.match(empty,/name="debriefMinutes"/);
 assert.doesNotMatch(empty,/Daily Flight Board|No scheduled flights for this day|card fleetSchedule/);
 assert.match(empty,/fleetTimingDefaultsForm/);
 const flight={id:'scheduled',date:'2026-10-08',platformId:'shahak',time:'08:00',mode:'INSTRUCTED',aircraftId:'ac1',tail:'01',traineeId:'t1',syllabus:'Circuits',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15};
 const booked=V.schedule({...ctx,flights:[flight]});
 assert.match(booked,/Scheduled flights/);
 assert.match(booked,/08:45/);
 assert.match(booked,/data-flight-edit="scheduled"/);
 assert.match(html,/getPlanTimingDefaults\(\)/);
 assert.match(html,/fd\.get\('briefingMinutes'\)/);
 assert.match(html,/data-flight-clock/);
});


test('Plan UI reads language preference, keeps RTL dates visible, and scales for small screens',()=>{
 const vm=require('node:vm');
 let language='he';
 const context={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=>language}};
 vm.runInNewContext(ui,context,{filename:'fleet-views.js'});
 const ctx={fleet:add([],'ac1','01'),flights:[],date:'2026-10-08',platformId:'shahak',platformLabel:'Shahak',
   trainees:[{id:'t1',name:'חניך'}],instructors:[{id:'i1',name:'מדריך'}],syllabi:['Circuits'],canWrite:true,canConfigureTiming:true};
 const he=context.window.FLYMPUS_FLEET_VIEW.schedule(ctx);
 assert.match(he,/הוספת טיסה מתוכננת/);
 assert.match(he,/ציר זמנים מחושב/);
 assert.match(he,/תדריך/);
 assert.match(he,/תחקיר/);
 assert.doesNotMatch(he,/fleetTimeFlowLegend/);
 assert.match(he,/עריכת ברירות מחדל/);
 language='en';
 const en=context.window.FLYMPUS_FLEET_VIEW.schedule(ctx);
 assert.match(en,/Add scheduled flight/);
 assert.match(en,/Calculated timeline/);
 assert.match(en,/Flight planning notes/);
 assert.doesNotMatch(en,/ציר זמנים מחושב/);
 const styles=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.doesNotMatch(styles,/\.dailyPlanHeader>div:first-child\{display:none\}/);
 assert.match(styles,/\.dailyFlightPlan \.dailyPlanHeader \.dailyPlanDateField\{display:block!important/);
 assert.match(styles,/html\[data-flympus-language="he"\] \.fleetTimeFlowClock strong/);
 assert.match(styles,/html\[data-flympus-theme="dark"\] \.dailyFlightPlan/);
 assert.match(styles,/html\.flympusLargeText \.fleetPlanFormHeading h2/);
 assert.match(styles,/@media\(max-width:480px\)/);
 assert.match(styles,/@media\(max-width:365px\)/);
 assert.match(styles,/calc\(112px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(html,/planUiText\('Flight date','תאריך טיסה'\)/);
 assert.match(html,/planUiText\('Daily Flight Plan','תוכנית טיסות יומית'\)/);
 assert.match(html,/planUiText\('Planned vs Executed','מתוכנן מול בוצע'\)/);
 assert.match(html,/key==='theme'\|\|key==='density'\|\|key==='language'\)render\(\)/);
});


test('Daily board flight counts automatically feed Planned vs Executed for the right date and platform',()=>{
 const board=[
  {id:'1',date:'2026-10-08',platformId:'shahak',mode:'INSTRUCTED'},
  {id:'2',date:'2026-10-08',platformId:'shahak',mode:'INSTRUCTED'},
  {id:'3',date:'2026-10-08',platformId:'shahak',mode:'SOLO'},
  {id:'4',date:'2026-10-09',platformId:'shahak',mode:'SOLO'},
  {id:'5',date:'2026-10-08',platformId:'aerostar',mode:'SOLO'}
 ];
 assert.deepEqual(M.plannedFlightCounts(board,'2026-10-08','shahak'),{total:3,instructed:2,solo:1});
 assert.deepEqual(M.plannedFlightCounts(board,'2026-10-09','shahak'),{total:1,instructed:0,solo:1});
 assert.deepEqual(M.plannedFlightCounts(board,'2026-10-08','aerostar'),{total:1,instructed:0,solo:1});
 const env={window:{FLYMPUS_FLEET_MODEL:M},getDailyFlightBoard:()=>board,currentFleetPlatform:()=> 'shahak',
  readCourseArray:()=>[],persistCourseOperations:()=>true};
 const helper=html.slice(html.indexOf('function flightBoardPlanStatus('),html.indexOf('function getPlanTimingDefaults(){'));
 const vm=require('node:vm');
 vm.runInNewContext(helper,env);
 assert.equal(env.flightBoardPlanStatus('2026-10-08').linked,true);
 assert.equal(env.flightBoardPlanStatus('2026-10-08').instructed,2);
 assert.equal(env.flightBoardPlanStatus('2026-10-08').solo,1);
 let persisted=[];
 env.getDailyFlightBoard=()=>[];
 env.readCourseArray=()=>persisted;
 env.persistCourseOperations=(key,dates)=>{persisted=dates;return true};
 assert.equal(env.flightBoardPlanStatus('2026-10-08').linked,false);
 assert.equal(env.markFlightBoardPlanManaged('2026-10-08'),true);
 assert.equal(env.flightBoardPlanStatus('2026-10-08').linked,true);
 assert.equal(env.flightBoardPlanStatus('2026-10-08').total,0);
});
test('Planned vs Executed uses booked counts over old manual values without cross-date draft leakage',()=>{
 const vm=require('node:vm');
 const source=html.slice(html.indexOf('function plannedCompleteness(){'),html.indexOf('function plannedAttentionCount(){'));
 const day='2026-10-08',other='2026-10-09';
 const base={state:{planDate:day,planInstructed:9,planSolo:8},
  getDailyReports:()=>[{date:day,plannedInstructed:7,plannedSolo:6}],
  getActivityDraft:()=>({data:{date:other,plannedInstructed:88,plannedSolo:77}}),
  getEvaluations:()=>[],getSoloFlights:()=>[],cfgGet:()=>({cancellationReasons:[]}),
  flightBoardPlanStatus:()=>({linked:true,instructed:2,solo:1})};
 vm.runInNewContext(source,base);
 let data=base.plannedCompleteness();
 assert.equal(data.pi,2);assert.equal(data.ps,1);assert.equal(data.boardLinked,true);
 assert.equal(data.draft.plannedInstructed,undefined);
 base.state={planDate:day};
 base.flightBoardPlanStatus=()=>({linked:false,instructed:0,solo:0});
 data=base.plannedCompleteness();
 assert.equal(data.pi,7);assert.equal(data.ps,6);assert.equal(data.boardLinked,false);
});
test('Plan displays consistently red required markers and read-only board-derived PVE totals',()=>{
 const vm=require('node:vm');
 const context={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=> 'en'}};
 vm.runInNewContext(ui,context,{filename:'fleet-views.js'});
 const screen=context.window.FLYMPUS_FLEET_VIEW.schedule({
  fleet:add([],'ac1','01'),flights:[],date:'2026-10-08',platformId:'shahak',
  trainees:[{id:'t1',name:'Trainee'}],instructors:[{id:'i1',name:'Instructor'}],
  syllabi:['Circuits'],canWrite:true,canConfigureTiming:true});
 assert.equal((screen.match(/fleetRequired/g)||[]).length,1);
 assert.doesNotMatch(screen,/<label>[^<]* \*<\/label>/);
 assert.match(screen,/<label>Takeoff time<\/label>.*?name="time" type="time" required/);
 assert.match(screen,/<label>Instructor <span class="fleetRequired"/);
 assert.match(screen,/fleetFieldHead/);
 assert.doesNotMatch(screen,/<label>Aircraft \* <button/);
 assert.match(html,/planUiText\('Flight date','תאריך טיסה'\).*fleetRequired/);
 assert.match(html,/boardLinked\?'readonly aria-readonly="true"/);
 assert.match(html,/board\.linked\?board\.instructed/);
 assert.match(html,/board\.linked\?board\.solo/);
 assert.match(html,/markFlightBoardPlanManaged\(date\)/);
 assert.match(html,/markFlightBoardPlanManaged\(record\.date\)/);
 const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(css,/\.dailyFlightPlan \.fleetRequired,\.coursePlanWorkspace \.fleetRequired\{color:#c62828!important/);
 assert.match(css,/html\[data-flympus-theme="dark"\] \.fleetRequired/);
 assert.match(css,/\.fleetSortieFormGrid label:has\(\.fleetRequired\)::after\{content:none!important;display:none!important\}/);
 assert.match(css,/html\.flympusLargeText \.pveBoardLinkedNote/);
});


test('Course timing defaults appear directly before scheduled flight form in all modes',()=>{
 const vm=require('node:vm'),language={value:'en'};
 const scope={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=>language.value}};
 vm.runInNewContext(ui,scope,{filename:'fleet-views.js'});
 const ctx={fleet:[],flights:[],date:'2026-10-08',platformId:'shahak',platformLabel:'Shahak',
  trainees:[],instructors:[],syllabi:[],canWrite:true,canConfigureTiming:true};
 const english=scope.window.FLYMPUS_FLEET_VIEW.schedule(ctx);
 const settingsAt=english.indexOf('class="fleetTimingSettings"');
 const formAt=english.indexOf('id="fleetSortieForm"');
 assert.ok(settingsAt>0&&formAt>settingsAt);
 assert.ok(english.indexOf('id="fleetFlightBoard"')<settingsAt);
 assert.ok(english.indexOf('id="fleetTimingDefaultsForm"')>settingsAt&&english.indexOf('id="fleetTimingDefaultsForm"')<formAt);
 assert.equal((english.match(/id="fleetTimingDefaultsForm"/g)||[]).length,1);
 assert.equal((english.match(/id="fleetSortieForm"/g)||[]).length,1);
 language.value='he';
 const hebrew=scope.window.FLYMPUS_FLEET_VIEW.schedule(ctx);
 assert.ok(hebrew.indexOf('עריכת ברירות מחדל לזמני הטיסה')<hebrew.indexOf('הוספת טיסה מתוכננת'));
 const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(css,/\.fleetSchedulePlain>\.fleetTimingSettings[\s\S]*?order:0/);
 assert.match(css,/\.fleetSchedulePlain>\.fleetSortieForm\{order:1\}/);
 assert.match(css,/\.fleetSchedulePlain>\.fleetBookedFlights\{order:2\}/);
 assert.match(css,/html\[data-flympus-theme="dark"\] \.dailyFlightPlan \.fleetSchedulePlain>\.fleetTimingSettings/);
 assert.match(css,/@media\(max-width:560px\)/);
});


test('Daily Flight Plan owns the only editable flight-date selector for both Plan tabs',()=>{
 const vm=require('node:vm');
 const source=html.slice(html.indexOf('function planUiText('),html.indexOf('function planWorkspace(){'));
 const context={
  state:{planDate:'2026-10-08'},todayIsoDate:()=> '2026-10-09',
  getFlympusAppPreferences:()=>({language:'en'}),
  esc:x=>String(x),dateInputValue:date=>date.slice(8)+'/'+date.slice(5,7)+'/'+date.slice(0,4),
  courseFlightScheduleHtml:date=>'<aside data-board-date="'+date+'"></aside>'
 };
 vm.runInNewContext(source,context);
 const daily=context.dailyFlightPlan();
 assert.match(daily,/dailyPlanDateSpotlight/);
 assert.match(daily,/id="dailyPlanDate" type="text"/);
 assert.match(daily,/value="08\/10\/2026"/);
 assert.match(daily,/data-board-date="2026-10-08"/);
 assert.match(daily,/One date for all scheduled flights/);
 assert.equal((daily.match(/id="dailyPlanDate"/g)||[]).length,1);
 const report=html.slice(html.indexOf('function plannedVsExecuted(){'),html.indexOf('function bindPlanned(){'));
 assert.match(report,/class="pveDateControl pveDateReadOnly"/);
 assert.match(report,/type="hidden" value=/);
 assert.match(report,/id="pveDate" type="hidden"/);
 assert.match(report,/data-plan-view="board"/);
 assert.doesNotMatch(report,/id="pveDate" type="text"/);
 const dateHandler=html.slice(html.indexOf('function bindPlanWorkspace(){'),html.indexOf('function plannedVsExecuted(){'));
 assert.match(dateHandler,/const normalized=normalizeDateValue\(e\.target\.value\)/);
 assert.match(dateHandler,/state\.planDate=normalized/);
 assert.match(dateHandler,/saveUiState\(\)/);
 assert.doesNotMatch(html,/if\(\$\('#pveDate'\)\)\$\('#pveDate'\)\.onchange/);
 assert.match(html,/planDate:state\.planDate,planView:state\.planView/);
 const uiCSS=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(uiCSS,/\.dailyPlanHeader\.dailyPlanDateSpotlight/);
 assert.match(uiCSS,/html\[data-flympus-theme="dark"\] \.dailyFlightPlan \.dailyPlanHeader\.dailyPlanDateSpotlight/);
 assert.match(uiCSS,/html\.flympusLargeText \.dailyPlanDateSpotlight/);
 assert.match(uiCSS,/@media\(max-width:660px\)/);
 assert.match(uiCSS,/\.pveDateReadOnly/);
 context.getFlympusAppPreferences=()=>({language:'he'});
 assert.match(context.dailyFlightPlan(),/תאריך אחד לשיבוצי הטיסות/);
});


test('Plan contract stays coherent: full-width flight day, settings, required fields, theme and execution totals',()=>{
 const vm=require('node:vm');
 const lang={value:'en'},context={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=>lang.value}};
 vm.runInNewContext(ui,context,{filename:'fleet-views.js'});
 const screen=context.window.FLYMPUS_FLEET_VIEW.schedule({
  fleet:add([],'ac1','01'),flights:[],platformId:'shahak',platformLabel:'Shahak',date:'2026-10-08',
  trainees:[{id:'t1',name:'Trainee'}],instructors:[{id:'i1',name:'Instructor'}],
  syllabi:['Circuits'],canWrite:true,canConfigureTiming:true});
 assert.ok(screen.indexOf('fleetTimingSettings')<screen.indexOf('fleetSortieForm'));
 assert.doesNotMatch(screen,/Daily Flight Board|No scheduled flights for this day/);
 assert.match(screen,/name="estimatedMinutes"[^>]*required/);
 assert.match(screen,/fleetTimeFlow/);
 assert.equal((screen.match(/fleetRequired/g)||[]).length,1);
 assert.match(screen,/data-go="fleet"/);
 const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(css,/\.dailyFlightPlan\{max-width:none;width:100%;margin:0 auto/);
 assert.match(css,/\.dailyFlightPlan \.dailyPlanHeader\.dailyPlanDateSpotlight\{max-width:100%;width:100%;margin:0!important/);
 assert.match(css,/\.dailyFlightPlan \.fleetSchedulePlain>\.fleetTimingSettings,/);
 assert.match(css,/\.dailyFlightPlan \.fleetSchedulePlain>\.fleetSortieForm,/);
 assert.match(css,/html\[data-flympus-language="he"\] \.dailyPlanDateSpotlight/);
 assert.match(css,/html\[data-flympus-theme="dark"\] \.dailyFlightPlan \.dailyPlanHeader\.dailyPlanDateSpotlight/);
 assert.match(css,/html\.flympusLargeText \.dailyPlanDateSpotlight/);
 assert.match(css,/@media\(max-width:660px\)/);
 const report=html.slice(html.indexOf('function plannedVsExecuted(){'),html.indexOf('function bindPlanned(){'));
 assert.match(report,/pveDateReadOnly/);
 assert.doesNotMatch(report,/id="pveDate" type="text"/);
 assert.match(report,/boardLinked\?'readonly aria-readonly="true"/);
 assert.match(html,/flightBoardPlanStatus\(date\)/);
 assert.match(html,/FLYMPUS Review · build 0787/);
 lang.value='he';
 assert.match(context.window.FLYMPUS_FLEET_VIEW.schedule({
  fleet:[],flights:[],platformId:'shahak',date:'2026-10-08',trainees:[],instructors:[],syllabi:[],canWrite:true,canConfigureTiming:true
 }),/עריכת ברירות מחדל לזמני הטיסה/);
});

test('Airborne defaults support custom durations and reject invalid values without altering saved flights',()=>{
 assert.equal(M.configuredTimings({SOLO:{estimatedMinutes:45}},'SOLO').estimatedMinutes,45);
 for(const value of [0,721,'bad'])assert.equal(M.configuredTimings({SOLO:{estimatedMinutes:value}},'SOLO').estimatedMinutes,30);
 const saved={date:'2026-10-09',time:'08:00',mode:'SOLO',estimatedMinutes:25,briefingMinutes:10,debriefMinutes:10};
 assert.equal(M.flightTimeline(saved,{SOLO:{estimatedMinutes:60}}).estimatedMinutes,25);
});

test('Flight planning renders briefing, flight duration and debriefing with per-mode minute dropdowns',()=>{
 const vm=require('node:vm');const context={window:{FLYMPUS_FLEET_MODEL:M},document:{documentElement:{dataset:{}}}};
 vm.runInNewContext(ui,context);
 const out=context.window.FLYMPUS_FLEET_VIEW.schedule({fleet:[],flights:[],platformId:'shahak',date:'2026-10-09',trainees:[],instructors:[],syllabi:[],canWrite:true,canConfigureTiming:true,timingDefaults:{INSTRUCTED:{estimatedMinutes:42}}});
 const defaults=out.slice(out.indexOf('id="fleetTimingDefaultsForm"'),out.indexOf('id="fleetSortieForm"'));
 for(const mode of ['INSTRUCTED','SOLO'])assert(defaults.indexOf(mode+'_briefingMinutes')<defaults.indexOf(mode+'_estimatedMinutes')&&defaults.indexOf(mode+'_estimatedMinutes')<defaults.indexOf(mode+'_debriefMinutes'));
 const block=out.slice(out.indexOf('<fieldset class="fleetFlightDurations"'),out.indexOf('</fieldset>'));
 assert(block.indexOf('name="briefingMinutes"')<block.indexOf('name="estimatedMinutes"')&&block.indexOf('name="estimatedMinutes"')<block.indexOf('name="debriefMinutes"'));
 assert.match(block,/name="estimatedMinutes"[^>]*required[^>]*><option[\s\S]*?value="42" selected/);
 assert.match(block,/Flight duration/);
 assert.match(block,/value="10"[^>]*>10 min/);
 assert.match(block,/value="35"[^>]*>35 min/);
 assert.doesNotMatch(block,/Flight duration \(min\)|type="number"/);
 assert.doesNotMatch(out,/Available again|fleetTimeFlowLegend/);
 assert.match(out,/--phase-brief:20fr;--phase-flight:42fr;--phase-debrief:15fr/);
 assert.doesNotMatch(out,/Planned duration/);
});

test('Course timing presets divide instructed and solo settings with visible section rules',()=>{
 const vm=require('node:vm');
 const ctx={window:{FLYMPUS_FLEET_MODEL:M},document:{documentElement:{dataset:{}}}};
 vm.runInNewContext(ui,ctx);
 const out=ctx.window.FLYMPUS_FLEET_VIEW.schedule({fleet:[],flights:[],platformId:'shahak',date:'2026-10-09',trainees:[],instructors:[],syllabi:[],canWrite:true,canConfigureTiming:true});
 assert.ok(out.indexOf('fleetTimingModeINSTRUCTED')>0);
 assert.ok(out.indexOf('fleetTimingModeSOLO')>out.indexOf('fleetTimingModeINSTRUCTED'));
 assert.match(out,/Instructed flights/);assert.match(out,/Solo flights/);
 assert.equal((out.match(/class="fleetTimingModeFields"/g)||[]).length,2);
 const stylesheet=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(stylesheet,/\.fleetTimingModeFields\{display:grid/);
 assert.match(stylesheet,/\.fleetTimingModeSOLO\{border-inline-start-color/);
});

test('Plan consistently uses full Briefing / Flight / Debriefing terminology',()=>{
 const vm=require('node:vm');
 let language='en';
 const ctx={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=>language},document:{documentElement:{dataset:{}}}};
 vm.runInNewContext(ui,ctx);
 const props={fleet:[],flights:[],platformId:'shahak',date:'2026-10-09',trainees:[],instructors:[],syllabi:[],canWrite:true,canConfigureTiming:true};
 const english=ctx.window.FLYMPUS_FLEET_VIEW.schedule(props);
 assert.match(english,/data-phase="brief">[\s\S]*?class="fleetTimeFlowPhaseText">Briefing<\/span>/);
 assert.match(english,/data-phase="flight">[\s\S]*?class="fleetTimeFlowPhaseText">Flight<\/span>/);
 assert.match(english,/data-phase="debrief">[\s\S]*?class="fleetTimeFlowPhaseText">Debriefing<\/span>/);
 assert.doesNotMatch(english,/data-phase="debrief">Debrief<\/span>/);
 assert.match(english,/name="INSTRUCTED_debriefMinutes"/);
 assert.match(english,/name="SOLO_debriefMinutes"/);
 language='he';
 const hebrew=ctx.window.FLYMPUS_FLEET_VIEW.schedule(props);
 assert.match(hebrew,/data-phase="debrief">[\s\S]*?class="fleetTimeFlowPhaseText">תחקיר<\/span>/);
 const app=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 assert.match(app,/Briefing \/ Debriefing: 0–180 min\. Flight duration: 1–720 min\./);
});

test('Plan timeline option 1 shows all four chronological boundaries at correct phase edges in both languages',()=>{
 const vm=require('node:vm');
 let language='en';
 const sandbox={window:{FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=>language}};
 vm.runInNewContext(ui,sandbox);
 const settings={fleet:[],flights:[],platformId:'shahak',date:'2026-10-09',trainees:[],instructors:[],syllabi:[],canWrite:true,canConfigureTiming:true};
 const render=()=>sandbox.window.FLYMPUS_FLEET_VIEW.schedule(settings);
 const english=render();
 for(const [phase,word] of [['brief','Briefing'],['flight','Flight'],['debrief','Debriefing']]){
  assert.match(english,new RegExp('data-phase="'+phase+'"[^>]*>.*?'+word));
 }
 assert.equal((english.match(/class="fleetTimeFlowClock fleetTimeFlowClock/g)||[]).length,4);
 assert.match(english,/fleetTimeFlowClockStart[^>]*>[\s\S]*?data-flight-clock="briefing">07:40/);
 assert.match(english,/fleetTimeFlowClockTakeoff[^>]*>[\s\S]*?data-flight-clock="takeoff">08:00/);
 assert.match(english,/fleetTimeFlowClockLanding[^>]*>[\s\S]*?data-flight-clock="landing">08:30/);
 assert.match(english,/fleetTimeFlowClockEnd[^>]*>[\s\S]*?data-flight-clock="debrief">08:45/);
 assert.equal((english.match(/class="fleetTimeFlowIcon"/g)||[]).length,3);
 assert.match(english,/--phase-brief:20fr;--phase-flight:30fr;--phase-debrief:15fr/);
 language='he';const hebrew=render();
 assert.match(hebrew,/data-phase="brief"[^>]*>[\s\S]*?תדריך/);
 assert.match(hebrew,/data-phase="debrief"[^>]*>[\s\S]*?תחקיר/);
 for(const clock of ['07:40','08:00','08:30','08:45'])assert.match(hebrew,new RegExp(clock));
 const stylesheet=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(stylesheet,/\.fleetTimeFlowTrack,\s*\.fleetTimeFlowBoundaryTimes\s*\{[\s\S]*?grid-template-columns:minmax\(0,var\(--phase-brief\)\) minmax\(0,var\(--phase-flight\)\) minmax\(0,var\(--phase-debrief\)\)/);
 assert.match(stylesheet,/html\[data-flympus-language="he"\] \.fleetTimeFlowClock strong/);
 assert.match(stylesheet,/@media\(max-width:600px\)\{[\s\S]*?\.fleetTimeFlowIcon\{display:none!important\}/);
 assert.match(stylesheet,/html\[data-flympus-theme="dark"\] \.fleetTimeFlowClock strong/);
 assert.match(stylesheet,/html\.flympusLargeText \.fleetTimeFlowClock strong/);
});

test('Plan Flight and Debriefing graphics reuse Fleet airplane and Exams lined document, without checkmark',()=>{
 const nav=html.slice(html.indexOf('function navIconSvg(name){'),html.indexOf('function bottomNavIconSvg('));
 const fleet=nav.match(/fleet:'([^']+)'/),exams=nav.match(/exams:'([^']+)'/);
 assert.ok(fleet&&exams);
 assert.match(ui,/const iconFlight=iconSvg\('<path d="M17\.8 19\.2 16 11/);
 assert.match(ui,/const iconDebrief=iconSvg\('[\s\S]*?M8\.5 10\.5h7M8\.5 14h7M8\.5 17\.5h5/);
 assert.match(exams[1],/M9.5 11h5.5M9.5 14h5.5M9.5 17h3.5/);
 assert.doesNotMatch(exams[1],/m9 13 2 2 4-4/);
 const vm=require('node:vm'),ctx={window:{FLYMPUS_FLEET_MODEL:M}};
 vm.runInNewContext(ui,ctx);
 const out=ctx.window.FLYMPUS_FLEET_VIEW.schedule({fleet:[],flights:[],platformId:'aerostar',date:'2026-10-09',trainees:[],instructors:[],syllabi:[],canWrite:true});
 assert.equal((out.match(/class="fleetTimeFlowIcon"/g)||[]).length,3);
 assert.match(out,/data-phase="flight"/);
 assert.match(out,/data-phase="debrief"/);
});
test('Planned vs Executed date moves to locale start and remains stacked on mobile',()=>{
 assert.match(html,/class="pveDateRow"/);
 assert.match(html,/class="pveDateControl pveDateReadOnly"/);
 assert.match(html,/data-plan-view="board"/);
 const from=html.indexOf('/* Planned vs Executed: flight date at the logical start');
 const to=html.indexOf('.pveDateRow{display:grid;',from);
 assert.ok(from>0&&to>from);
 const css=html.slice(from,to);
 assert.match(css,/\.coursePlanWorkspace \.pveDateRow\{direction:ltr;grid-template-columns:minmax\(170px,220px\) minmax\(0,1fr\)/);
 assert.match(css,/\.pveDateRow>\.pveDateReadOnly\{grid-column:1;grid-row:1/);
 assert.match(css,/\.pveDateRow>div:first-child\{grid-column:2;grid-row:1/);
 assert.match(css,/html\[data-flympus-language="he"\] \.coursePlanWorkspace \.pveDateRow\{direction:rtl\}/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?\.pveDateRow>div:first-child\{grid-column:1;grid-row:2\}/);
 const planCSS=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(planCSS,/html\[data-flympus-theme="dark"\] \.pveDateReadOnly strong/);
 assert.match(planCSS,/html\.flympusLargeText \.coursePlanWorkspace \.pveDateReadOnly strong/);
});
