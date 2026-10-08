const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const h=require('../assets/trainee-evaluation-history.js');
const page=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const viewSource=fs.readFileSync(path.join(__dirname,'../assets/trainee-evaluation-view.js'),'utf8');
const rows=[
 {id:'1',traineeId:'t1',date:'2026-09-02',instructorId:'i1',instructorName:'First Instructor',syllabus:'Basics',grade:3.7,source:'mock'},
 {id:'2',traineeId:'t1',date:'2026-09-03',instructorId:'i2',instructorName:'Second Instructor',syllabus:'Engine cuts',grade:4.8,source:'saved'},
 {id:'3',traineeId:'t1',date:'2026-09-04',instructorId:'i1',instructorName:'First Instructor',syllabus:'Engine cuts',grade:4.0,source:'saved'},
 {id:'4',traineeId:'t1',date:'2026-09-05',instructorId:'i2',instructorName:'Second Instructor',syllabus:'Basics',grade:4.5,source:'saved'},
 {id:'5',traineeId:'t1',date:'2026-09-06',instructorId:'i1',instructorName:'First Instructor',syllabus:'Basics',grade:3.9,source:'saved'},
 {id:'6',traineeId:'t1',date:'2026-09-07',instructorId:'i2',instructorName:'Second Instructor',syllabus:'Engine cuts',grade:4.9,source:'saved'}
];
test('date range filtering is inclusive and rejects impossible calendar days',()=>{
 assert.equal(h.isoDate('01/10/2026'),'2026-10-01');
 assert.equal(h.isoDate('31/02/2026'),'');
 assert.deepEqual(h.filtered(rows,{from:'03/09/2026',to:'2026-09-05'}).map(x=>x.id),['2','3','4']);
 assert.deepEqual(h.filtered(rows,{from:'2026-09-06',to:'2026-09-01'}),[]);
});
test('instructor and syllabus multisets combine with exact inclusive grade range',()=>{
 assert.deepEqual(h.filtered(rows,{instructors:['i1'],syllabi:['Engine cuts'],minGrade:'4',maxGrade:'4'}).map(x=>x.id),['3']);
 assert.deepEqual(h.filtered(rows,{instructors:['i1','i2'],syllabi:['Basics'],minGrade:'3.9',maxGrade:'4.5'}).map(x=>x.id),['4','5']);
 assert.deepEqual(h.filtered(rows,{minGrade:'5',maxGrade:'2'}),[]);
 assert.deepEqual(h.filtered(rows,{}).map(x=>x.id),rows.map(x=>x.id));
});
test('filter options include historical instructors and syllabi without relying on active roster',()=>{
 const opts=h.choices([...rows,{instructorName:'Former Instructor',syllabus:'Old syllabus',grade:2.5}]);
 assert.equal(opts.instructors.length,3);
 assert.ok(opts.instructors.some(x=>x.value==='name:Former Instructor'));
 assert.ok(opts.syllabi.some(x=>x.value==='Old syllabus'));
 assert.equal(h.instructorKey({instructorName:'Former Instructor'}),'name:Former Instructor');
});
test('view renders all six evaluations (not five), four filters, and reset with empty handling',()=>{
 const context={window:{FLYMPUS_TRAINEE_EVAL_HISTORY:h}};
 vm.runInNewContext(viewSource,context,{filename:'trainee-evaluation-view.js'});
 const deps={
  esc:s=>String(s).replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x])),
  grading:{min:1,max:5},
  formatCourseDate:x=>x,
  dateRangeFilterHtml:(prefix)=>'<div id="'+prefix+'From"></div><div id="'+prefix+'To"></div>',
  multiFilterHtml:(id)=>'<div id="'+id+'"></div>'
 };
 const rendered=context.window.FLYMPUS_TRAINEE_EVAL_VIEW.render(rows,deps);
 assert.equal((rendered.match(/data-trainee-evaluation-row/g)||[]).length,6);
 for(const marker of ['Evaluation History','traineeEvalHistoryDateFrom','traineeEvalHistoryDateTo',
  'traineeEvalHistoryInstructor','traineeEvalHistorySyllabus','traineeEvalHistoryMinGrade',
  'traineeEvalHistoryMaxGrade','traineeEvalHistoryReset','traineeEvalHistoryEmpty','Review sample'])
  assert.ok(rendered.includes(marker),marker);
 const noRows=context.window.FLYMPUS_TRAINEE_EVAL_VIEW.render([],deps);
 assert.ok(noRows.includes('No evaluations yet.'));
});
test('profile uses complete trainee history and mounted filters without changing global Evaluation',()=>{
 assert.ok(page.includes('const evalRows=traineeEvaluationHistory(t.id),'));
 assert.ok(!page.includes('const evalRows=traineeEvaluationHistory(t.id).slice(0,5)'));
 assert.ok(page.includes('function traineeEvaluationHistoryViewHtml(evalRows)'));
 assert.ok(page.includes('function bindTraineeEvaluationHistory()'));
 assert.ok(page.includes('bindTraineeEvaluationHistory();'));
 assert.ok(page.includes('traineeEvaluationHistoryViewHtml(evalRows)'));
 assert.ok(page.includes('assets/trainee-evaluation-history.css'));
 assert.ok(page.includes('assets/trainee-evaluation-history.js'));
 assert.ok(page.includes('assets/trainee-evaluation-view.js'));
 assert.ok(viewSource.includes('api.filtered(scopedRows,filters)'));
 assert.ok(viewSource.includes('resetMultiFilter('));
});
test('saved evaluation expands as an accessible, read-only copy of the submitted form',()=>{
 const context={window:{FLYMPUS_TRAINEE_EVAL_HISTORY:h}};
 vm.runInNewContext(viewSource,context,{filename:'trainee-evaluation-view.js'});
 const esc=value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const full={
  id:'saved-1',source:'saved',date:'2026-10-06',instructorName:'Instructor B',syllabus:'Circuits',grade:4.2,
  duration:25,takeoffs:2,landings:3,gradeMode:'INSTRUCTOR',suggestedGrade:4.1,
  scores:{alt:4,method:5},
  criteriaSnapshot:[{id:'alt',name:'Altitude control',weight:.6},{id:'method',name:'Work method',weight:.4}],
  plannedEmergencyIds:['gen'],emergencyCounts:{gen:2,flaps:1},
  emergencySnapshot:[{id:'gen',name:'Generator malfunction',category:'Electrical'},{id:'flaps',name:'Flap failure',category:'Flight Controls'}],
  emergencyNotes:{gen:'Observe the voltage <first>'},
  comments:'Maintain a stable circuit <before> touch-and-go',
  emphases:['Altitude', 'Trim <carefully>'],
  progressionDecision:'CONTINUE',revision:2,changeReason:'Clarified instructor comments'
 };
 const output=context.window.FLYMPUS_TRAINEE_EVAL_VIEW.render([full],{
  esc,grading:{min:1,max:5},formatCourseDate:x=>x,
  dateRangeFilterHtml:()=>'<div id="traineeEvalHistoryDateFrom"></div><div id="traineeEvalHistoryDateTo"></div>',
  multiFilterHtml:id=>'<div id="'+id+'"></div>',
  criteriaDefs:[],emergencyDefs:[]
 });
 assert.match(output,/<details class="recentEvalCard profileEvalDisclosure" data-trainee-evaluation-row/);
 assert.match(output,/<summary class="profileEvalSummary">/);
 assert.match(output,/profileEvalChevron/);
 assert.match(output,/Show details/);
 assert.equal((output.match(/<span>Grade<strong>4\.2 \/ 5\.0<\/strong><\/span>/g)||[]).length,1);
 assert.doesNotMatch(output,/class="grade"/);
 for(const value of ['Altitude control','Work method','Generator malfunction','Flap failure',
  'Planned emergencies','Instructor comments','Next-flight emphases','Duration','Takeoffs','Landings',
  'Instructor-assigned grade','4.1 / 5.0','Not yet · Continue','Evaluation revision','Clarified instructor comments'])
  assert.ok(output.includes(value),'Missing submitted field '+value);
 assert.ok(output.includes('Observe the voltage &lt;first&gt;'));
 assert.ok(output.includes('Maintain a stable circuit &lt;before&gt;'));
 assert.ok(output.includes('Trim &lt;carefully&gt;'));
 assert.ok(!output.includes('<before>')&&!output.includes('<carefully>'),'User-authored text must be escaped');
});
test('review samples expose only demo information and legacy saved rows use current catalog names',()=>{
 const context={window:{FLYMPUS_TRAINEE_EVAL_HISTORY:h}};
 vm.runInNewContext(viewSource,context,{filename:'trainee-evaluation-view.js'});
 const deps={esc:s=>String(s),grading:{min:1,max:5},formatCourseDate:s=>s,
  dateRangeFilterHtml:()=>'',multiFilterHtml:()=>'',criteriaDefs:[{id:'alt',name:'Altitude control',weight:1}],
  emergencyDefs:[{id:'gen',name:'Generator malfunction'}]};
 const mock=context.window.FLYMPUS_TRAINEE_EVAL_VIEW.render([{...rows[0],emergencies:['Engine cut'],emphases:['Keep altitude']}],deps);
 assert.ok(mock.includes('Review sample — only demonstration details are available'));
 assert.ok(mock.includes('Engine cut')&&mock.includes('Keep altitude'));
 assert.ok(!mock.includes('No instructor comments were entered.'),'Do not fabricate absent submitted form fields for samples');
 const legacy=context.window.FLYMPUS_TRAINEE_EVAL_VIEW.render([{...rows[1],scores:{alt:4},emergencyCounts:{gen:1},comments:'Good progress',emphases:[]}],deps);
 assert.ok(legacy.includes('Altitude control')&&legacy.includes('Generator malfunction'));
 assert.ok(legacy.includes('Good progress'));
 assert.ok(legacy.includes('No next-flight emphases were entered.'));
});
test('profile read-only sheet uses course definitions and persists future form-label snapshots',()=>{
 assert.ok(page.includes('criteriaDefs:evaluationCriteriaDefs(),emergencyDefs:evaluationEmergencyDefs()'));
 assert.ok(page.includes('criteriaSnapshot:evalCriteria.map('));
 assert.ok(page.includes('emergencySnapshot:emergencyDefs.map('));
 assert.ok(page.includes('assets/trainee-evaluation-view.js?v=20261008-history02'));
 assert.ok(page.includes('assets/trainee-evaluation-history.css?v=20261008-history02'));
});
