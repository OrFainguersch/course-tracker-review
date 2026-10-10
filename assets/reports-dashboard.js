/* FLYMPUS Reports & Analytics v1 · no dependencies or mock-source metrics.
   Planning originates in submitted daily reports. Executions originate in
   submitted evaluations and solo flight records. All aggregations are pure. */
(function(root){
'use strict';
const LANG={
 en:{
  planned:'Planned',executed:'Executed',cancelled:'Cancelled',unresolved:'Unclassified gap',upcoming:'Upcoming flights',extra:'Unplanned executions',
  executionRate:'Execution rate',submittedDays:'Reported days',noData:'No recorded activity in this period.',
  planNote:'Only submitted daily plans count. Executions are based on saved Evaluations and Solo Flights; demo history is excluded.',
  gapNote:'A flight is counted as cancelled only when its cancellation reason was recorded. Other unexecuted plans remain unclassified.',
  plannedChart:'Planned versus executed over time',cancelChart:'Cancellation reasons',dailyBreakdown:'Execution breakdown',
  day:'Day',week:'Week',month:'Month',period:'Period',reason:'Reason',count:'Flights',
  totals:'Total',noPlan:'Not planned',unknown:'No reason recorded',instructed:'Instructed',solo:'Solo',
  reviewed:'Recorded',noReasons:'No cancellation reasons recorded.',plannedDetail:'Planned vs Executed · operational summary',
  dashboard:'Course dashboard',dashboardSub:'Trainee performance and course progress from the active course.',
  flightCount:'Flights',avgGrade:'Average grade',activeTrainees:'Active trainees',soloFlights:'Solo flights',
  trainee:'Trainee',rank:'Rank',currentSyllabus:'Current syllabus',completion:'Course completion',gradedFlights:'Graded flights',
  instructorFlights:'Instructed flights',courseAverage:'Course average',noGrade:'No grade',noTrainees:'No trainees in the selected course.',
  notRecorded:'Not recorded',abovePlan:'Beyond plan',courseSummary:'Course performance overview',
  quality:'Recorded figures only',unplannedNote:'Executions without a submitted plan are shown separately, never treated as 100% completion.',
  remaining:'Awaiting classification',flightKind:'Flight type',periodTotal:'Period totals',notYet:'Not yet classified',
  hasPlan:'Submitted plan',missingPlan:'No submitted plan'
 },
 he:{
  planned:'מתוכנן',executed:'בוצע',cancelled:'בוטל',unresolved:'פער ללא סיווג',upcoming:'טיסות עתידיות',extra:'ביצועים ללא תכנון',
  executionRate:'אחוז ביצוע',submittedDays:'ימי דיווח',noData:'אין פעילות מתועדת בתקופה שנבחרה.',
  planNote:'רק תכניות יומיות שהוגשו נכללות בתכנון. הביצוע מחושב מהערכות וטיסות סולו שנשמרו, ללא נתוני הדגמה.',
  gapNote:'טיסה נספרת כמבוטלת רק אם נרשמה לה סיבת ביטול. שאר הפער בין התכנון לביצוע נשאר ללא סיווג.',
  plannedChart:'תכנון מול ביצוע לאורך זמן',cancelChart:'סיבות ביטול',dailyBreakdown:'פירוט ביצוע',
  day:'יום',week:'שבוע',month:'חודש',period:'תקופה',reason:'סיבה',count:'טיסות',
  totals:'סה״כ',noPlan:'לא תוכנן',unknown:'לא צוינה סיבה',instructed:'עם מדריך',solo:'סולו',
  reviewed:'מתועד',noReasons:'אין סיבות ביטול מתועדות.',plannedDetail:'תכנון מול ביצוע · סיכום פעילות',
  dashboard:'לוח נתוני הקורס',dashboardSub:'ביצועי חניכים והתקדמות בקורס הפעיל.',
  flightCount:'טיסות',avgGrade:'ציון ממוצע',activeTrainees:'חניכים פעילים',soloFlights:'טיסות סולו',
  trainee:'חניך',rank:'דירוג',currentSyllabus:'סילבוס נוכחי',completion:'השלמת קורס',gradedFlights:'טיסות עם ציון',
  instructorFlights:'טיסות עם מדריך',courseAverage:'ממוצע הקורס',noGrade:'ללא ציון',noTrainees:'אין חניכים בקורס שנבחר.',
  notRecorded:'לא נרשם',abovePlan:'מעבר לתכנון',courseSummary:'סיכום ביצועי הקורס',
  quality:'נתונים מתועדים בלבד',unplannedNote:'ביצועים ללא תכנית שהוגשה מוצגים בנפרד ואינם נחשבים ל־100% ביצוע.',
  remaining:'ממתין לסיווג',flightKind:'סוג טיסה',periodTotal:'סיכום התקופה',notYet:'טרם סווג',
  hasPlan:'תכנית הוגשה',missingPlan:'אין תכנית שהוגשה'
 }
};
const tr=(key,lang='en')=>LANG[lang==='he'?'he':'en'][key]||key;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
const count=x=>Math.max(0,Math.floor(Number.isFinite(Number(x))?Number(x):0));
const numeric=x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
const pct=(num,den)=>den>0?100*num/den:null;
const uniqueBy=(data,key)=>{const map=new Map();(data||[]).forEach(x=>{const k=x?.[key];if(k!=null)map.set(String(k),x)});return [...map.values()]};
function mondayOf(iso){
  const d=new Date(iso+'T12:00:00Z');if(Number.isNaN(d.getTime()))return iso;
  const day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-(day===0?6:day-1));
  return d.toISOString().slice(0,10);
}
function bucket(date,granularity){
  if(granularity==='month')return date.slice(0,7);
  if(granularity==='week')return mondayOf(date);
  return date
}
function operations({plans=[],evaluations=[],soloFlights=[],from='',to='',granularity='day',today=''}={}){
  const now=new Date(),localToday=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const reportToday=validDate(today)||localToday;
  const reportDates=new Map(),live=new Map();
  // The submitted plan is authoritative. NEVER add a draft or a mock flight.
  (plans||[]).forEach(p=>{const date=validDate(p?.date);if(date)reportDates.set(date,p)});
  const mark=(date,type)=>{if(!validDate(date))return;const x=live.get(date)||{instructed:0,solo:0};x[type]++;live.set(date,x)};
  uniqueBy(evaluations,'id').forEach(e=>mark(e.flightDate||e.date,'instructed'));
  uniqueBy(soloFlights,'id').forEach(f=>mark(f.date,'solo'));
  const dates=[...new Set([...reportDates.keys(),...live.keys()])].filter(d=>(!from||d>=from)&&(!to||d<=to)).sort();
  const byDate=dates.map(date=>{
    const p=reportDates.get(date)||null,actual=live.get(date)||{instructed:0,solo:0};
    const plannedInstructed=p?count(p.plannedInstructed):0,plannedSolo=p?count(p.plannedSolo):0;
    const planned=p?plannedInstructed+plannedSolo:0,executed=actual.instructed+actual.solo;
    const gap=p?Math.max(0,planned-executed):0;
    const reasons=[];
    // A recorded cancellation may not outnumber the unfinished planned sorties.
    (p?.cancellations||[]).forEach(item=>{if(item?.reasonLabel||item?.reasonId||item?.reason){const label=String(item.reasonLabel||item.reason||item.reasonId).trim(),quantity=Math.max(1,Math.floor(Number(item.quantity)||1));for(let i=0;i<quantity&&reasons.length<gap;i++)reasons.push(label)}});
    if(!reasons.length&&p?.reason)reasons.push(String(p.reason).trim());
    const cancellations=reasons.slice(0,gap),cancelled=cancellations.length;
    const openGap=gap-cancelled,isFuture=date>reportToday;
    return {date,hasPlan:!!p,plannedInstructed,plannedSolo,planned,executedInstructed:actual.instructed,
      executedSolo:actual.solo,executed,cancelled,unresolved:isFuture?0:openGap,upcoming:isFuture?openGap:0,extra:Math.max(0,executed-planned),
      reasons:cancellations,executionRate:p?pct(Math.min(planned,executed),planned):null};
  });
  const groups=new Map();
  byDate.forEach(r=>{
    const key=bucket(r.date,granularity);
    const g=groups.get(key)||{key,days:0,submittedDays:0,planned:0,plannedInstructed:0,plannedSolo:0,executed:0,executedInstructed:0,executedSolo:0,cancelled:0,unresolved:0,upcoming:0,extra:0,reasons:[]};
    g.days++;if(r.hasPlan)g.submittedDays++;
    ['planned','plannedInstructed','plannedSolo','executed','executedInstructed','executedSolo','cancelled','unresolved','upcoming','extra'].forEach(k=>g[k]+=r[k]);
    g.reasons.push(...r.reasons);groups.set(key,g);
  });
  const rows=[...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));
  const totals={days:byDate.length,submittedDays:0,planned:0,plannedInstructed:0,plannedSolo:0,executed:0,executedInstructed:0,executedSolo:0,cancelled:0,unresolved:0,upcoming:0,extra:0,reasons:[]};
  rows.forEach(r=>{['submittedDays','planned','plannedInstructed','plannedSolo','executed','executedInstructed','executedSolo','cancelled','unresolved','upcoming','extra'].forEach(k=>totals[k]+=r[k]);totals.reasons.push(...r.reasons)});
  totals.executionRate=pct(Math.min(totals.planned,Math.max(0,totals.executed-totals.extra)),totals.planned);
  const reasonCounts=new Map();
  totals.reasons.forEach(label=>{reasonCounts.set(label,(reasonCounts.get(label)||0)+1)});
  return {byDate,rows,totals,reasons:[...reasonCounts].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),granularity}
}
function dashboard({trainees=[],evaluations=[],soloFlights=[],progressions={},from='',to=''}={}){
  const filteredEvals=uniqueBy(evaluations,'id').filter(e=>(!from||(e.flightDate||e.date)>=from)&&(!to||(e.flightDate||e.date)<=to));
  const filteredSolo=uniqueBy(soloFlights,'id').filter(f=>(!from||f.date>=from)&&(!to||f.date<=to));
  const grades=filteredEvals.map(e=>numeric(e.grade)).filter(v=>v!==null);
  const courseAvg=grades.length?grades.reduce((a,b)=>a+b,0)/grades.length:null;
  const people=(trainees||[]).map(p=>{
    const ev=filteredEvals.filter(x=>String(x.traineeId)===String(p.id)),solo=filteredSolo.filter(x=>String(x.traineeId)===String(p.id));
    const grades=ev.map(x=>numeric(x.grade)).filter(x=>x!==null);
    const avg=grades.length?grades.reduce((a,b)=>a+b,0)/grades.length:null;
    const progress=progressions[p.id]||{};
    const completion=numeric(p.progress);
    return {id:p.id,name:p.name||p.id,flights:ev.length+solo.length,instructed:ev.length,solo:solo.length,graded:grades.length,
      avg,current:progress.current||p.currentSyllabus||'',completion:completion==null?null:Math.min(100,Math.max(0,completion))}
  });
  people.sort((a,b)=>{if(a.avg!==null&&b.avg!==null)return b.avg-a.avg;if(a.avg!==null)return -1;if(b.avg!==null)return 1;return a.name.localeCompare(b.name)});
  let rank=0,last=null;people.forEach((p,i)=>{if(p.avg!==null){if(last===null||p.avg!==last)rank=i+1;last=p.avg;p.rank=rank}else p.rank=null});
  return {people,totals:{trainees:people.length,flights:filteredEvals.length+filteredSolo.length,solo:filteredSolo.length,
    instructed:filteredEvals.length,avg:courseAvg,graded:grades.length}}
}
const rateFormat=n=>n===null?'—':n.toFixed(1)+'%';
const gradeFormat=n=>n===null?'—':n.toFixed(1);
const fmtKey=(key,mode,lang)=>mode==='month'?key:lang==='he'&&mode!=='month'?key.split('-').reverse().join('/'):key;
function metrics(items){return '<div class="insightMetrics">'+items.map(x=>'<div class="insightMetric"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong>'+ (x[2]?'<small>'+esc(x[2])+'</small>':'')+'</div>').join('')+'</div>'}
function empty(label){return '<p class="insightEmpty">'+esc(label)+'</p>'}
function barsSvg(data,lang,mode){
  const items=data.slice(-12),W=720,H=235,left=34,right=15,top=18,bottom=49,plotW=W-left-right,plotH=H-top-bottom;
  const max=Math.max(1,...items.map(x=>Math.max(x.planned,x.executed)));
  const n=items.length,slot=plotW/Math.max(1,n),barW=Math.max(5,Math.min(24,slot*.30));
  let rects='',labels='',grid='';
  for(let k=0;k<=4;k++){
    const yy=top+plotH*(1-k/4);
    grid+='<line x1="'+left+'" y1="'+yy+'" x2="'+(W-right)+'" y2="'+yy+'" stroke="currentColor" opacity=".1"/><text x="'+(left-6)+'" y="'+(yy+4)+'" text-anchor="end" class="insightAxis">'+Math.round(max*k/4)+'</text>';
  }
  items.forEach((r,i)=>{
    const center=left+slot*(i+.5),h1=plotH*r.planned/max,h2=plotH*r.executed/max;
    rects+='<rect x="'+(center-barW-2)+'" y="'+(top+plotH-h1)+'" width="'+barW+'" height="'+h1+'" rx="3" fill="#315a83"><title>'+esc(r.key)+': '+esc(tr('planned',lang))+' '+r.planned+'</title></rect>';
    rects+='<rect x="'+(center+2)+'" y="'+(top+plotH-h2)+'" width="'+barW+'" height="'+h2+'" rx="3" fill="#188ba0"><title>'+esc(r.key)+': '+esc(tr('executed',lang))+' '+r.executed+'</title></rect>';
    if(r.cancelled){const h3=plotH*r.cancelled/max;rects+='<circle cx="'+center+'" cy="'+Math.max(10,top+plotH-Math.max(h1,h2)-9)+'" r="3.5" fill="#b55a62"><title>'+esc(tr('cancelled',lang))+': '+r.cancelled+'</title></circle>'}
    labels+='<text x="'+center+'" y="'+(H-27)+'" text-anchor="middle" class="insightAxis">'+esc(fmtKey(r.key,mode,lang).slice(mode==='day'?5:0))+'</text>';
  });
  return '<div class="insightChartScroll"><svg class="insightChartSvg" role="img" aria-label="'+esc(tr('plannedChart',lang))+'" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+grid+rects+labels+'</svg></div>'
}
function reasonsHtml(model,lang){
  const list=model.reasons;
  if(!list.length)return empty(tr('noReasons',lang));
  const max=Math.max(1,...list.map(x=>x.value));
  return '<div class="insightReasonList">'+list.map(x=>'<div class="insightReason"><div><b>'+esc(x.name)+'</b><strong>'+x.value+'</strong></div><span class="insightReasonTrack"><i style="width:'+(x.value/max*100).toFixed(2)+'%"></i></span></div>').join('')+'</div>'
}
function summaryTable(model,lang){
 const h=['period','planned','executed','cancelled','unresolved','upcoming','executionRate'];
 const cell=(v,k)=>k==='executionRate'?rateFormat(v):v;
 const header='<thead><tr>'+h.map(k=>'<th scope="col">'+esc(tr(k,lang))+'</th>').join('')+'</tr></thead>';
 const rows=model.rows.map(r=>{
   const rate=r.planned?pct(Math.min(r.planned,Math.max(0,r.executed-r.extra)),r.planned):null;
   return '<tr><th scope="row">'+esc(fmtKey(r.key,model.granularity,lang))+'</th>'+h.slice(1).map(k=>'<td>'+esc(cell(k==='executionRate'?rate:r[k],k))+'</td>').join('')+'</tr>'
 }).join('');
 const t=model.totals;
 const foot='<tfoot><tr><th>'+esc(tr('totals',lang))+'</th>'+h.slice(1).map(k=>'<td>'+esc(cell(t[k],k))+'</td>').join('')+'</tr></tfoot>';
 return '<div class="insightTableScroll"><table class="insightTable">'+header+'<tbody>'+rows+'</tbody>'+foot+'</table></div>'
}
function plannedHtml(model,lang='en'){
  const t=model.totals;
  const cards=metrics([
    [tr('planned',lang),t.planned,t.plannedInstructed+' '+tr('instructed',lang)+' · '+t.plannedSolo+' '+tr('solo',lang)],
    [tr('executed',lang),t.executed,t.executedInstructed+' '+tr('instructed',lang)+' · '+t.executedSolo+' '+tr('solo',lang)],
    [tr('executionRate',lang),rateFormat(t.executionRate),tr('unplannedNote',lang)],
    [tr('cancelled',lang),t.cancelled],
    [tr('unresolved',lang),t.unresolved],
    [tr('upcoming',lang),t.upcoming],
    [tr('extra',lang),t.extra]
  ]);
  return '<section class="insightSection"><p class="insightSource">'+esc(tr('planNote',lang))+'</p>'+cards+
   '<div class="insightCharts"><section class="card insightPanel insightPanelWide"><h3>'+esc(tr('plannedChart',lang))+'</h3>'+
   (model.rows.length?barsSvg(model.rows,lang,model.granularity):empty(tr('noData',lang)))+
   '<div class="insightLegend"><span><i class="legPlan"></i>'+esc(tr('planned',lang))+'</span><span><i class="legActual"></i>'+esc(tr('executed',lang))+'</span><span><i class="legCancel"></i>'+esc(tr('cancelled',lang))+'</span></div></section>'+
   '<section class="card insightPanel"><h3>'+esc(tr('cancelChart',lang))+'</h3>'+reasonsHtml(model,lang)+'</section></div>'+
   '<section class="card insightPanel insightTablePanel"><h3>'+esc(tr('dailyBreakdown',lang))+'</h3><p class="insightSource">'+esc(tr('gapNote',lang))+'</p>'+
    (model.rows.length?summaryTable(model,lang):empty(tr('noData',lang)))+'</section></section>'
}
function dashboardHtml(model,lang='en',pulseCards=null){
 const t=model.totals;
 const cards=metrics([
  [tr('activeTrainees',lang),t.trainees],
  [tr('flightCount',lang),t.flights,t.instructed+' '+tr('instructorFlights',lang)],
  [tr('soloFlights',lang),t.solo],
  [tr('avgGrade',lang),gradeFormat(t.avg),t.graded+' '+tr('gradedFlights',lang)]
 ]);
 const summaryCards=pulseCards||cards;
 const head=['rank','trainee','flightCount','soloFlights','avgGrade','currentSyllabus','completion'];
 const thead='<thead><tr>'+head.map(x=>'<th scope="col">'+esc(tr(x,lang))+'</th>').join('')+'</tr></thead>';
 const body=model.people.map(p=>'<tr><td>'+(p.rank===null?'—':p.rank)+'</td><th scope="row">'+esc(p.name)+'</th><td>'+p.flights+'</td><td>'+p.solo+'</td><td>'+gradeFormat(p.avg)+'</td><td>'+esc(p.current||'—')+'</td><td>'+
 (p.completion===null?'—':'<div class="insightProgress"><span style="width:'+p.completion+'%"></span></div><small>'+p.completion.toFixed(0)+'%</small>')+'</td></tr>').join('');
 return '<section class="insightSection"><p class="insightSource">'+esc(tr('quality',lang))+'</p>'+summaryCards+
 '<section class="card insightPanel insightTablePanel"><h3>'+esc(tr('courseSummary',lang))+'</h3>'+
 (model.people.length?'<div class="insightTableScroll"><table class="insightTable">'+thead+'<tbody>'+body+'</tbody></table></div>':empty(tr('noTrainees',lang)))+
 '</section></section>'
}
function csvCells(rows){return '\ufeff'+rows.map(r=>r.map(value=>{
  let v=String(value??'');
  // CSV spreadsheet viewers must not execute untrusted user-supplied fields.
  if(/^[\s]*[=+\-@\t\r]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"'
}).join(',')).join('\r\n')}
function operationsCsv(model){
 const headers=['Period','Planned','Instructed Planned','Solo Planned','Executed','Instructed Executed','Solo Executed','Cancelled (reason recorded)','Unclassified gap','Upcoming','Unplanned executions','Execution %'];
 const row=r=>[r.key,r.planned,r.plannedInstructed,r.plannedSolo,r.executed,r.executedInstructed,r.executedSolo,r.cancelled,r.unresolved,r.upcoming,r.extra,r.planned?pct(Math.min(r.planned,Math.max(0,r.executed-r.extra)),r.planned).toFixed(1):''];
 return csvCells([headers,...model.rows.map(row)])
}
function dashboardCsv(model){
 return csvCells([['Rank','Trainee','Total flights','Instructed','Solo','Graded','Average grade','Current syllabus','Course completion %'],
 ...model.people.map(p=>[p.rank??'',p.name,p.flights,p.instructed,p.solo,p.graded,p.avg==null?'':p.avg.toFixed(1),p.current,p.completion??''])])
}
const api={operations,dashboard,plannedHtml,dashboardHtml,operationsCsv,dashboardCsv,csvCells};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.FLYMPUS_REPORTS=api;
})(typeof window!=='undefined'?window:globalThis);
