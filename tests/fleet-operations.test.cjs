const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../assets/fleet-serviceability.js');
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
 const base={time:'09:30',aircraftId:'a01',traineeId:'t1',traineeName:'Pilot 1',instructorId:'i1',instructorName:'Coach',syllabus:'Circuits',mode:'INSTRUCTED'};
 assert.throws(()=>M.upsertSortie([],{...base,aircraftId:'a03'},planes,'shahak','2026-10-08',ids),/not serviceable/);
 assert.throws(()=>M.upsertSortie([],{...base,traineeId:'else'},planes,'shahak','2026-10-08',ids),/assigned to this course/);
 assert.throws(()=>M.upsertSortie([],{...base,time:'25:00'},planes,'shahak','2026-10-08',ids),/valid flight date and time/);
 let board=M.upsertSortie([],{...base},planes,'shahak','2026-10-08',ids,now,()=> 'flight1');
 assert.equal(board.length,1);assert.equal(board[0].tail,'01');
 assert.throws(()=>M.upsertSortie(board,{...base},planes,'shahak','2026-10-08',ids,now,()=> 'flight2'),/already scheduled/);
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
 for(const item of ["case'fleet'",'bindFleetServiceability()','bindDailyFlightBoard()',
 'appScreenIds=new Set(','getFleetAircraft()','getDailyFlightBoard()','courseScopedKey(base)','flightBoardEditId',
 'window.FLYMPUS_FLEET_VIEW?.home?.(currentFleetContext())','courseFlightScheduleHtml(date)'])assert.ok(html.includes(item),item);
 assert.ok(ui.includes("M.flightIssues(f,c.fleet,c.platformId)"));
 assert.ok(ui.includes("const available=M.active(c.fleet,c.platformId).filter(x=>x.status===M.AVAILABLE)"));
 assert.ok(html.includes('html[data-flympus-theme="dark"]')||fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8').includes('html[data-flympus-theme="dark"]'));
 assert.ok(fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8').includes('@media(max-width:560px)'));
});