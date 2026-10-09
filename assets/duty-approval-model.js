/* Official operation records and Duty Trainee working copies are separate. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./fleet-model.js'):root.FLYMPUS_FLEET_MODEL);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FLYMPUS_DUTY_APPROVAL_MODEL=api;
})(typeof window!=='undefined'?window:globalThis,function(Fleet){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const fail=message=>{throw new Error(message)};
 const integer=(value,max=10000)=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=max;
 const dateValid=value=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(String(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}};
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 function emptyDay(date){if(!dateValid(date))fail('Invalid flight date');return {date,revision:0,plan:null,report:null,evaluationCount:0};}
 function canReview(profile,member){return profile?.status==='active'&&profile.role!=='duty_trainee'&&['INSTRUCTOR','COURSE_MANAGER'].includes(member?.role);}
 function planPayload(value,context,fleet,date){
  if(!dateValid(date)||!Array.isArray(value?.flights)||value.flights.length>100)fail('Invalid daily plan');
  let flights=[];const ids=new Set();
  for(const input of value.flights){
   if(!input?.id||ids.has(input.id))fail('Duplicate or missing flight identifier');ids.add(input.id);
   if(input.date!==date)fail('Flight date does not match the requested day');
   if(!(context.syllabi||[]).includes(input.syllabus))fail('Select a syllabus from this course');
   flights=Fleet.upsertSortie(flights,{...input,id:'',traineeName:(context.trainees||[]).find(x=>x.id===input.traineeId)?.name||'',instructorName:(context.instructors||[]).find(x=>x.id===input.instructorId)?.name||''},fleet.aircraft||[],context.courseMeta.platformId,date,
    {trainees:(context.trainees||[]).map(x=>x.id),instructors:(context.instructors||[]).map(x=>x.id)},
    input.updatedAt||new Date().toISOString(),()=>input.id,fleet.timingDefaults||{}).map(row=>row.id===input.id?{...row,createdAt:String(input.createdAt||row.createdAt),updatedAt:String(input.updatedAt||row.updatedAt)}:row);
  }
  return {flights};
 }
 function reportPayload(value,context,day,date){
  if(!dateValid(date)||!integer(value?.plannedInstructed,100)||!integer(value?.plannedSolo,500)||!Array.isArray(value?.solos)||value.solos.length>500)fail('Invalid daily report');
  const pi=Number(value.plannedInstructed),ps=Number(value.plannedSolo),executed=Number(day.evaluationCount||0);
  if(pi+ps<=0)fail('Set at least one planned flight');
  if(day.plan){const counts=Fleet.plannedFlightCounts(day.plan.flights,date,context.courseMeta.platformId);if(counts.instructed!==pi||counts.solo!==ps)fail('The report must match the approved daily plan');}
  if(Number(value.instructedExecuted)!==executed)fail('Submitted evaluations changed. Refresh the report before sending it');
  const ids=new Set(),trainees=new Map((context.trainees||[]).map(x=>[x.id,x]));
  const solos=value.solos.map(input=>{
   if(!input?.id||ids.has(input.id)||input.date!==date||!trainees.has(input.traineeId)||!(context.soloSyllabi||[]).includes(input.syllabus))fail('Invalid solo flight');
   ids.add(input.id);for(const key of ['takeoffs','landings','minutes'])if(!integer(input[key],key==='minutes'?1440:1000))fail('Invalid solo execution values');
   return {id:String(input.id),batchId:String(input.batchId||input.id),date,traineeId:String(input.traineeId),traineeName:String(trainees.get(input.traineeId).name||''),syllabus:String(input.syllabus),takeoffs:Number(input.takeoffs),landings:Number(input.landings),minutes:Number(input.minutes),createdAt:String(input.createdAt||''),updatedAt:String(input.updatedAt||'')};
  });
  if(solos.length>ps)fail('Recorded solo flights exceed the approved plan');
  const gaps={Instructed:Math.max(0,pi-executed),Solo:Math.max(0,ps-solos.length)},totals={Instructed:0,Solo:0},catalog=new Map((context.cancellationReasons||[]).map(x=>[x.id,x.name]));
  if(!Array.isArray(value.cancellations)||value.cancellations.length>600)fail('Invalid cancellation list');
  const cancellations=value.cancellations.map((input,index)=>{
   if(!Object.hasOwn(totals,input.type)||!integer(input.quantity,600)||Number(input.quantity)<1||!catalog.has(input.reasonId))fail('Select a cancellation reason for every non-executed flight');
   totals[input.type]+=Number(input.quantity);
   return {key:String(input.key||input.type+'_'+index),type:input.type,reasonId:input.reasonId,reasonLabel:catalog.get(input.reasonId),quantity:Number(input.quantity)};
  });
  for(const type of Object.keys(gaps))if(totals[type]!==gaps[type])fail('Cancellation counts must match the actual shortfall');
  return {date,plannedInstructed:pi,plannedSolo:ps,instructedExecuted:executed,soloExecuted:solos.length,cancellations,reason:cancellations.map(x=>x.reasonLabel).join(' · '),solos};
 }
 function payload(kind,value,context,fleet,day,date){
  if(kind==='PLAN')return planPayload(value,context,fleet,date);
  if(kind==='REPORT')return reportPayload(value,context,day,date);
  fail('Unsupported operation type');
 }
 function apply(day,kind,value,actor,requestId=''){
  if(!['PLAN','REPORT'].includes(kind)||!actor)fail('Invalid official update');
  const result={...clone(day),revision:Number(day.revision||0)+1,sourceRequestId:requestId,updatedBy:actor};
  result[kind==='PLAN'?'plan':'report']=clone(value);return result;
 }
 function assertReview(request,day,actor){
  if(request.status!=='PENDING')fail('This request has already been reviewed');
  if(request.submittedBy===actor)fail('You cannot approve your own request');
  if(request.baseRevision!==Number(day.revision||0))fail('Approved data changed. Return this request for revision');
 }
 function officialRows(local,days,kind){
  const accepted=days.filter(d=>d[kind]);const dates=new Set(accepted.map(d=>d.date));
  return local.filter(row=>!dates.has(row.date)).concat(accepted.flatMap(d=>kind==='plan'?d.plan.flights:kind==='solos'?d.solos:[{...d.report,savedAt:d.updatedAt||'',approvalRequestId:d.sourceRequestId||'',approvedBy:d.updatedBy||''}]));
 }
 function mergeFlights(local,days){return officialRows(local,days,'plan');}
 function mergeReports(local,days){return officialRows(local,days,'report');}
 function mergeSolos(local,days){const dates=new Set(days.filter(d=>d.report).map(d=>d.date));return local.filter(x=>!dates.has(x.date)).concat(days.flatMap(d=>d.report?.solos||[]));}
 function soloEvents(solos){return solos.flatMap(f=>[['TAKEOFF','takeoffs'],['LANDING','landings'],['TRAINING_HOUR','minutes']].filter(([,key])=>Number(f[key])>0).map(([type,key])=>({id:'ops_'+f.id+'_'+type,traineeId:f.traineeId,date:f.date,type,quantity:key==='minutes'?Math.round(Number(f.minutes)/60*100)/100:Number(f[key]),source:'Solo flight',sourceId:f.id,note:f.syllabus,createdAt:f.updatedAt||f.createdAt||''})));}
 return Object.freeze({clone,same,dateValid,emptyDay,canReview,payload,apply,assertReview,mergeFlights,mergeReports,mergeSolos,soloEvents});
});
