const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../assets/home-operations.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const trainees=[{id:'a',name:'Alice',status:'Active',progress:60},{id:'b',name:'Bob',status:'Active',progress:80},{id:'x',name:'Inactive',status:'Inactive',progress:10}];
const ev=(traineeId,date,grade,syllabus='Circuits',scores={},progressionDecision='')=>({traineeId,flightDate:date,grade,syllabus,scores,progressionDecision,criteriaSnapshot:[{id:'bank',name:'Bank control'}]});
const ctx=(p={})=>({trainees,evaluations:[],soloFlights:[],exams:[],progressions:{},today:'2026-10-08',...p});
const has=(rows,id,code)=>rows.find(t=>t.id===id)?.issues.some(x=>x.code===code)||false;
test('Week uses Israel course-local Sunday through Saturday, counting both real Solo and Evaluations',()=>{
 assert.deepEqual(M.weekBounds('2026-10-08'),{from:'2026-10-04',to:'2026-10-10'});
 assert.deepEqual(M.weekBounds('2026-10-11'),{from:'2026-10-11',to:'2026-10-17'});
 const result=M.weeklyFlights({today:'2026-10-08',
  evaluations:[ev('a','2026-10-03',4),ev('a','2026-10-04',4),ev('a','2026-10-10',4),ev('a','2026-10-11',4)],
  soloFlights:[{date:'2026-10-03'},{date:'2026-10-04'},{date:'2026-10-10'},{date:'2026-10-11'}]});
 assert.equal(result.instructed,2);assert.equal(result.solo,2);assert.equal(result.total,4);
});
test('Inactive or unassessed trainees never receive filler attention',()=>{
 assert.equal(M.attention(ctx()).length,0);
 const rows=M.attention(ctx({exams:[{traineeId:'x',exam:'Ground test',date:'2026-10-01',grade:50,pass:80}]}));
 assert.equal(rows.length,0);
});
test('Only latest saved ground exam attempt per exam matters; successful retake clears failure',()=>{
 const attempts=[{traineeId:'a',exam:'Ground Theory',date:'2026-10-06',grade:89,pass:80},
 {traineeId:'a',exam:'Ground Theory',date:'2026-10-03',grade:40,pass:80},
 {traineeId:'b',exam:'Ground Theory',date:'2026-10-07',grade:65,pass:80}];
 const rows=M.attention(ctx({exams:attempts}));
 assert.ok(!has(rows,'a','exam'));assert.ok(has(rows,'b','exam'));
 assert.equal(rows.find(x=>x.id==='b').issues[0].name,'Ground Theory');
});
test('Additional syllabus flights require actual saved flight evidence and no advance decision',()=>{
 const make=(count,decision)=>Array.from({length:count},(_,i)=>ev('a','2026-10-'+String(i+1).padStart(2,'0'),4,'Circuits',{},i===count-1?decision:''));
 const progressions={a:{current:'Circuits',minimum:4,completed:6}};
 assert.ok(has(M.attention(ctx({evaluations:make(5,''),progressions})),'a','extra-flights'));
 assert.ok(has(M.attention(ctx({evaluations:make(4,'CONTINUE'),progressions})),'a','extra-flights'));
 assert.ok(!has(M.attention(ctx({evaluations:make(4,''),progressions})),'a','extra-flights'));
 assert.ok(!has(M.attention(ctx({evaluations:make(5,'ADVANCE'),progressions})),'a','extra-flights'));
 assert.ok(!has(M.attention(ctx({progressions})),'a','extra-flights'),'mock progress is not a saved-flight alert');
});
test('Flight and criterion deviations compare with other active trainees in the same syllabus',()=>{
 const evals=[ev('a','2026-10-08',3.5,'Circuits',{bank:3.4}),
 ev('b','2026-10-08',4,'Circuits',{bank:4}),
 ev('x','2026-10-08',5,'Circuits',{bank:5})];
 const rows=M.attention(ctx({evaluations:evals}));
 assert.ok(has(rows,'a','flight-grade'));
 assert.ok(has(rows,'a','criterion'));
 assert.ok(!has(rows,'b','flight-grade'));
 assert.ok(!has(rows,'b','criterion'));
 const peerDifferent=evals.map(e=>e.traineeId==='b'?{...e,syllabus:'Complex Emergencies'}:e);
 const unmatched=M.attention(ctx({evaluations:peerDifferent}));
 assert.ok(!has(unmatched,'a','flight-grade'));
 assert.ok(!has(unmatched,'a','criterion'));
 const boundary=M.attention(ctx({evaluations:[ev('a','2026-10-08',3.6,'Circuits',{bank:3.6}),ev('b','2026-10-08',4,'Circuits',{bank:4})]}));
 assert.ok(has(boundary,'a','flight-grade'));assert.ok(has(boundary,'a','criterion'));
 const aboveBoundary=M.attention(ctx({evaluations:[ev('a','2026-10-08',3.61,'Circuits',{bank:3.61}),ev('b','2026-10-08',4,'Circuits',{bank:4})]}));
 assert.ok(!has(aboveBoundary,'a','flight-grade'));assert.ok(!has(aboveBoundary,'a','criterion'));
});
test('No flight only after 8 full calendar days, based on latest saved Solo or Evaluation',()=>{
 const last=[ev('a','2026-10-01',4)];
 const exactlySeven=M.attention(ctx({evaluations:last}));
 assert.ok(!has(exactlySeven,'a','no-flight'));
 const eight=M.attention(ctx({evaluations:last,today:'2026-10-09'}));
 assert.ok(has(eight,'a','no-flight'));
 const solo=M.attention(ctx({evaluations:last,soloFlights:[{traineeId:'a',date:'2026-10-07'}],today:'2026-10-09'}));
 assert.ok(!has(solo,'a','no-flight'));
});
test('Home ordering, no duplicate Quick Actions, actual data wiring and Roster Overview routing',()=>{
 assert.ok(html.includes('assets/home-operations.js?v=20261008-home01'));
 assert.ok(html.indexOf('<h2>Course Pulse</h2>')<html.indexOf('<h2>Today\\\'s Plan</h2>'));
 assert.ok(!html.includes("'<div class=\"homeTaskStrip\">'"));
 assert.ok(html.includes('weekly.instructed')&&html.includes('weekly.solo'));
 assert.ok(html.includes('evaluations:getEvaluations(),soloFlights:getSoloFlights(),exams:getExamRecords()'));
 assert.ok(html.includes('attentionRows.length?'),'No fake row when no trainee is at risk');
 assert.ok(html.includes("screen==='profile'?{...extra,profileTab:'overview'}:extra"));
});
