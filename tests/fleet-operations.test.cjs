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
 assert.ok(page.includes("view==='board'?dailyFlightPlan():view==='approvals'"));
 assert.ok(html.includes("case'planned':html=planWorkspace();break"));
 assert.ok(html.includes("if(state.planView==='report')bindPlanned();else if(state.planView!=='approvals')bindDailyFlightBoard()"));
 assert.ok(html.includes("b.dataset.planToday==='true'?{planView:'board',planDate:todayIsoDate()"));
 const homeSource=html.slice(html.indexOf('function home(){'),html.indexOf('function evaluationHistoryViewHtml('));
 assert.match(homeSource, /<h2>Today.*s Plan<\/h2>/);
 assert.ok(homeSource.includes('<span class="homeDateChip">'));
 assert.ok(homeSource.includes('<div class="homePlanRow homePlanRowTimeline">'));
 assert.ok(homeSource.includes('<div class="homePlanRow homePlanEmpty">'));
 assert.ok(!homeSource.includes('data-plan-today="true"'),'Home Today Plan must not navigate to Plan');
 assert.ok(!homeSource.includes('homePlanTitleButton'),'Home Today Plan title must not be a button');
 assert.ok(!homeSource.includes('homePlanDateButton'),'Home Today Plan date must not be a button');
 assert.ok(!homeSource.includes('data-go="reports"'),'Course Pulse no longer offers View Reports');
 assert.ok(html.includes("case'reports':html=reports();break"),'Reports navigation remains available');
 assert.ok(!html.includes("courseFlightScheduleHtml(date)+\n '<section class=\"card pvePanel\">"));
});

