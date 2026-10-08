const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleSource=fs.readFileSync(path.join(root,'assets/reports-dashboard.js'),'utf8');
const sandbox={module:{exports:{}},window:{},console};
vm.runInNewContext(moduleSource,sandbox,{filename:'reports-dashboard.js'});
const R=sandbox.module.exports;
const submitted=[
 {date:'2026-09-18',plannedInstructed:2,plannedSolo:1,cancellations:[{key:'SOLO_1',reasonId:'weather',reasonLabel:'Weather'}]},
 {date:'2026-09-19',plannedInstructed:2,plannedSolo:0,cancellations:[{key:'INSTRUCTED_2',reasonLabel:'Technical'}]},
 {date:'2026-09-21',plannedInstructed:1,plannedSolo:0,cancellations:[]}
];
const evaluations=[
 {id:'e1',flightDate:'2026-09-18',traineeId:'a',grade:7,syllabus:'Basics'},
 {id:'e2',flightDate:'2026-09-18',traineeId:'b',grade:9,syllabus:'Circuits'},
 {id:'e3',flightDate:'2026-09-19',traineeId:'a',grade:8,syllabus:'Circuits'},
 {id:'e4',flightDate:'2026-09-20',traineeId:'a',grade:10,syllabus:'Solo'},
 {id:'e5',flightDate:'2026-09-21',traineeId:'a',grade:6,syllabus:'Circuits'}
];
const solo=[{id:'s1',date:'2026-09-18',traineeId:'a'}];
test('Planned vs Executed is derived from submitted records with classified and unclassified gaps',()=>{
  const result=R.operations({plans:submitted,evaluations,soloFlights:solo,granularity:'day'});
  const [d18,d19,d20,d21]=result.byDate;
  assert.equal(d18.planned,3);
  assert.equal(d18.executed,3);
  assert.equal(d18.cancelled,0,'A stale cancellation reason is not counted when all planned flights execute');
  assert.equal(d19.planned,2);
  assert.equal(d19.executed,1);
  assert.equal(d19.cancelled,1);
  assert.equal(d19.unresolved,0);
  assert.equal(d20.hasPlan,false);
  assert.equal(d20.extra,1,'Executions without plans must not be counted as cancelled');
  assert.equal(d21.planned,1);
  assert.equal(d21.cancelled,0);
  assert.equal(result.totals.planned,6);
  assert.equal(result.totals.executed,6);
  assert.equal(result.totals.cancelled,1);
  assert.equal(result.totals.unresolved,0);
  assert.equal(result.totals.extra,1);
  assert.equal(result.totals.executionRate,100*5/6);
});
test('Missing execution without cancellation reason is a gap, never automatically cancelled',()=>{
  const r=R.operations({plans:[{date:'2026-09-23',plannedInstructed:4,plannedSolo:1,cancellations:[]}],evaluations:[{id:'x',flightDate:'2026-09-23'}]});
  assert.equal(r.totals.unresolved,4);
  assert.equal(r.totals.cancelled,0);
  assert.equal(r.totals.executionRate,20);
});
test('Week grouping anchors Monday; month grouping aggregates full periods',()=>{
  const week=R.operations({plans:submitted,evaluations,soloFlights:solo,granularity:'week'});
  assert.equal(week.rows[0].key,'2026-09-14');
  assert.equal(week.rows[0].planned,5);
  assert.equal(week.rows[1].key,'2026-09-21');
  const month=R.operations({plans:submitted,evaluations,soloFlights:solo,granularity:'month'});
  assert.equal(month.rows.length,1);
  assert.equal(month.rows[0].key,'2026-09');
});
test('Date filtering applies consistently to plans, instructed and solo flights',()=>{
 const filtered=R.operations({plans:submitted,evaluations,soloFlights:solo,from:'2026-09-19',to:'2026-09-19'});
 assert.equal(filtered.byDate.length,1);
 assert.equal(filtered.totals.executed,1);
 assert.equal(filtered.totals.planned,2);
});
test('Course dashboard ranks graded trainees, includes solo, and does not fabricate missing grades',()=>{
 const data=R.dashboard({trainees:[{id:'a',name:'A',progress:48},{id:'b',name:'B'}],evaluations,soloFlights:solo,
 progressions:{a:{current:'Circuits'},b:{current:'Basics'}}});
 assert.equal(data.totals.flights,6);
 assert.equal(data.totals.solo,1);
 assert.equal(data.people[0].name,'B');
 assert.equal(data.people[0].rank,1);
 assert.equal(data.people[1].flights,5);
 assert.equal(data.people[1].completion,48);
 assert.equal(data.people[0].completion,null);
});
test('CSV safely quotes and prevents spreadsheet formula injection',()=>{
 const sample=R.csvCells([['Name','Remarks'],['=SUM(1,2)','a"b']]);
 assert(sample.startsWith('\ufeff'));
 assert(sample.includes('"\'=SUM(1,2)"'));
 assert(sample.includes('"a""b"'));
});
test('HTML render escapes reason labels, includes SVG graphic and responsive tabs are wired',()=>{
 const data=R.operations({plans:[{date:'2026-09-22',plannedSolo:1,cancellations:[{reasonLabel:'<script>alert(1)</script>'}]}]});
 const panel=R.plannedHtml(data,'en');
 assert(panel.includes('<svg'));
 assert(panel.includes('&lt;script&gt;'));
 assert(!panel.includes('<script>alert(1)</script>'));
 assert(html.includes('function reportsLegacy()')&&html.includes('function reports()'));
 assert(html.includes('data-report-tab=')&&html.includes("state.reportGranularity||'week'"));
 assert(html.includes("window.FLYMPUS_REPORTS?.operations?.("));
 assert(html.includes("getEvaluations(),soloFlights:getSoloFlights()"));
 assert(!html.includes('plans:[...courseMock'));
 assert(html.includes('./assets/reports-dashboard.js?v=0767'));
 assert(html.includes('./assets/reports-dashboard.css?v=0767'));
});
test('Hebrew chart headings and table labels are rendered in RTL-ready content',()=>{
 const htmlText=R.plannedHtml(R.operations({plans:submitted,evaluations,soloFlights:solo}),'he');
 assert(htmlText.includes('תכנון מול ביצוע לאורך זמן'));
 assert(htmlText.includes('סיבות ביטול'));
});

test('future planned sorties remain upcoming and never become cancellation or overdue gap',()=>{
 const out=R.operations({plans:[{date:'2027-11-20',plannedInstructed:3,plannedSolo:2,cancellations:[]}],
   evaluations:[],soloFlights:[],today:'2026-10-08'});
 assert.equal(out.totals.cancelled,0);
 assert.equal(out.totals.unresolved,0);
 assert.equal(out.totals.upcoming,5);
 assert(R.plannedHtml(out,'he').includes('טיסות עתידיות'));
 const csv=R.operationsCsv(out);
 assert(csv.includes('"Upcoming"'));
});
test('Planned vs Executed form uses the same submitted execution sources as dashboard',()=>{
 assert(!html.includes('const executedInstructed=allEvaluationsForAnalytics().filter'));
 assert(!html.includes('instructedCount=allEvaluationsForAnalytics().filter'));
 assert(html.includes("const executedInstructed=getEvaluations().filter"));
 assert(html.includes("instructedCount=getEvaluations().filter"));
});
