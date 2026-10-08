/* Browser view/controller for full trainee Evaluation History; no cross-course persistence. */
(function(root){
 'use strict';
 const api=root.FLYMPUS_TRAINEE_EVAL_HISTORY;
 const validNumber=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value));
 function detailHtml(row,deps,gradeMax){
  const {esc}=deps;
  const saved=row.source!=='mock',emphases=Array.isArray(row.emphases)?row.emphases.filter(x=>String(x||'').trim()):[];
  const criteriaDefs=Array.isArray(row.criteriaSnapshot)&&row.criteriaSnapshot.length?row.criteriaSnapshot:(deps.criteriaDefs||[]);
  const emergencyDefs=Array.isArray(row.emergencySnapshot)&&row.emergencySnapshot.length?row.emergencySnapshot:(deps.emergencyDefs||[]);
  const byCriterion=new Map(criteriaDefs.map(c=>[String(c.id),c]));
  const byEmergency=new Map(emergencyDefs.map(e=>[String(e.id),e]));
  const group=(title,body)=>'<section class="profileEvalDetailGroup"><h4>'+title+'</h4>'+body+'</section>';
  const muted=text=>'<p class="profileEvalDetailEmpty">'+text+'</p>';
  const scalar=(label,value)=>'<div class="profileEvalFact"><span>'+label+'</span><strong>'+esc(value)+'</strong></div>';
  const comment=String(row.comments||'').trim();
  let sections='';
  if(!saved){
   sections+=muted('Review sample — only demonstration details are available, not a submitted instructor form.');
   if(Array.isArray(row.emergencies)&&row.emergencies.length){
    sections+=group('Emergencies practiced','<ul class="profileEvalBulletList">'+row.emergencies.map(name=>'<li>'+esc(name)+'</li>').join('')+'</ul>');
   }
   if(emphases.length)sections+=group('Next-flight emphases','<ol class="profileEvalBulletList">'+emphases.map(value=>'<li>'+esc(value)+'</li>').join('')+'</ol>');
   return '<div class="profileEvalDetails">'+sections+'</div>';
  }
  const duration=validNumber(row.duration)?Number(row.duration):null;
  const takeoffs=validNumber(row.takeoffs)?Number(row.takeoffs):null;
  const landings=validNumber(row.landings)?Number(row.landings):null;
  if(duration!==null||takeoffs!==null||landings!==null){
   sections+=group('Flight information','<div class="profileEvalFacts">'+
    (duration!==null?scalar('Duration',duration+' min'):'')+
    (takeoffs!==null?scalar('Takeoffs',takeoffs):'')+
    (landings!==null?scalar('Landings',landings):'')+'</div>');
  }
  const scores=row.scores&&typeof row.scores==='object'&&!Array.isArray(row.scores)?row.scores:{};
  const scoreRows=Object.entries(scores).filter(([,value])=>validNumber(value)&&Number(value)>0);
  const scoreHtml=scoreRows.map(([id,value])=>{
   const def=byCriterion.get(String(id));
   const weight=validNumber(def?.weight)?Number(def.weight):null;
   return '<div class="profileEvalScoreRow"><span>'+esc(def?.name||id)+(weight!==null?'<small>'+Math.round(weight*100)+'%</small>':'')+'</span><strong>'+esc(Number(value).toFixed(1))+' / '+gradeMax.toFixed(1)+'</strong></div>';
  }).join('');
  sections+=group('Assessment criteria',scoreHtml||muted('No individual criterion scores were saved.'));
  const counts=row.emergencyCounts&&typeof row.emergencyCounts==='object'&&!Array.isArray(row.emergencyCounts)?{...row.emergencyCounts}:{};
  const notes=row.emergencyNotes&&typeof row.emergencyNotes==='object'&&!Array.isArray(row.emergencyNotes)?row.emergencyNotes:{};
  // Older saved evaluations may only have a positional numeric list.
  if(!Object.keys(counts).length&&Array.isArray(row.emergencies)){
   row.emergencies.forEach((value,i)=>{if(validNumber(value)&&Number(value)>0&&emergencyDefs[i])counts[String(emergencyDefs[i].id)]=Number(value)});
  }
  const practiceIds=[...new Set([...Object.keys(counts),...Object.keys(notes)])].filter(id=>Number(counts[id])>0||String(notes[id]||'').trim());
  const practice=practiceIds.map(id=>{
   const def=byEmergency.get(String(id)),count=Number(counts[id])||0,note=String(notes[id]||'').trim();
   return '<div class="profileEvalEmergencyRow"><div><strong>'+esc(def?.name||id)+'</strong>'+(def?.category?'<small>'+esc(def.category)+'</small>':'')+'</div><span class="profileEvalCount">'+count+'×</span>'+(note?'<p class="profileEvalNote">'+esc(note)+'</p>':'')+'</div>';
  }).join('');
  sections+=group('Emergencies practiced',practice||muted('No emergency practice was recorded.'));
  const planned=Array.isArray(row.plannedEmergencyIds)?row.plannedEmergencyIds.filter(Boolean):[];
  if(planned.length){
   sections+=group('Planned emergencies','<ul class="profileEvalBulletList">'+planned.map(id=>'<li>'+esc(byEmergency.get(String(id))?.name||id)+'</li>').join('')+'</ul>');
  }
  sections+=group('Instructor comments',comment?'<p class="profileEvalNote">'+esc(comment)+'</p>':muted('No instructor comments were entered.'));
  sections+=group('Next-flight emphases',emphases.length?'<ol class="profileEvalBulletList">'+emphases.map(value=>'<li>'+esc(value)+'</li>').join('')+'</ol>':muted('No next-flight emphases were entered.'));
  if(row.progressionDecision){
   const labels={ADVANCE:'Pass · Move forward',CONTINUE:'Not yet · Continue'};
   sections+=group('Syllabus progression',scalar('Instructor decision',labels[row.progressionDecision]||String(row.progressionDecision)));
  }
  const gradeMode=row.gradeMode==='INSTRUCTOR'?'Instructor-assigned grade':row.gradeMode==='SUGGESTED'?'Weighted suggested grade':'';
  if(gradeMode||validNumber(row.suggestedGrade)){
   sections+=group('Grading details','<div class="profileEvalFacts">'+
    (gradeMode?scalar('Grade method',gradeMode):'')+
    (validNumber(row.suggestedGrade)?scalar('Calculated grade',Number(row.suggestedGrade).toFixed(1)+' / '+gradeMax.toFixed(1)):'')+'</div>');
  }
  if(Number(row.revision)>1){
   sections+=group('Revision',scalar('Evaluation revision',String(Number(row.revision)))+
    (String(row.changeReason||'').trim()?'<p class="profileEvalNote">'+esc(row.changeReason)+'</p>':''));
  }
  return '<div class="profileEvalDetails">'+sections+'</div>';
 }
 function render(rows,deps){
  const {esc,formatCourseDate,grading,dateRangeFilterHtml,multiFilterHtml}=deps;
  const options=api.choices(rows),gradeMin=Number.isFinite(Number(grading.min))?Number(grading.min):0,gradeMax=Number.isFinite(Number(grading.max))?Number(grading.max):5;
  const cards=rows.map((r,i)=>{
   const grade=validNumber(r.grade)?Number(r.grade).toFixed(1):'—';
   return '<details class="recentEvalCard profileEvalDisclosure" data-trainee-evaluation-row data-profile-eval-index="'+i+'">'+
    '<summary class="profileEvalSummary"><div class="recentEvalTop"><b>'+esc(r.syllabus||'—')+'</b><div class="profileEvalSummaryActions">'+
    (r.source==='mock'?'<span class="pill gray profileEvalSamplePill">Review sample</span>':'')+
    '<span class="profileEvalToggleLabel"><span class="profileEvalOpenText">Show details</span><span class="profileEvalCloseText">Hide details</span></span>'+
    '<span class="profileEvalChevron" aria-hidden="true"></span></div></div>'+
    '<div class="recentEvalMeta"><span>Date<strong>'+esc(formatCourseDate(r.date))+'</strong></span><span>Instructor<strong>'+esc(r.instructorName||'—')+'</strong></span>'+
    '<span>Guided syllabus<strong>'+esc(r.syllabus||'—')+'</strong></span><span>Grade<strong>'+grade+' / '+gradeMax.toFixed(1)+'</strong></span></div></summary>'+
    detailHtml(r,deps,gradeMax)+'</details>';
  }).join('');
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
