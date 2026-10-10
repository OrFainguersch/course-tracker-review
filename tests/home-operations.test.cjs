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
 assert.ok(html.includes('assets/home-operations.js?v=20261010-home-timeline-live-0822'));
 assert.ok(html.indexOf('<h2>Course Pulse</h2>')<html.indexOf('<section class="homePrimaryGrid">'),'Course Pulse must appear before the read-only Today Plan');
 assert.ok(!html.includes("'<div class=\"homeTaskStrip\">'"));
 assert.ok(html.includes('weekly.instructed')&&html.includes('weekly.solo'));
 assert.ok(html.includes('evaluations:getEvaluations(),soloFlights:getSoloFlights(),exams:getExamRecords()'));
 assert.ok(html.includes('attentionRows.length?'),'No fake row when no trainee is at risk');
 assert.ok(html.includes("screen==='profile'?{...extra,profileTab:'overview'}:extra"));
});


test('Recent Flight Activity is exactly the latest seven calendar dates, with saved Solo and instructed flights only',()=>{
 const today='2026-10-08';
 const rows=M.recentFlights({today,
  evaluations:[ev('a','2026-10-01',4),ev('a','2026-10-02',4),ev('b','2026-10-08',3.4),ev('a','2026-10-09',5)],
  soloFlights:[{id:'solo-old',traineeId:'b',date:'2026-10-01',grade:5},{id:'solo-in',traineeId:'b',date:'2026-10-07',syllabus:'Solo Circuits',grade:5},{id:'solo-future',date:'2026-10-09'}]});
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(x=>x.date),['2026-10-08','2026-10-07','2026-10-02']);
 assert.deepEqual(rows.map(x=>x.mode),['INSTRUCTED','SOLO','INSTRUCTED']);
 assert.ok(rows.every(x=>!Object.hasOwn(x,'grade')),'no grade or score should be passed to Home');
});
test('Recent flights are limited to 10 even with more records; invalid and future dates are excluded',()=>{
 const evals=Array.from({length:8},(_,i)=>({...ev('a','2026-10-08',4),id:'eval'+i,createdAt:'2026-10-08T10:'+String(i).padStart(2,'0')+':00Z'}));
 const solos=Array.from({length:8},(_,i)=>({id:'solo'+i,traineeId:'a',date:'2026-10-07',syllabus:'Solo',createdAt:'2026-10-07T08:00:00Z'}));
 const result=M.recentFlights({today:'2026-10-08',evaluations:evals,soloFlights:solos});
 assert.equal(result.length,10);
 assert.equal(result.filter(x=>x.mode==='INSTRUCTED').length,8);
 assert.equal(result.filter(x=>x.mode==='SOLO').length,2);
 assert.equal(result[0].id,'eval7','newest saved same-day time is first');
 assert.deepEqual(M.recentFlights({today:'invalid',evaluations:evals,soloFlights:solos}),[]);
 assert.deepEqual(M.recentFlights({today:'2026-10-08',evaluations:[ev('a','2026-02-31',4)]}),[]);
});
test('Home has only a full-width recent flight card, no grades/upcoming, and Duty Trainee cannot see Course Pulse',()=>{
 const home=html.slice(html.indexOf('function home(){'),html.indexOf('function evaluationHistoryViewHtml('));
 const duty=html.slice(html.indexOf('function dutyTraineeHome(){'),html.indexOf('function dutyTraineeSettingsScreen(){'));
 assert.ok(home.includes('FLYMPUS_HOME_OPERATIONS.recentFlights('));
 assert.ok(home.includes('evaluations:getEvaluations(),soloFlights:getSoloFlights()'));
 assert.ok(home.includes('Recent Flight Activity'));
 assert.ok(!home.includes('homeBottomGrid'));
 assert.ok(!home.includes('homeScore'));
 assert.ok(!home.includes('<h2>Upcoming Items</h2>'));
 assert.ok(!home.includes('courseMockEvalHistory()'));
 assert.ok(!home.includes('homeUpcomingItem'));
 assert.ok(home.includes('homeRecentEmpty'));
 assert.ok(home.includes("if(isDutyTrainee())return dutyTraineeHome();"));
 assert.ok(!duty.includes('Course Pulse'));
 assert.ok(!duty.includes('homePulseGrid'));
 assert.ok(html.includes('assets/home-operations.js?v=20261010-home-timeline-live-0822'));
});

