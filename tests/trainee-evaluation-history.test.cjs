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