/* FLYMPUS Home: course-scoped operational counts and actionable trainee attention.
   Inputs are saved records only. No review mocks, drafts or generated attention rows. */
(function(root,factory){
 const api=factory();
 if(root)root.FLYMPUS_HOME_OPERATIONS=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:undefined,function(){
 'use strict';
 const arr=x=>Array.isArray(x)?x:[];
 const iso=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
 const day=x=>{const d=iso(x);if(!d)return null;const v=new Date(d+'T12:00:00Z');return Number.isFinite(v.getTime())&&v.toISOString().slice(0,10)===d?v:null};
 const stamp=x=>day(x)?.getTime()??null;
 const key=x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
 const number=x=>(x==null||x==='')?null:(Number.isFinite(Number(x))?Number(x):null);
 const avg=xs=>{const v=xs.map(number).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
 function weekBounds(today){
  const d=day(today);if(!d)return null;
  const sun=new Date(d.getTime());sun.setUTCDate(sun.getUTCDate()-sun.getUTCDay());
  const sat=new Date(sun.getTime());sat.setUTCDate(sat.getUTCDate()+6);
  return {from:sun.toISOString().slice(0,10),to:sat.toISOString().slice(0,10)};
 }
 function weeklyFlights({evaluations=[],soloFlights=[],today}={}){
  const w=weekBounds(today);if(!w)return {instructed:0,solo:0,total:0,from:'',to:''};
  const within=row=>{const d=iso(row.flightDate||row.date);return d&&d>=w.from&&d<=w.to};
  const instructed=arr(evaluations).filter(within).length,solo=arr(soloFlights).filter(within).length;
  return {...w,instructed,solo,total:instructed+solo};
 }
 function attention({trainees=[],evaluations=[],soloFlights=[],exams=[],progressions={},today}={}){
  const active=arr(trainees).filter(t=>String(t.status||'').toLowerCase()==='active'),ids=new Set(active.map(t=>String(t.id)));
  const evals=arr(evaluations).filter(e=>ids.has(String(e.traineeId))&&day(e.flightDate||e.date));
  const solo=arr(soloFlights).filter(s=>ids.has(String(s.traineeId))&&day(s.date));
  const todayStamp=stamp(today);
  const peersFor=(row,extract)=>evals.filter(e=>key(e.syllabus)===key(row.syllabus)&&String(e.traineeId)!==String(row.traineeId)).map(extract).filter(x=>number(x)!=null);
  const uniqueCount=(row,predicate)=>new Set(evals.filter(e=>String(e.traineeId)!==String(row.traineeId)&&predicate(e)).map(e=>String(e.traineeId))).size;
  return active.map(t=>{
   const id=String(t.id),mine=evals.filter(e=>String(e.traineeId)===id).sort((a,b)=>String(b.flightDate||b.date).localeCompare(String(a.flightDate||a.date)));
   const flights=[...mine.map(e=>e.flightDate||e.date),...solo.filter(x=>String(x.traineeId)===id).map(x=>x.date)].sort().reverse();
   const lastFlight=flights[0]||null,issues=[];
   // Only the most recent saved attempt per ground exam counts. Passing a retake clears a failure.
   const attempts=arr(exams).filter(e=>String(e.traineeId)===id&&e.exam).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
   const examined=new Set();
   attempts.forEach(e=>{
    const n=key(e.exam);if(examined.has(n))return;examined.add(n);
    const grade=number(e.grade),pass=number(e.pass);
    if(grade!=null&&pass!=null&&grade<pass)issues.push({code:'exam',name:String(e.exam),grade,pass});
   });
   // The app supplies its resolved CURRENT syllabus. Do not flag old, already-advanced series.
   const p=progressions?.[id],current=key(p?.current),minimum=number(p?.minimum);
   if(current&&minimum!=null&&minimum>0&&p?.current!=='Program complete'){
    const matching=mine.filter(e=>key(e.syllabus)===current);
    const latest=matching[0];
    const decision=String(latest?.progressionDecision||'').toUpperCase();
    if(matching.length>=minimum&&decision!=='ADVANCE'&&(matching.length>minimum||decision==='CONTINUE')){
     issues.push({code:'extra-flights',name:String(p.current),completed:matching.length,minimum});
    }
   }
   // Compare to real peer evaluations in the same syllabus, not different training levels.
   // A recorded latest flight grade below 90% of the peer mean is actionable.
   const latestGraded=mine.find(e=>number(e.grade)!=null&&number(e.grade)>0);
   if(latestGraded){
    const peers=peersFor(latestGraded,e=>e.grade),baseline=avg(peers);
    if(baseline!=null&&baseline>0&&number(latestGraded.grade)<=baseline*.9&&
       uniqueCount(latestGraded,e=>key(e.syllabus)===key(latestGraded.syllabus)&&number(e.grade)>0)>0){
      issues.push({code:'flight-grade',name:String(latestGraded.syllabus),grade:number(latestGraded.grade),average:baseline});
    }
   }
   // For each graded category, use trainee and peer mean within the same syllabus.
   const ownCategories=new Map();
   mine.forEach(e=>Object.entries(e.scores||{}).forEach(([criterion,score])=>{
    const n=number(score);if(n==null||n<=0)return;
    const k=key(e.syllabus)+'|'+key(criterion),snap=arr(e.criteriaSnapshot).find(c=>String(c.id)===String(criterion));
    const slot=ownCategories.get(k)||{name:String(snap?.name||criterion),syllabus:String(e.syllabus),criterion,values:[]};
    slot.values.push(n);ownCategories.set(k,slot);
   }));
   ownCategories.forEach(slot=>{
    const other=evals.filter(e=>String(e.traineeId)!==id&&key(e.syllabus)===key(slot.syllabus)&&number(e.scores?.[slot.criterion])>0);
    if(!other.length)return;
    const theirAvg=avg(other.map(e=>e.scores[slot.criterion])),mineAvg=avg(slot.values);
    if(theirAvg!=null&&theirAvg>0&&mineAvg!=null&&mineAvg<=theirAvg*.9){
      issues.push({code:'criterion',name:slot.name,syllabus:slot.syllabus,grade:mineAvg,average:theirAvg});
    }
   });
   // Strictly more than seven elapsed calendar days. No inferred flight from plans or drafts.
   if(lastFlight&&todayStamp!=null){
    const elapsed=Math.floor((todayStamp-stamp(lastFlight))/86400000);
    if(elapsed>7)issues.push({code:'no-flight',days:elapsed});
   }
   return {...t,lastFlight,issues};
  }).filter(t=>t.issues.length).sort((a,b)=>b.issues.length-a.issues.length||String(a.name).localeCompare(String(b.name)));
 }
 return Object.freeze({weekBounds,weeklyFlights,attention});
});