test('Home renders real briefing, flight and debrief start clocks in circular left rail',()=>{
 const snippet=html.slice(html.indexOf('function homeFlightMoments('),html.indexOf('function home(){'));
 assert.match(snippet,/FLYMPUS_FLEET_MODEL\?\.flightTimeline\?\.\(flight,getPlanTimingDefaults\(\)\)/);
 assert.match(snippet,/clock\.briefing/);
 assert.match(snippet,/clock\.takeoff/);
 assert.match(snippet,/clock\.landing/);
 assert.doesNotMatch(snippet,/clock\.debrief\b/);
 assert.match(snippet,/homePlanMomentIcon/);
 const page=html.slice(html.indexOf('function home(){'),html.indexOf('function evaluationHistoryViewHtml('));
 assert.match(page,/homePlanRow homePlanRowTimeline/);
 assert.match(page,/homeFlightMoments\(x,homeHebrew\)/);
 assert.match(page,/x\.traineeName/);
 assert.match(page,/x\.syllabus/);
 assert.match(page,/x\.instructorName/);
 const css=fs.readFileSync('assets/home-operations.css','utf8');
 assert.match(css,/\.homePlanRow\.homePlanRowTimeline\{/);
 assert.match(css,/direction:ltr!important/);
});
test('Debrief starts at the planned landing, not the debrief end',()=>{
 const fleet=require('../assets/fleet-model.js');
 const clock=fleet.flightTimeline({date:'2026-10-10',time:'08:00',estimatedMinutes:30,briefingMinutes:20,debriefMinutes:15,mode:'INSTRUCTED'},fleet.TIMING_DEFAULTS).clock;
 assert.equal(clock.briefing,'07:40');
 assert.equal(clock.takeoff,'08:00');
 assert.equal(clock.landing,'08:30');
 assert.equal(clock.debrief,'08:45');
});

test('Today Plan displays full platform tail, emphasizes instructor and a planned-now rail',()=>{
 const page=html.slice(html.indexOf('function homeFlightMoments('),html.indexOf('function home(){'));
 assert.match(page,/function homeFlightAircraftName\(flight\)/);
 assert.match(page,/epPlatformLabel\(flight\?\.platformId\)/);
 const home=html.slice(html.indexOf('function home(){'),html.indexOf('function evaluationHistoryViewHtml('));
 assert.match(home,/homePlanInstructor/);
 assert.match(page,/homePlanLiveStatus/);
 assert.match(page,/homePlanTimelineRail/);
 assert.match(page,/homePlanTimelineNow/);
 assert.match(page,/data-briefing-start/);
 assert.match(page,/setInterval\(refreshHomeTimelineClock,30000\)/);
 assert.match(page,/visibilitychange/);
 assert.match(html,/if\(state\.screen==='home'\)ensureHomeTimelineClock\(\)/);
 assert.doesNotMatch(page,/setInterval\(\(\)=>render\(/);
 const styles=fs.readFileSync('assets/home-operations.css','utf8');
 assert.match(styles,/border-left:2px dashed/);
 assert.match(styles,/homePlanTimeline\[data-phase="flight"\]/);
 assert.match(styles,/\.homePlanInstructor\{font-weight:850/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
});
test('Planned-now marker uses local civil time and correct phase boundaries',()=>{
 const F=require('../assets/fleet-model.js');
 const flight={date:'2026-10-10',time:'08:00',briefingMinutes:20,estimatedMinutes:30,debriefMinutes:15,mode:'INSTRUCTED'};
 const timeline=F.flightTimeline(flight,F.TIMING_DEFAULTS);
 const at=(h,m)=>new Date(2026,9,10,h,m,0);
 const before=M.timelinePosition(timeline,at(7,35));
 assert.equal(before.phase,'upcoming');assert.equal(before.percent,0);
 const briefing=M.timelinePosition(timeline,at(7,45));
 assert.equal(briefing.phase,'briefing');assert.equal(briefing.percent,12.5);
 const inFlight=M.timelinePosition(timeline,at(8,15));
 assert.equal(inFlight.phase,'flight');assert.equal(inFlight.percent,75);
 const debrief=M.timelinePosition(timeline,at(8,40));
 assert.equal(debrief.phase,'debrief');assert.equal(debrief.percent,100);
 const done=M.timelinePosition(timeline,at(8,50));
 assert.equal(done.phase,'past');assert.equal(done.active,false);
 assert.equal(M.timelinePosition(null,at(8,0)).phase,'unknown');
});
