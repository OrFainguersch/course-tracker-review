/* Browser view/controller for full trainee Evaluation History; no cross-course persistence. */
(function(root){
 'use strict';
 const api=root.FLYMPUS_TRAINEE_EVAL_HISTORY;
 function render(rows,deps){
  const {esc,formatCourseDate,grading,dateRangeFilterHtml,multiFilterHtml}=deps;
  const options=api.choices(rows),gradeMin=Number.isFinite(Number(grading.min))?Number(grading.min):0,gradeMax=Number.isFinite(Number(grading.max))?Number(grading.max):5;
  const cards=rows.map((r,i)=>'<article class="recentEvalCard" data-trainee-evaluation-row data-profile-eval-index="'+i+'"><div class="recentEvalTop"><b>'+esc(r.syllabus||'—')+'</b><div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap">'+(r.source==='mock'?'<span class="pill gray profileEvalSamplePill">Review sample</span>':'')+'<span class="grade">'+(Number.isFinite(Number(r.grade))?Number(r.grade).toFixed(1):'—')+'</span></div></div><div class="recentEvalMeta"><span>Date<strong>'+esc(formatCourseDate(r.date))+'</strong></span><span>Instructor<strong>'+esc(r.instructorName||'—')+'</strong></span><span>Guided syllabus<strong>'+esc(r.syllabus||'—')+'</strong></span><span>Grade<strong>'+(Number.isFinite(Number(r.grade))?Number(r.grade).toFixed(1):'—')+' / '+gradeMax.toFixed(1)+'</strong></span></div>'+(r.comments?'<p class="profileEvalComments"><b>Instructor comments:</b> '+esc(r.comments)+'</p>':'')+(Number(r.revision)>1?'<small class="mutedHint">Evaluation revision '+Number(r.revision)+'</small>':'')+'</article>').join('');
  return '<section class="card timeline profileEvalHistorySection" id="traineeEvalHistorySection"><div class="profileEvalHistoryHead"><div><h3>Evaluation History</h3><p class="sub">Complete guided evaluation history for this trainee.</p></div><span class="profileEvalHistoryTotal">'+rows.length+' total</span></div>'+
   '<div class="profileEvalFilters">'+dateRangeFilterHtml('traineeEvalHistoryDate','Date range')+
   multiFilterHtml('traineeEvalHistoryInstructor','Instructor',options.instructors,[],'All instructors')+
   multiFilterHtml('traineeEvalHistorySyllabus','Syllabus',options.syllabi,[],'All syllabi')+
   '<div class="field"><label>Grade range</label><div class="profileEvalGradeFields"><div class="field"><label for="traineeEvalHistoryMinGrade">Minimum grade</label><input class="input" type="number" inputmode="decimal" step="0.1" min="'+gradeMin+'" max="'+gradeMax+'" id="traineeEvalHistoryMinGrade" placeholder="'+gradeMin.toFixed(1)+'"></div><div class="field"><label for="traineeEvalHistoryMaxGrade">Maximum grade</label><input class="input" type="number" inputmode="decimal" step="0.1" min="'+gradeMin+'" max="'+gradeMax+'" id="traineeEvalHistoryMaxGrade" placeholder="'+gradeMax.toFixed(1)+'"></div></div></div>'+
   '<button class="btn secondary small profileEvalReset" type="button" id="traineeEvalHistoryReset">Reset filters</button></div>'+
   '<div class="profileEvalResultLine"><span id="traineeEvalHistoryCount" aria-live="polite">'+rows.length+' of '+rows.length+' evaluations shown</span></div>'+
   '<div class="recentEvalList profileEvalHistoryList" id="traineeEvalHistoryList">'+cards+'</div>'+
   '<div class="profileEvalHistoryEmpty" id="traineeEvalHistoryEmpty" '+(rows.length?'hidden':'')+'>'+(rows.length?'No evaluations match these filters.':'No evaluations yet.')+'</div></section>';
 }
 function bind(rootElement,rows,deps){
  if(!rootElement)return;
  const {find,multiFilterValues,resetMultiFilter,language}=deps,scopedRows=rows.map((row,index)=>({...row,__profileIndex:index}));
  const cards=[...rootElement.querySelectorAll('[data-trainee-evaluation-row]')];
  const from=find('#traineeEvalHistoryDateFrom'),to=find('#traineeEvalHistoryDateTo'),minimum=find('#traineeEvalHistoryMinGrade'),maximum=find('#traineeEvalHistoryMaxGrade'),summary=find('#traineeEvalHistoryCount'),empty=find('#traineeEvalHistoryEmpty');
  const apply=()=>{
   const filters={from:from?.value||'',to:to?.value||'',instructors:multiFilterValues('traineeEvalHistoryInstructor'),syllabi:multiFilterValues('traineeEvalHistorySyllabus'),minGrade:minimum?.value||'',maxGrade:maximum?.value||''};
   const visible=new Set(api.filtered(scopedRows,filters).map(x=>x.__profileIndex));
   cards.forEach(card=>card.hidden=!visible.has(Number(card.dataset.profileEvalIndex)));
   const shown=visible.size,hebrew=language()==='he';
   if(summary)summary.textContent=hebrew?shown+' מתוך '+rows.length+' הערכות מוצגות':shown+' of '+rows.length+' evaluations shown';
   if(empty){empty.hidden=shown>0;empty.textContent=hebrew?(rows.length?'לא נמצאו הערכות התואמות למסננים.':'עדיין אין הערכות.'):(rows.length?'No evaluations match these filters.':'No evaluations yet.')}
  };
  ['traineeEvalHistoryInstructor','traineeEvalHistorySyllabus'].forEach(id=>find('#'+id)?.addEventListener('filterapply',apply));
  [from,to,minimum,maximum].forEach(el=>{if(!el)return;el.addEventListener('change',apply);if(el===minimum||el===maximum)el.addEventListener('input',apply)});
  const reset=find('#traineeEvalHistoryReset');
  if(reset)reset.onclick=()=>{resetMultiFilter('traineeEvalHistoryInstructor');resetMultiFilter('traineeEvalHistorySyllabus');[from,to,minimum,maximum].forEach(el=>{if(el)el.value=''});apply()};
  apply();
 }
 root.FLYMPUS_TRAINEE_EVAL_VIEW=Object.freeze({render,bind});
})(window);