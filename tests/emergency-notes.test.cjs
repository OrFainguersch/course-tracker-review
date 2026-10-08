const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../assets/emergency-notes.js');
const page=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('only notes for performed emergencies are submitted, trimmed and capped',()=>{
  const result=api.normalize({eng:'  Engine stabilized after diagnosis  ',bat:'Do not include',gen:'  ',phantom:'Ignore'}, {eng:2,bat:0,gen:1,phantom:7},['eng','bat','gen']);
  assert.deepEqual(result,{eng:'Engine stabilized after diagnosis'});
  assert.equal(api.normalize({eng:'a'.repeat(1600)},{eng:1},['eng']).eng.length,api.MAX_LENGTH);
  assert.deepEqual(api.normalize({'__proto__':'bad'}, {'__proto__':1},[]),{});
  assert.deepEqual(api.normalize({eng:'Never saved'},{eng:0},['eng']),{});
});

test('the roster displays notes from submitted evaluations for the matching trainee/emergency',()=>{
  const evals=[
    {id:'ev1',traineeId:'t1',instructorName:'First Pilot',flightDate:'2026-10-01',emergencyCounts:{eng:2},emergencyNotes:{eng:'First event note'}},
    {id:'ev2',traineeId:'t1',instructorName:'Second Pilot',flightDate:'2026-10-03',emergencyCounts:{eng:1},emergencyNotes:{eng:'Second event note'}},
    {id:'ev3',traineeId:'t2',instructorName:'Other Pilot',flightDate:'2026-10-04',emergencyCounts:{eng:1},emergencyNotes:{eng:'Different trainee'}},
    {id:'ev4',traineeId:'t1',instructorName:'Third Pilot',flightDate:'2026-10-05',emergencyCounts:{eng:0},emergencyNotes:{eng:'Not practiced'}},
    {id:'ev5',traineeId:'t1',instructorName:'Fourth Pilot',flightDate:'2026-10-06',emergencyCounts:{bat:1},emergencyNotes:{bat:'Other emergency'}}
  ];
  const notes=api.collect(evals,'t1','eng');
  assert.deepEqual(notes.map(x=>x.note),['Second event note','First event note']);
  assert.equal(notes[0].instructorName,'Second Pilot');
  assert.equal(notes[0].date,'2026-10-03');
  assert.deepEqual(api.collect(evals,'t2','bat'),[]);
});

test('evaluation UI, autosaved drafts, revised evaluations and roster note panels are connected',()=>{
  for(const marker of [
    'name="emnote_','data-emergency-note-area','data-emergency-note-toggle',
    'data-emergency-practice-entry','emergencyNotes,',
    'FLYMPUS_EMERGENCY_NOTES.normalize','FLYMPUS_EMERGENCY_NOTES.collect',
    'latestEmergencyNoteHtml','emergencyPreviousNotes',
    "persistDraft()","data-emergency-profile-filter"
  ])assert.ok(page.includes(marker),'Missing '+marker);
  assert.match(page,/emergencyCountInput[\s\S]{0,2000}updateEmergencyUi/);
  assert.ok(page.includes("edit?.emergencyNotes||{}"));
  assert.ok(page.includes("const noteRows=window.FLYMPUS_EMERGENCY_NOTES.collect(savedRecords,traineeId,x.id)"));
});

test('last performed dates use only real, positive, submitted emergency occurrences per trainee',()=>{
  const defs=[{id:'gen',name:'GEN Malfunction'},{id:'bat',name:'BAT Malfunction'},{id:'engine',name:'Engine Cut'}];
  const saved=[
    {id:'old',traineeId:'t1',flightDate:'2026-09-22',emergencyCounts:{gen:2,bat:0}},
    {id:'new',traineeId:'t1',flightDate:'2026-09-27',emergencyCounts:{gen:1,bat:0}},
    {id:'earlier',traineeId:'t1',flightDate:'2026-09-24',emergencyCounts:{gen:4,bat:1}},
    {id:'other-trainee',traineeId:'t2',flightDate:'2026-10-07',emergencyCounts:{gen:1}},
    {id:'plan-only',traineeId:'t1',flightDate:'2026-10-08',plannedEmergencyIds:['engine','bat'],emergencyCounts:{gen:0}},
    {id:'demo',traineeId:'t1',source:'mock',flightDate:'2026-10-08',emergencyCounts:{engine:1,gen:1}},
    {id:'invalid',traineeId:'t1',flightDate:'2026-02-30',emergencyCounts:{bat:1}},
    {id:'bad-count',traineeId:'t1',flightDate:'2026-10-04',emergencyCounts:{gen:-1,bat:'not-a-number'}},
    {id:'missing-date',traineeId:'t1',emergencyCounts:{bat:2}},
  ];
  const dates=api.latestPerformedDates(saved,'t1',defs,['Engine Cut','GEN Malfunction']);
  assert.equal(dates.gen,'2026-09-27');
  assert.equal(dates.bat,'2026-09-24');
  assert.equal(dates.engine,undefined);
  assert.equal(Object.getPrototypeOf(dates),null);
  assert.equal(api.latestPerformedDates(saved,'t3',defs,[]).gen,undefined);
});
test('old submitted records resolve emergency arrays by historical names, not current position',()=>{
  const defs=[{id:'bat',name:'BAT Malfunction'},{id:'gen',name:'GEN Malfunction'}];
  const saved=[
    {traineeId:'t1',flightDate:'27/09/2026',emergencies:[1,2]},
    {traineeId:'t1',flightDate:'2026-09-26',emergencyCounts:{gen:1}},
    {traineeId:'t1',flightDate:'2026-10-01',emergencyCounts:{},emergencies:[3,5]},
    {traineeId:'t1',flightDate:'2026-13-01',emergencies:[9,9]},
  ];
  const dates=api.latestPerformedDates(saved,'t1',defs,['GEN Malfunction','BAT Malfunction']);
  assert.equal(dates.gen,'2026-09-27');
  assert.equal(dates.bat,'2026-09-27');
  assert.equal(api.latestPerformedDates([{traineeId:'t1',flightDate:'2026-09-30',emergencies:[1]}],'t1',defs,['UNKNOWN']).gen,undefined);
});
test('emergency exposure shows submitted dates without changing counts or planning',()=>{
  assert.ok(page.includes('FLYMPUS_EMERGENCY_NOTES.latestPerformedDates(savedRecords,traineeId,defs,emergencies)'));
  assert.ok(page.includes("lastPerformed:lastPerformed[x.id]||''"));
  assert.ok(page.includes("x.lastPerformed?'<span>Last performed:</span> '"));
  assert.ok(page.includes("formatDateDMY(x.lastPerformed)"));
  assert.ok(page.includes(":(x.count?'Practiced':'Not practiced yet')"));
  assert.ok(page.includes("'Last performed:':'בוצע לאחרונה:'"));
  assert.ok(page.includes('emergencyProfileRow small.emergencyLastPerformed'));
});