test('Solo actual duration defaults to the matching planned flight, not other users or instructed flights',()=>{
 const flights=[
  {date:'2026-10-09',platformId:'shahak',mode:'INSTRUCTED',traineeId:'t1',syllabus:'Solo A',estimatedMinutes:80},
  {date:'2026-10-09',platformId:'shahak',mode:'SOLO',traineeId:'t1',syllabus:'Solo A',estimatedMinutes:25},
  {date:'2026-10-09',platformId:'shahak',mode:'SOLO',traineeId:'t2',syllabus:'Solo B',estimatedMinutes:35},
  {date:'2026-10-09',platformId:'shahak',mode:'SOLO',traineeId:'t1',syllabus:'Solo A',estimatedMinutes:40},
  {date:'2026-10-10',platformId:'shahak',mode:'SOLO',traineeId:'t1',syllabus:'Solo A',estimatedMinutes:60}
 ];
 assert.equal(M.plannedSoloDuration(flights,'2026-10-09','t1','Solo A',0,30,'shahak'),25);
 assert.equal(M.plannedSoloDuration(flights,'2026-10-09','t1','Solo A',1,30,'shahak'),40);
 assert.equal(M.plannedSoloDuration(flights,'2026-10-09','t2','Solo B',0,30,'shahak'),35);
 assert.equal(M.plannedSoloDuration(flights,'2026-10-09','','',0,30,'shahak'),25);
 assert.equal(M.plannedSoloDuration(flights,'2026-10-09','t3','Solo X',0,45,'shahak'),45);
 assert.equal(M.plannedSoloDuration(flights,'2026-10-11','t1','Solo A',0,20,'shahak'),20);
 assert.equal(M.plannedSoloDuration(flights,'2026-10-09','t1','Solo A',0,30,'another'),30);
});
test('Solo execution UI has actual-duration dropdown, preserved manual choice and four main desktop controls',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/plannedSoloMinutes\(d\.traineeId/);
 assert.match(html,/evaluationDurationOptions\(chosenMinutes\)/);
 assert.match(html,/name="minutes" required/);
 assert.match(html,/name="quantity" aria-label/);
 assert.match(html,/name="durationOverridden"/);
 assert.match(html,/const actualMinutes=Number\(fd\.get\('minutes'\)\)/);
 assert.match(html,/minutes:actualMinutes,createdAt/);
 assert.match(html,/data-edit-minutes required/);
 assert.match(html,/\.pveSoloPrimary\{display:grid;grid-template-columns:minmax\(0,1\.3fr\)/);
 assert.match(html,/@media\(max-width:370px\)\{\.pveSoloPrimary\{grid-template-columns:1fr\}/);
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
 const env={dutyOperations:null,window:{FLYMPUS_FLEET_MODEL:M},getDailyFlightBoard:()=>board,currentFleetPlatform:()=> 'shahak',
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
 const base={dutyOperations:null,getPlanExecutedInstructed:()=>0,getPlanWorkingSoloFlights:()=>[],state:{planDate:day,planInstructed:9,planSolo:8},
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
  dutyOperations:null,state:{planDate:'2026-10-08'},todayIsoDate:()=> '2026-10-09',
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
 assert.match(html,/<meta name="flympus-deploy-build" content="__FLYMPUS_DEPLOY_BUILD__">/);
  assert.match(html,/function flympusBuildLabel\(\)/);
  assert.doesNotMatch(html,/FLYMPUS Review · build 0800/);
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
 assert.equal((english.match(/class="fleetTimeFlowIcon(?: fleetTimeFlowFlightIcon)?"/g)||[]).length,3);
 assert.match(english,/--phase-brief:20fr;--phase-flight:30fr;--phase-debrief:15fr/);
 language='he';const hebrew=render();
 assert.match(hebrew,/data-phase="brief"[^>]*>[\s\S]*?תדריך/);
 assert.match(hebrew,/data-phase="debrief"[^>]*>[\s\S]*?תחקיר/);
 for(const clock of ['07:40','08:00','08:30','08:45'])assert.match(hebrew,new RegExp(clock));
 const stylesheet=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(stylesheet,/\.fleetTimeFlowTrack,\s*\.fleetTimeFlowBoundaryTimes\s*\{[\s\S]*?grid-template-columns:minmax\(0,var\(--phase-brief\)\) minmax\(0,var\(--phase-flight\)\) minmax\(0,var\(--phase-debrief\)\)/);
 assert.match(stylesheet,/html\[data-flympus-language="he"\] \.fleetTimeFlowClock strong/);
 assert.match(stylesheet,/@media\(max-width:600px\)\{[\s\S]*?\.fleetTimeFlowIcon\{height:18px;width:18px\}/);
 assert.doesNotMatch(stylesheet.split('/* Mobile calculated timeline:')[0],/\.fleetTimeFlow(?:Flight)?Icon\s*\{[^}]*display\s*:\s*none/);
 assert.match(stylesheet,/html\[data-flympus-theme="dark"\] \.fleetTimeFlowClock strong/);
 assert.match(stylesheet,/html\.flympusLargeText \.fleetTimeFlowClock strong/);
});

test('Plan uses instructor plane outline and checked debrief clipboard',()=>{
 const vm=require('node:vm');
 const sandbox={window:{FLYMPUS_FLEET_MODEL:M}};
 vm.runInNewContext(ui,sandbox);
 const rendered=sandbox.window.FLYMPUS_FLEET_VIEW.schedule({fleet:[],flights:[],platformId:'shahak',date:'2026-10-09',trainees:[],instructors:[],syllabi:[],canWrite:true});
 const timeline=rendered.match(/<div class="fleetTimeFlowTrack">([\s\S]*?)<div class="fleetTimeFlowBoundaryTimes">/)[1];
 const icons=[...timeline.matchAll(/<svg\b([^>]+)>([\s\S]*?)<\/svg>/g)];
 assert.equal(icons.length,3,'Each timeline phase renders a real SVG');
 for(const [,attributes,body] of icons){
  assert.match(attributes,/width="20" height="20" viewBox="0 0 24 24"/);
  assert.match(attributes,/fill="none" stroke="currentColor" stroke-width="1.6"/);
  assert.match(attributes,/aria-hidden="true" focusable="false"/);
  assert.doesNotMatch(body,/fill="(?!none)/);
 }
 assert.match(icons[1][1],/class="fleetTimeFlowIcon fleetTimeFlowFlightIcon"/);
 assert.match(icons[1][2],/^<path d="[^"<>]+Z"\/>$/,'Flight is one closed hollow contour');
 assert.doesNotMatch(icons[1][2],/transform=/,'The reference plane keeps its right-facing orientation');
 assert.doesNotMatch(timeline,/✈|&#(?:9992|x2708);|<span[^>]*fleetTimeFlowFlightIcon/);
 assert.match(icons[2][2],/<rect\b/);
 assert.match(icons[2][2],/m9 13 2.2 2.2L16 10.5/,'Debrief keeps the checked clipboard');
 const stylesheet=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(stylesheet,/\.fleetTimeFlowIcon\{height:20px;width:20px;flex:0 0 auto;display:block;fill:none;stroke:currentColor\}/);
 assert.doesNotMatch(stylesheet,/-webkit-text-(?:stroke|fill-color)/);
 assert.doesNotMatch(html,/\.fleetTimeFlow(?:Flight)?Icon\s*\{/,'No embedded HTML rule overrides the icon stylesheet');
 assert.doesNotMatch(stylesheet.split('/* Mobile calculated timeline:')[0],/\.fleetTimeFlow(?:Flight)?Icon\s*\{[^}]*(?:!important|font-family|font-size|transform)/);
 assert.match(stylesheet,/\.fleetTimeFlowTrack>span\+span\{border-inline-start:3px solid #fff\}/,'Approved inter-phase gaps stay intact');
 for(const [phase,background,color] of [['brief','#f8ead1','#91661f'],['flight','#dcecff','#155b99'],['debrief','#dff3e7','#19724a']]){
  assert.ok(stylesheet.includes('[data-phase="'+phase+'"]{background:'+background+';color:'+color+'}'));
 }
 const worker=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 for(const [asset,version] of [['assets/fleet-views.js','20261010-plan-cards-polish-0826'],['assets/fleet-operations.css','20261010-plan-cards-polish-0826']]){
  assert.ok(html.includes('./'+asset+'?v='+version));
  assert.ok(worker.includes('./'+asset+'?v='+version));
 }
 assert.match(worker,/const FLYMPUS_SW_VERSION='2026-10-10-roster-swipe-admin-0827'/);
 assert.equal((html.match(/\.\/sw\.js\?v=20261010-flight-time-only-seamless-0820/g)||[]).length,2);
});
test('Mobile calculated timeline preserves proportions and hides icons without broken text',()=>{
 const stylesheet=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 const marker='/* Mobile calculated timeline: preserve proportional widths without squeezing icons or breaking phase names. */';
 const mobile=stylesheet.slice(stylesheet.indexOf(marker));
 assert.ok(stylesheet.includes(marker),'Mobile-only override must exist');
 assert.match(mobile,/@media\(max-width:600px\)\{/);
 assert.match(mobile,/\.fleetTimeFlowTrack \.fleetTimeFlowIcon\{display:none!important\}/);
 assert.match(mobile,/\.fleetTimeFlowTrack>span\{container:timeline-phase \/ inline-size\}/);
 assert.match(mobile,/text-overflow:ellipsis;white-space:nowrap/);
 assert.match(mobile,/overflow-wrap:normal;word-break:normal;hyphens:none/);
 assert.match(mobile,/@container timeline-phase \(max-width:45px\)\{/);
 assert.match(mobile,/\.fleetTimeFlowPhaseText\{opacity:0\}/);
 assert.match(stylesheet,/\.fleetTimeFlowIcon\{height:20px;width:20px;flex:0 0 auto;display:block/,'Desktop icons must remain');
 assert.match(stylesheet,/grid-template-columns:minmax\(0,var\(--phase-brief\)\) minmax\(0,var\(--phase-flight\)\) minmax\(0,var\(--phase-debrief\)\)/,'The times stay proportional');
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

test('Planned Solo UI automatically opens exact unexecuted slots, groups batches and mirrors labels',()=>{
 const vm=require('node:vm');
 const start=html.indexOf('function plannedCompleteness(){'),end=html.indexOf('function globalBackControl(){',start);
 assert.ok(start>=0&&end>start);
 const program=html.slice(start,end);
 const config={cancellationReasons:[{id:'weather',name:'Weather'}]};
 let solo=[],saved=null,language='en';
 const scope={
   dutyOperations:null,isDutyTrainee:()=>false,getPlanExecutedInstructed:()=>0,getPlanWorkingSoloFlights:()=>solo,
   getPlanWorkingFlights:()=>[],getPlanTimingDefaults:()=>({}),currentFleetPlatform:()=> 'shahak',
   window:{FLYMPUS_FLEET_MODEL:M},evaluationDurationOptions:minutes=>'<option value="'+minutes+'" selected>'+minutes+' min</option>',
   state:{planDate:'2026-10-09'},getDailyReports:()=>[],
   getActivityDraft:()=>({data:{date:'2026-10-09',plannedInstructed:0,plannedSolo:4,cancellations:saved||[]}}),
   getSoloFlights:()=>solo,getEvaluations:()=>[],flightBoardPlanStatus:()=>({linked:false,instructed:0,solo:0}),
   cfgGet:()=>config,courseTrainees:()=>[{id:'t1',name:'Test Trainee',status:'Active'}],
   courseMembershipFor:()=>({status:'Active'}),alphaByName:items=>items,currentCourseTrackingCounters:()=>[],
   evaluationSyllabusDefs:()=>[{name:'Solo circuits',mode:'SOLO'}],
   getFlympusAppPreferences:()=>({language}),
   staticRequiredCompletionPanel:()=>'',esc:value=>String(value||''),
   formatDateDMY:()=> '09/10/2026',dateInputValue:()=> '09/10/2026',
   draftSavedLabel:()=> 'Auto-save ready'
 };
 const run=()=>vm.runInNewContext(program+'\nplannedVsExecuted()',scope);
 let out=run();
 assert.equal((out.match(/data-solo-slot=/g)||[]).length,4,'Four planned solos should open four pending entry forms');
 assert.equal((out.match(/data-solo-skip=/g)||[]).length,4,'Every pending solo can be removed');
 assert.doesNotMatch(out,/>Add solo flight<\/button>/);
 assert.match(out,/name="quantity" aria-label="Executed flight count" type="number" inputmode="numeric" min="1" max="4"/);
 assert.equal((out.match(/class="pveCancellationQuantity"/g)||[]).length,0,'Counter exists with combined class and data attribute');
 assert.match(out,/pveCancellationQuantity/);
 saved=[{key:'SOLO_1',type:'Solo',reasonId:'weather',reasonLabel:'Weather',quantity:2}];
 out=run();
 assert.match(out,/data-cancel-qty[^>]*value="2"/);
 assert.equal((out.match(/class="pveCancellationRow"/g)||[]).length,3,'Grouped reason covers two slots, two remain unclassified');
 solo=[{id:'a',batchId:'batch',date:'2026-10-09',traineeName:'Test Trainee',syllabus:'Solo circuits'},
       {id:'b',batchId:'batch',date:'2026-10-09',traineeName:'Test Trainee',syllabus:'Solo circuits'}];
 out=run();
 assert.equal((out.match(/data-solo-slot=/g)||[]).length,2);
 assert.equal((out.match(/data-solo-batch="batch"/g)||[]).length,1,'Saved solos stay in the same editable list');
 assert.match(out,/Solo × 2/);
 assert.doesNotMatch(out,/pveRecordedList/);
 assert.doesNotMatch(out,/>Record<\/button>/);
 language='he';out=run();
 assert.match(out,/ביצוע טיסות סולו/);
});
test('planned solo recording never writes beyond the plan and every grouped flight carries counters',()=>{
 const a=html.indexOf("document.querySelectorAll('.pveSoloEntryForm').forEach(form=>");
 const b=html.indexOf("document.querySelectorAll('[data-solo-edit]')",a);
 const source=html.slice(a,b);
 assert.ok(a>=0&&b>a);
 assert.match(source,/quantity>remaining/);
 assert.match(source,/batchId=key\|\|'solo_batch_'/);
 assert.match(source,/for\(let i=0;i<quantity;i\+\+\)/);
 assert.match(source,/updated\.forEach\(syncSoloEvents\)/);
 assert.match(source,/savePlanWorkingSoloFlights\(next\)/);
 assert.match(source,/data\.dismissedSoloSlots=/);
 assert.match(html,/getPlanWorkingSoloFlights\(\)\.filter\(x=>x\.date===planDate\)\.length>plannedSolo/);
});

test('Unified Solo forms have no Record button and safely autosave edits with a stable batch id',()=>{
 const a=html.indexOf('const soloSlot=(index,group=null)=>',html.indexOf('function plannedVsExecuted(){'));
 const b=html.indexOf('return \'<div class="pvePage">',a);
 const template=html.slice(a,b);
 assert.match(template,/pveSoloEntrySaved/);
 assert.match(template,/data-solo-batch/);
 assert.match(template,/data-solo-slot/);
 assert.doesNotMatch(template,/pveRecordSolo|pveSoloEntryActions|type="submit"/);
 const binder=html.slice(html.indexOf("document.querySelectorAll('.pveSoloEntryForm').forEach(form=>"),html.indexOf("document.querySelectorAll('[data-solo-skip]')"));
 assert.match(binder,/form\.addEventListener\('change'/);
 assert.match(binder,/if\(!trainee\|\|!syllabus\)/);
 assert.match(binder,/oldCount/);
 assert.match(binder,/quantity>remaining/);
 assert.match(binder,/savePlanWorkingSoloFlights\(next\)/);
 assert.match(binder,/updated\.forEach\(syncSoloEvents\)/);
 assert.match(binder,/render\(\)/);
 assert.match(html,/soloEntries=\[\.\.\.document\.querySelectorAll\('\.pveSoloEntryForm\[data-solo-slot\]'\)/);
});

test('Removing an already recorded Solo group marks all removed flights as unexecuted instead of recreating empty slots',()=>{
 const start=html.indexOf("document.querySelectorAll('[data-solo-delete-batch]')");
 const end=html.indexOf("document.querySelectorAll('[data-solo-delete]')",start);
 assert.ok(start>0&&end>start);
 const handler=html.slice(start,end);
 assert.match(handler,/savePlanWorkingSoloFlights\(getPlanWorkingSoloFlights\(\)\.filter/);
 assert.match(handler,/saveActivityEvents\(getActivityEvents\(\)\.filter/);
 assert.match(handler,/data\.dismissedSoloSlots=/);
 assert.match(handler,/saveActivityDraft\('planned',data\)/);
 assert.match(handler,/ids\.size/);
 assert.match(html,/data-solo-restore/);
});


test('Fleet editor supports localized Tail number, Cancel, dark/RTL and Large Text styling',()=>{
 const vm=require('node:vm'),lang={value:'en'},win={FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=>lang.value};
 vm.runInNewContext(ui,{window:win},{filename:'fleet-views.js'});
 const ctx={fleet:add([],'a01','01'),platformId:'shahak',platformLabel:'Shahak',courseLabel:'Training',today:'2026-10-09',editId:'a01',canWrite:true};
 const en=win.FLYMPUS_FLEET_VIEW.fleet(ctx);
 assert.match(en,/Tail number/);
 assert.doesNotMatch(en,/Aircraft number/);
 assert.match(en,/class="toolbar fleetEditorActions"/);
 assert.match(en,/id="fleetCancelEdit">Cancel<\/button>/);
 assert.ok(en.indexOf('id="fleetCancelEdit"')>en.indexOf('id="fleetAircraftForm"'));
 assert.match(en,/data-label="Tail number"/);
 lang.value='he';
 const he=win.FLYMPUS_FLEET_VIEW.fleet(ctx);
 assert.match(he,/מספר זנב \(מס״ז\)/);
 assert.match(he,/id="fleetCancelEdit">ביטול<\/button>/);
 assert.match(he,/data-label="מספר זנב"/);
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(css,/\.fleetPage>\.fleetEditor\.card\{/);
 assert.match(css,/\.fleetInventory>\.fleetTableWrap\{border:0/);
 assert.match(css,/\.fleetEditorActions\{display:grid/);
 assert.match(css,/html\.flympusLargeText \.fleetEditor \.fleetEditorActions/);
 assert.match(css,/scroll-margin-block-end:calc\(116px/);
 assert.match(ui,/visualViewport\?\.addEventListener\?\.\('resize'/);
 assert.match(html,/panel\.scrollIntoView\?\.\(\{behavior:reduced\?'auto':'smooth',block:'start'\}\)/);
 assert.doesNotMatch(html,/panel\.querySelector\('\[name="tail"\]'\)\?\.focus/);
});
test('Fleet focus guard adjusts to keyboard viewport and stops after blur',()=>{
 const vm=require('node:vm'),listeners={},vvEvents={},calls=[];
 const doc={documentElement:{clientHeight:700},addEventListener:(name,fn)=>{listeners[name]=fn}};
 const vv={offsetTop:0,height:370,addEventListener:(name,fn)=>{vvEvents[name]=fn}};
 const win={FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=> 'en',document:doc,visualViewport:vv,innerHeight:700,
  setTimeout:fn=>{fn();return 1},clearTimeout:()=>{},scrollBy:opts=>calls.push(opts)};
 vm.runInNewContext(ui,{window:win});
 const field={isConnected:true,matches:()=>true,closest:()=>({}),getBoundingClientRect:()=>({top:310,bottom:420})};
 listeners.focusin({target:field});
 assert.ok(calls.length>0);
 assert.ok(calls[0].top>0);
 vvEvents.resize();
 listeners.focusout({target:field});
 calls.length=0;
 vvEvents.resize();
 assert.equal(calls.length,0);
});

test('platform and tail display consistently, without changing stored aircraft identity',()=>{
 const vm=require('node:vm'),lang={value:'en'};
 const win={FLYMPUS_FLEET_MODEL:M,FLYMPUS_FLEET_LANGUAGE:()=>lang.value};
 vm.runInNewContext(ui,{window:win},{filename:'fleet-views.js'});
 const V=win.FLYMPUS_FLEET_VIEW;
 const plane=add([],'aircraft-a01','01');
 const sortie={id:'sortie1',date:'2026-10-09',platformId:'shahak',time:'09:00',aircraftId:'aircraft-a01',tail:'01',
  traineeId:'trainee1',traineeName:'Trainee One',instructorId:'coach1',instructorName:'Coach One',
  syllabus:'Circuits',mode:'INSTRUCTED',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15};
 const ctx={fleet:plane,flights:[sortie],platformId:'shahak',platformLabel:'Shahak',
  courseLabel:'EP Course',today:'2026-10-09',date:'2026-10-09',canWrite:true,
  trainees:[{id:'trainee1',name:'Trainee One'}],instructors:[{id:'coach1',name:'Coach One'}],syllabi:['Circuits']};
 assert.match(V.home(ctx),/fleetHomeTail">Shahak-01<\/td>/);
 assert.match(V.fleet(ctx),/fleetInventoryTail">Shahak-01<\/td>/);
 assert.doesNotMatch(V.fleet(ctx),/fleetInventoryCount/);
 assert.match(V.schedule(ctx),/<option value="aircraft-a01"[^>]*>Shahak-01<\/option>/);
 assert.match(V.schedule(ctx),/fleetSortieSyllabus">[^<]*Shahak-01<\/small>/);
 assert.equal(plane[0].tail,'01','Display must not change stored tail number');
 assert.doesNotMatch(V.home({...ctx,fleet:[{...plane[0],tail:'Shahak-01'}]}),/Shahak Shahak/);
 lang.value='he';
 assert.match(V.fleet(ctx),/Shahak-01/);
 assert.match(V.schedule(ctx),/Shahak-01/);
});
test('Fleet starts from top, editor does not summon keyboard and Plan tabs support responsive themes',()=>{
 const styles=fs.readFileSync(path.join(__dirname,'../assets/course-operations.css'),'utf8');
 assert.match(html,/\['fleet','profile','instructor','my-profile','preferences'/);
 assert.match(html,/panel\.hidden=false;\s*const reveal=/);
 assert.doesNotMatch(html,/panel\.querySelector\('\[name="tail"\]'\)\?\.focus/);
 assert.match(html,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(reveal\)\)/);
 assert.ok(styles.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
 assert.ok(styles.includes('.coursePlanMenu>.coursePlanTabs .dutyApprovalTabCount'));
 assert.match(styles,/html\[data-flympus-theme="dark"\] \.coursePlanWorkspace/);
 assert.match(styles,/html\.flympusLargeText \.coursePlanWorkspace/);
 assert.match(styles,/@media\(max-width:375px\)/);
});

test('moving flight cards exchanges real takeoff slots, keeps IDs and crews, and never mutates input',()=>{
 const date='2026-10-09';
 const flight=(id,time,changes={})=>({id,date,platformId:'shahak',time,aircraftId:'plane-'+id,
  tail:id,traineeId:'t-'+id,traineeName:'Trainee '+id,instructorId:'i-'+id,
  instructorName:'Coach '+id,syllabus:'Circuits',mode:'INSTRUCTED',briefingMinutes:10,
  estimatedMinutes:20,debriefMinutes:10,...changes});
 const flights=[flight('a','08:00'),flight('b','10:00'),flight('c','12:00')];
 const reordered=M.reorderSorties(flights,['b','a','c'],'shahak',date,null,'2026-10-09T19:00:00Z');
 assert.deepEqual(reordered.map(f=>f.time),['10:00','08:00','12:00']);
 assert.deepEqual(reordered.map(f=>f.id),['a','b','c']);
 assert.equal(reordered[0].traineeId,'t-a');assert.equal(reordered[1].instructorId,'i-b');
 assert.deepEqual(flights.map(f=>f.time),['08:00','10:00','12:00']);
 assert.equal(reordered[0].updatedAt,'2026-10-09T19:00:00Z');
 assert.equal(reordered[2],flights[2],'Untouched sorties remain identical');
 assert.equal(M.reorderSorties(flights,['a','b','c'],'shahak',date),flights,'No-op must not publish a revision');
 assert.throws(()=>M.reorderSorties(flights,['a','a','c'],'shahak',date),/changed/);
 assert.throws(()=>M.reorderSorties(flights,['a','b','foreign'],'shahak',date),/changed/);
});
test('reslot conflicts reject simultaneous flights and shared crews across entire briefing/debrief windows',()=>{
 const date='2026-10-09',make=(id,time,rest={})=>({
  id,date,platformId:'shahak',time,aircraftId:'plane-'+id,tail:id,
  traineeId:'trainee-'+id,traineeName:'Trainee '+id,instructorId:'ip-'+id,instructorName:'Coach '+id,
  mode:'INSTRUCTED',estimatedMinutes:20,briefingMinutes:10,debriefMinutes:10,...rest
 });
 // Actual flight intervals never overlap, but the moving instructor's debrief
 // overlaps the next flight's briefing after the 08:00/09:00 exchange.
 const first=make('a','08:00',{instructorId:'same-ip',instructorName:'Shared Coach',debriefMinutes:30});
 const second=make('b','09:00');
 const third=make('c','09:45',{instructorId:'same-ip',instructorName:'Shared Coach'});
 const crew=[first,second,third];
 assert.throws(()=>M.reorderSorties(crew,['b','a','c'],'shahak',date),/Crew conflict: Instructor Shared Coach/);
 assert.deepEqual(crew.map(x=>x.time),['08:00','09:00','09:45'],'Rejected drag cannot modify source');
 const withAircraft=[make('a','08:00',{estimatedMinutes:60}),make('b','10:00',{estimatedMinutes:10}),make('c','10:30')];
 assert.throws(()=>M.reorderSorties(withAircraft,['b','a','c'],'shahak',date),/Flight time conflict/);
 // A cross-platform shared trainee is also checked even though the platform differs.
 const other=make('x','09:30',{platformId:'aerostar',traineeId:'trainee-a',traineeName:'Trainee a',briefingMinutes:30});
 assert.throws(()=>M.reorderSorties([make('a','08:00'),make('b','09:00'),other],['b','a'],'shahak',date),/Crew conflict: Trainee/);
});
test('flight drag UI offers accessible touch grips, reduced motion and localized overlap errors',()=>{
 const drag=fs.readFileSync(path.join(__dirname,'../assets/flight-board-drag.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 const vm=require('node:vm'),sandbox={window:{}};
 vm.runInNewContext(drag,sandbox,{filename:'flight-board-drag.js'});
 assert.equal(typeof sandbox.window.FLYMPUS_FLIGHT_DRAG.attach,'function');
 assert.match(ui,/data-flight-sorties/);
 assert.match(ui,/data-flight-id/);
 assert.match(ui,/data-flight-drag aria-label=/);
 assert.match(ui,/fleetSortieDragHelp/);
 assert.match(drag,/addEventListener\('pointerdown'/);
 assert.match(drag,/addEventListener\('pointermove'/);
 assert.match(drag,/pointercancel/);
 assert.match(drag,/ArrowUp/);
 assert.match(drag,/prefers-reduced-motion: reduce/);
 assert.match(css,/touch-action:none/);
 assert.match(css,/fleetSortieDragGhost/);
 assert.match(css,/html\[data-flympus-theme="dark"\] \.fleetSortieDrag/);
 assert.match(css,/html\.flympusLargeText \.fleetSortieDrag/);
 assert.match(html,/model\.reorderSorties\(original,orderedIds,platform,date,getPlanTimingDefaults\(\)\)/);
 assert.match(html,/dutyOperations\.saveDraft\('PLAN'/);
 assert.match(html,/dutyOperations\.publish\('PLAN'/);
 assert.match(html,/Crew conflict: /);
 assert.ok(html.includes('flight-board-drag.js?v=20261010-flight-time-only-seamless-0820'));
});
test('Plan tabs use shared Course Management-style segmented control',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../assets/course-operations.css'),'utf8');
 assert.match(css,/\.coursePlanWorkspace \.coursePlanMenu>\.coursePlanTabs\{\s*display:grid/);
 assert.ok(css.includes('border:1px solid #d5e3f0;border-radius:13px'));
 assert.match(css,/background:#e9f0f6;color:#234f75/);
 assert.match(css,/\.planRequiredTabCount/);
 assert.match(css,/html\[data-flympus-theme="dark"\]/);
 assert.match(css,/html\.flympusLargeText/);
 assert.match(html,/data-plan-view="board"/);
 assert.match(html,/data-plan-view="approvals"/);
});

test('Plan stage numbers and Pending approvals share one Course Management-style bar',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../assets/course-operations.css'),'utf8');
 assert.match(html,/class="coursePlanMenu"><nav class="coursePlanTabs"/);
 assert.match(html,/data-plan-view="board"[^\n]*1 · /);
 assert.match(html,/data-plan-view="report"[^\n]*2 · /);
 assert.doesNotMatch(html,/class="coursePlanApprovalShortcut /);
 assert.match(html,/data-plan-view="approvals"/);
 assert.match(css,/min-height:43px;box-sizing:border-box;padding:9px 16px/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.ok(css.includes('.coursePlanMenu>.coursePlanTabs .dutyApprovalTabCount'));
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/html\[data-flympus-theme="dark"\]/);
 assert.match(css,/html\.flympusLargeText/);
});
test('Aircraft displays as plain syllabus-side text, not a separate badge',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(view,/fleetSortieSyllabus/);
 assert.match(view,/E\(f\.syllabus\)\+' · '\+E\(aircraftDisplayName\(c,f\.tail\)\)/);
 assert.doesNotMatch(view,/class="fleetSortieTail"/);
 assert.match(css,/\.fleetBookedFlights \.fleetSortieSlide>/);
});
test('Frozen insertion thresholds prevent drag jitter after DOM swaps and support auto-scroll',()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../assets/flight-board-drag.js'),'utf8');
 const sandbox={window:{}};
 vm.runInNewContext(source,sandbox,{filename:'flight-board-drag.js'});
 const calc=sandbox.window.FLYMPUS_FLIGHT_DRAG.insertionIndex;
 const stops=[400,535,700];
 assert.equal(calc(350,stops),0);
 assert.equal(calc(520,stops),1);
 assert.equal(calc(630,stops),2);
 assert.equal(calc(760,stops),3);
 for(let i=0;i<100;i++)assert.equal(calc(550,stops),2,'No oscillation after animated row shifts');
 assert.equal(calc(480+70,stops),2,'Scroll offset must be considered in document coordinates');
 assert.match(source,/const centers=peers\.map/);
 assert.match(source,/const next=insertionIndex\(y\+scroll\(\),centers\)/);
 assert.doesNotMatch(source,/others\.find\(item=>\{const rect=item\.getBoundingClientRect/);
 assert.match(source,/animation\.finished\.then\(settle,settle\)/);
 assert.match(source,/if\(ev\.type==='pointercancel'\|\|targetIndex===origin\)\{clean\(\);return\}/);
 assert.match(source,/void commit\(desired,true\)\.finally\(clean\)/);
});

test('Drag uses an in-board ghost and never swaps live rows before persistence',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../assets/flight-board-drag.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.doesNotMatch(source,/board\.insertBefore\(/,'No ghost/live-row mismatch while async Plan persists');
 assert.match(source,/board\.appendChild\(clone\)/,'Ghost must inherit the original board CSS context');
 assert.doesNotMatch(source,/document\.body\.appendChild\(clone\)/);
 assert.match(source,/if\(!active&&Math\.abs\(y-startY\)<8\)return/,'Tapping the handle must not create a ghost');
 assert.match(source,/const desired=movedIds\(original,origin,targetIndex\)/);
 assert.match(source,/void commit\(desired,true\)\.finally\(clean\)/);
 assert.match(source,/items\.length<=3/,'No iPhone edge autoscroll for short lists');
 assert.match(css,/\.fleetBookedFlights \.fleetSortieDragGhost \.fleetSortieTail\{/);
 assert.match(css,/white-space:nowrap!important/);
});

test('Touch gesture preserves real row identities through the save and never ghosts on a tap',async()=>{
 const vm=require('node:vm'),code=fs.readFileSync(path.join(__dirname,'../assets/flight-board-drag.js'),'utf8');
 const events={},saved=[];
 const classes=()=>({add(){},remove(){}});
 let board,appends=0,reorders=0;
 const create=(id,top)=>{
  const row={dataset:{flightId:id},style:{},classList:classes(),parentElement:null,
   getBoundingClientRect:()=>({top,left:10,width:300,height:96,bottom:top+96}),
   cloneNode:()=>({dataset:{flightId:id},style:{},classList:classes(),parentElement:null,
    removeAttribute(key){if(key==='data-flight-id')delete this.dataset.flightId},
    querySelectorAll:()=>[],remove(){board.children=board.children.filter(x=>x!==this)},
    animate:()=>({finished:Promise.resolve()})})};
  const handle={listeners:{},addEventListener(type,fn){this.listeners[type]=fn},
   closest:()=>row,setPointerCapture(){},releasePointerCapture(){},
   setAttribute(){},removeAttribute(){}};
  return {row,handle};
 };
 const a=create('flight-a',100),b=create('flight-b',210);
 board={children:[a.row,b.row],classList:classes(),
  querySelectorAll(query){return query==='.fleetSortieDragHandle'?[a.handle,b.handle]:
   this.children.filter(x=>x.dataset?.flightId)},
  appendChild(item){appends++;item.parentElement=this;this.children.push(item);return item},
  insertBefore(){reorders++;throw Error('Live card moved before persistence')},
  getBoundingClientRect:()=>({top:100,bottom:310})};
 a.row.parentElement=b.row.parentElement=board;
 const doc={body:{classList:classes()},documentElement:{scrollTop:0,clientHeight:900},
  addEventListener(type,fn){events[type]=fn},
  removeEventListener(type,fn){if(events[type]===fn)delete events[type]}};
 const win={scrollY:0,innerHeight:900,matchMedia:()=>({matches:true}),
  getComputedStyle:()=>({rowGap:'11px'}),
  requestAnimationFrame:fn=>{fn();return 1},
  cancelAnimationFrame(){},scrollBy(){},setTimeout:fn=>{fn();return 1}};
 vm.runInNewContext(code,{window:win,document:doc},{filename:'flight-board-drag.js'});
 win.FLYMPUS_FLIGHT_DRAG.attach(board,{onDrop:async ids=>{saved.push([...ids])}});
 const pointer=(y)=>({pointerId:7,clientY:y,isPrimary:true,pointerType:'touch',
  preventDefault(){},stopPropagation(){}});
 a.handle.listeners.pointerdown(pointer(135));
 events.pointerup(pointer(135));
 assert.equal(appends,0,'A tap must never create a ghost or wrap a badge');
 assert.equal(saved.length,0);
 a.handle.listeners.pointerdown(pointer(135));
 events.pointermove(pointer(284));
 assert.equal(appends,1,'One scoped ghost appears only after meaningful movement');
 assert.deepEqual(board.children.filter(x=>x.dataset?.flightId).map(x=>x.dataset.flightId),['flight-a','flight-b']);
 assert.equal(reorders,0,'Live cards must not swap until validated rerender');
 assert.equal(saved.length,0);
 events.pointerup(pointer(284));
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(saved,[['flight-b','flight-a']],'The real flight identities are passed to persistence once');
 assert.equal(reorders,0);
 assert.deepEqual(board.children.filter(x=>x.dataset?.flightId).map(x=>x.dataset.flightId),['flight-a','flight-b'],
  'The renderer, not the gesture, owns the final DOM replacement');
});


test('Plan flight drag offers press lift without exposing stale identity or global saving flash',()=>{
 const drag=fs.readFileSync(path.join(__dirname,'../assets/flight-board-drag.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(drag,/source\.classList\.add\('fleetSortiePressing'\)/);
 assert.match(drag,/source\.classList\.remove\('fleetSortiePressing'\)/);
 assert.match(drag,/clone\.classList\.remove\('fleetSortiePressing'\)/);
 assert.match(drag,/clone\.style\.transform='scale\(1\.02\)'/);
 assert.match(css,/\.fleetBookedFlights \.fleetSortiePressing\{/);
 assert.match(css,/transform:scale\(1\.018\)/);
 assert.match(css,/\.fleetSortieDragSource\{opacity:0!important/);
 assert.match(css,/\.fleetDragSaving\{pointer-events:none\}/);
 assert.doesNotMatch(css,/\.fleetDragSaving\{opacity:/);
});


test('iOS flight drag blocks native text loupe and keeps open flight edit during reslot',()=>{
 const drag=fs.readFileSync(path.join(__dirname,'../assets/flight-board-drag.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 const start=html.indexOf('window.FLYMPUS_FLIGHT_DRAG?.attach?.(');
 const end=html.indexOf('const refreshTimeline=',start);
 assert.ok(start>0&&end>start,'Flight drag callbacks are present');
 const callback=html.slice(start,end);
 assert.match(drag,/handle\.addEventListener\('touchstart'/);
 assert.match(drag,/handle\.addEventListener\('contextmenu'/);
 assert.match(drag,/board\.addEventListener\?\.\('selectstart'/);
 assert.match(css,/-webkit-touch-callout:none!important/);
 assert.match(css,/-webkit-user-select:none!important/);
 assert.match(css,/\.fleetSortieDragSource\{opacity:0!important/);
 assert.doesNotMatch(callback,/state\.flightBoardEditId=null/,'Reordering must not close Edit');
 assert.match(callback,/const painted=patchPlanFlightCards\(date,proposed/);
 assert.doesNotMatch(callback,/onError:err=>\{[^}]*render\(\)/,'A rejected drop should not reset the editor');
});

test('Plan reslot patches keyed cards in place instead of repainting the entire screen',()=>{
 const start=html.indexOf('function patchPlanFlightCards(date,flights,');
 const end=html.indexOf('function bindDailyFlightBoard(',start);
 assert.ok(start>0&&end>start);
 const implementation=html.slice(start,end);
 assert.match(implementation,/courseFlightScheduleHtml\(date,flights\)/);
 assert.match(implementation,/new Map\(existing\.map\(row=>\[row\.dataset\.flightId,row\]\)\)/);
 assert.match(implementation,/x\.time\.textContent=x\.nextTime\.textContent/);
 assert.match(implementation,/updateSlotDetail\(x\.details,x\.nextDetails\)/);
 assert.match(implementation,/board\.insertBefore\(x\.row,ghost\|\|null\)/);
 assert.doesNotMatch(implementation,/row\.replaceChildren/);
 assert.doesNotMatch(implementation,/bindDailyFlightBoard\('board'\)/);
 assert.doesNotMatch(implementation,/\$\('#content'\)\.innerHTML/);
 const call=html.slice(html.indexOf('window.FLYMPUS_FLIGHT_DRAG?.attach?.('),html.indexOf('const refreshTimeline=',html.indexOf('window.FLYMPUS_FLIGHT_DRAG?.attach?.(')));
 assert.match(call,/patchPlanFlightCards\(date,proposed,\{previewed,animateReorder:!previewed\}\)/);
 assert.doesNotMatch(call,/state\.flightBoardEditId=null/);
});
test('Plan flight Edit retains the page and scrolls to the editor without input focus',()=>{
 const click=html.match(/document\.querySelectorAll\('\[data-flight-edit\]'\)\.forEach\(b=>b\.onclick=[^\n]+/);
 assert.ok(click);
 assert.match(click[0],/updatePlanFlightEditForm\(\)/);
 assert.match(click[0],/scrollToPlanFlightForm\(\)/);
 assert.match(html,/form\.replaceChildren\(\.\.\.updated\.childNodes\)/);
 assert.match(html,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(reveal\)\)/);
 assert.match(html,/behavior:reduced\?'auto':'smooth'/);
 assert.match(html,/bottomDockProgrammaticRestoreUntil=Math\.max/);
 assert.match(fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8'),/\.dailyFlightPlan \.fleetSortieForm\{scroll-margin-top:110px\}/);
});

test('Reordering only changes time and preserves every other flight field',()=>{
 const date='2026-10-09',create=(id,time,overrides={})=>({
  id,date,platformId:'shahak',time,aircraftId:'plane-'+id,
  tail:'Shahak-'+id,traineeId:'trainee-'+id,traineeName:'Trainee '+id,
  instructorId:'ip-'+id,instructorName:'Instructor '+id,
  syllabus:'Circuits & figures',mode:'INSTRUCTED',note:'Notes '+id,
  briefingMinutes:10,estimatedMinutes:20,debriefMinutes:10,...overrides
 });
 const original=[create('a','08:00'),create('b','09:00')];
 const result=M.reorderSorties(original,['b','a'],'shahak',date);
 for(const before of original){
  const after=result.find(x=>x.id===before.id);
  assert.equal(after.time,before.id==='a'?'09:00':'08:00');
  const unchanged=Object.fromEntries(Object.entries(after).filter(([k])=>!['time','updatedAt'].includes(k)));
  const unchangedBefore=Object.fromEntries(Object.entries(before).filter(([k])=>k!=='time'));
  assert.deepEqual(unchanged,unchangedBefore,'All other fields must stay attached to '+before.id);
 }
});
test('Plan reorder patches only keyed time fields without remounting cards or animating twice',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
 const drag=fs.readFileSync(path.join(__dirname,'../assets/flight-board-drag.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(view,/data-flight-slot-time/);
 assert.match(view,/data-flight-slot-details/);
 const start=html.indexOf('function patchPlanFlightCards(date,flights,');
 const end=html.indexOf('function updatePlanFlightEditForm()',start);
 assert.ok(start>=0&&end>start);
 const patch=html.slice(start,end);
 assert.match(patch,/x\.time\.textContent=x\.nextTime\.textContent/);
 assert.match(patch,/updateSlotDetail\(x\.details,x\.nextDetails\)/);
 assert.match(patch,/board\.insertBefore\(x\.row,ghost\|\|null\)/);
 assert.doesNotMatch(patch,/replaceChildren/);
 assert.doesNotMatch(patch,/bindDailyFlightBoard/);
 assert.match(patch,/animateReorder&&!previewed/);
 assert.match(drag,/onDrop\(next,\{previewed\}\)/);
 assert.match(drag,/clone\.dataset\.dragFlightId=source\.dataset\.flightId/);
 assert.match(drag,/targetIndex>origin\?finishAt\.height-sourceBox\.height:0/);
 assert.match(css,/\.fleetBookedFlights \.fleetSorties\{overflow-anchor:none\}/);
 const drop=html.slice(html.indexOf('onDrop:async (orderedIds'),html.indexOf('onError:err=>',html.indexOf('onDrop:async (orderedIds')));
 assert.match(drop,/const painted=patchPlanFlightCards\(date,proposed/);
 assert.match(drop,/catch\(error\)\{[\s\S]*patchPlanFlightCards\(date,original/);
});

test('Scheduled flights emphasize instructor without changing slot field updates',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(view,/fleetSortiePerson-'\+role/);
 assert.match(view,/crewLine\('teacher',f\.instructorName\)/);
 assert.match(view,/data-flight-slot-details/);
 assert.match(css,/\.fleetBookedFlights \.fleetSortiePerson-teacher\{font-size:12px;font-weight:850/);
});

test('Approved Scheduled flight option 1 uses named crew and real planned clocks',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(view,/crewLine\('student',f\.traineeName\|\|f\.traineeId\)/);
 assert.match(view,/f\.mode!=='SOLO'&&f\.instructorName/);
 assert.match(view,/crewLine\('teacher',f\.instructorName\)/);
 assert.match(view,/fleetSortieMode/);
 assert.match(view,/fleetSortieMiniTimeline/);
 assert.match(view,/miniMoment\('briefing',t\?\.clock\.briefing/);
 assert.match(view,/miniMoment\('flight',t\?\.clock\.takeoff\|\|f\.time/);
 assert.match(view,/miniMoment\('debrief',t\?\.clock\.landing/);
 assert.match(html,/const old=\[\.\.\.destination\.querySelectorAll\('\[data-flight-slot-clock\]'\)\]/);
 assert.match(html,/old\.forEach\(\(item,i\)=>\{item\.textContent=future\[i\]\.textContent\}\)/);
 assert.match(css,/fleetSortieMiniMoment/);
 assert.match(css,/\.fleetBookedFlights \.fleetSortieMode\.solo/);
});
test('Mobile swipe exposes existing confirmed remove action, never deletes directly',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../assets/row-swipe-delete.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(src,/target\.click\(\)/);
 assert.match(src,/\[data-flight-delete\]/);
 assert.match(src,/\[data-swipe-delete-row\]/);
 assert.match(src,/touchstart/);
 assert.match(src,/touchmove/);
 assert.match(src,/touchend/);
 assert.match(src,/if\(event\.cancelable\)event\.preventDefault\(\)/);
 assert.match(src,/\[data-flight-drag\]/);
 assert.match(src,/\.fleetSortieDragHandle/);
 assert.match(src,/THRESHOLD=44/);
 assert.doesNotMatch(src,/persistCourseOperations|saveDraft|publish\('PLAN'/);
 assert.match(html,/FLYMPUS_ROW_SWIPE\?\.attach\?\.\(document\.querySelector\('\[data-flight-sorties\]'\)\)/);
 assert.match(html,/assets\/row-swipe-delete\.js\?v=20261010-plan-cards-polish-0826/);
 assert.match(css,/\.flympusSwipeDeleteAction/);
 assert.match(css,/\.fleetSortieDragGhost \.flympusSwipeDeleteAction\{display:none!important\}/);
});

test('Mobile deletion slides the inner card, retaining outer FLIP and confirmed remove button',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
 const swipe=fs.readFileSync(path.join(__dirname,'../assets/row-swipe-delete.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(view,/fleetSortieSlide/);
 assert.match(view,/data-flight-delete/);
 assert.match(view,/fleetSortieMode/);
 assert.match(view,/fleetSortieSyllabus/);
 assert.doesNotMatch(view,/class="fleetSortieTail"/);
 assert.match(swipe,/slide\(row\)\.style\.transform/);
 assert.match(swipe,/target\.click\(\)/);
 assert.match(swipe,/flympusSwipeTracking/);
 assert.match(swipe,/\[data-flight-drag\]/);
 assert.match(css,/\.fleetSortie\.flympusSwipeOpen \.fleetSortieSlide/);
 assert.match(css,/translate3d\(-94px,0,0\)/);
 assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)/);
});

test('Scheduled cards eliminate duplicate top time without breaking reorder and keep neutral swipe edges',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(view,/class="fleetSortieSlotSync" data-flight-slot-time aria-hidden="true"/);
 assert.match(css,/\.fleetSortieSlide \.fleetSortieSlotSync\{position:absolute!important;width:1px!important/);
 assert.match(css,/\.fleetSortieSlide \.fleetSortieCrew\{\s*grid-column:1;/);
 assert.doesNotMatch(css,/background:#f3d4dc|background:#59323c|border-color:#f1b2bd|border-color:#9c5a68/);
 assert.match(css,/\.fleetSortie\.flympusSwipeOpen \.fleetSortieSlide\{transform:translate3d\(-94px,0,0\)/);
 assert.match(css,/html\[data-flympus-language="he"\] \.fleetBookedFlights \.fleetSortieSlide/);
 assert.match(css,/html\[data-flympus-theme="dark"\] \.fleetBookedFlights \.fleetSortie\{background:#172d40/);
});
