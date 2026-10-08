/* FLYMPUS course-scoped fleet/serviceability + daily flight board data logic.
   Pure helpers; no sample aircraft. Persistence is supplied by the host app. */
(function(root,factory){
  const api=factory();
  if(root)root.FLYMPUS_FLEET_MODEL=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:undefined,function(){
 'use strict';
 const AVAILABLE='SERVICEABLE',UNAVAILABLE='UNSERVICEABLE';
 const clean=(v,limit=200)=>String(v??'').trim().slice(0,limit);
 const dateValid=v=>{const s=clean(v,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return false;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3]};
 const clockValid=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(v,5));
 const active=(rows,platform)=> (Array.isArray(rows)?rows:[]).filter(x=>!x.archivedAt&&String(x.platformId)===String(platform)).sort((a,b)=>String(a.tail||'').localeCompare(String(b.tail||''),undefined,{numeric:true,sensitivity:'base'}));
 const count=(rows,platform)=>{const items=active(rows,platform);return {total:items.length,serviceable:items.filter(x=>x.status===AVAILABLE).length,unserviceable:items.filter(x=>x.status===UNAVAILABLE).length,items}};
 const validAircraft=(rows,input,platform)=>{
  const id=clean(input?.id,100),tail=clean(input?.tail,48).toUpperCase(),status=clean(input?.status,24),since=clean(input?.since,10),reason=clean(input?.reason,500);
  if(!tail)throw Error('Aircraft identifier is required.');
  if(![AVAILABLE,UNAVAILABLE].includes(status))throw Error('Select a valid serviceability status.');
  if(status===UNAVAILABLE&&(!reason||!dateValid(since)))throw Error('For an unserviceable aircraft enter a reason and the date it became unavailable.');
  if(since&&!dateValid(since))throw Error('Enter a valid status date.');
  const duplicates=active(rows,platform).some(r=>String(r.tail).toUpperCase()===tail&&r.id!==id);
  if(duplicates)throw Error('This aircraft already exists in this course and platform.');
  return {id,tail,status,reason:status===UNAVAILABLE?reason:'',since:since||'',platformId:String(platform)};
 };
 function upsertAircraft(rows,input,platform,now=new Date().toISOString(),idFactory=()=>String(Date.now()),actor=''){
  const list=Array.isArray(rows)?rows:[],data=validAircraft(list,input,platform),previous=list.find(x=>x.id===data.id&&!x.archivedAt);
  if(data.id&&(!previous||String(previous.platformId)!==String(platform)))throw Error('Aircraft record not found in this platform.');
  const id=previous?.id||idFactory();
  if(list.some(x=>x.id===id&&!previous))throw Error('Aircraft ID conflict.');
  const changed=!previous||previous.status!==data.status||previous.since!==data.since||previous.reason!==data.reason;
  const next={...(previous||{}),...data,id,createdAt:previous?.createdAt||now,updatedAt:now,
   history:changed?[...(previous?.history||[]),{status:data.status,reason:data.reason,since:data.since,recordedAt:now,...(clean(actor,120)?{recordedBy:clean(actor,120)}:{})}]:[...(previous?.history||[])]};
  return previous?list.map(x=>x.id===id?next:x):[...list,next];
 }
 function archiveAircraft(rows,id,platform,now=new Date().toISOString()){
  const list=Array.isArray(rows)?rows:[],found=list.find(x=>x.id===id&&x.platformId===platform&&!x.archivedAt);
  if(!found)throw Error('Aircraft not found.');
  return list.map(x=>x===found?{...found,archivedAt:now,updatedAt:now}:x);
 }
 /* Planning uses wall-clock minutes on an absolute UTC day axis, which also
    handles briefings before midnight or flights crossing into the next day. */
 const TIMING_DEFAULTS=Object.freeze({
  INSTRUCTED:Object.freeze({briefingMinutes:20,debriefMinutes:15}),
  SOLO:Object.freeze({briefingMinutes:10,debriefMinutes:10})
 });
 const configuredTimings=(settings,mode)=>{
  const base=TIMING_DEFAULTS[mode]||TIMING_DEFAULTS.INSTRUCTED,custom=settings?.[mode]||{};
  const value=(key)=>Number.isInteger(Number(custom[key]))&&String(custom[key]??'')!==''&&Number(custom[key])>=0&&Number(custom[key])<=180?Number(custom[key]):base[key];
  return {briefingMinutes:value('briefingMinutes'),debriefMinutes:value('debriefMinutes')};
 };
 const scheduleMinute=(date,time)=>Date.parse(date+'T00:00:00Z')/60000+Number(time.slice(0,2))*60+Number(time.slice(3,5));
 const positiveInteger=(value,key,max,min=0)=>{
  const raw=String(value??'').trim();
  if(!/^\d+$/.test(raw)||Number(raw)<min||Number(raw)>max)throw Error(key+' must be between '+min+' and '+max+' minutes.');
  return Number(raw);
 };
 function flightTimeline(record,settings){
  const mode=String(record?.mode||'INSTRUCTED').toUpperCase(),defaults=configuredTimings(settings,mode);
  if(!dateValid(record?.date)||!clockValid(record?.time))return null;
  const duration=Number(record?.estimatedMinutes);
  if(!Number.isInteger(duration)||duration<1||duration>720)return null;
  const brief=record?.briefingMinutes??defaults.briefingMinutes;
  const debrief=record?.debriefMinutes??defaults.debriefMinutes;
  if(!/^\d+$/.test(String(brief))||!Number.isInteger(Number(brief))||Number(brief)>180
   ||!/^\d+$/.test(String(debrief))||!Number.isInteger(Number(debrief))||Number(debrief)>180)return null;
  const takeoff=scheduleMinute(record.date,record.time),landing=takeoff+duration;
  const briefingStart=takeoff-Number(brief),debriefEnd=landing+Number(debrief);
  const fmt=n=>{const base=Math.floor(n/1440),start=Math.floor(scheduleMinute(record.date,'00:00')/1440),dayOffset=base-start;
   const clock=((n%1440)+1440)%1440;
   return String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0')+(dayOffset?' ('+(dayOffset>0?'+':'')+dayOffset+'d)':'');
  };
  return {briefingStart,takeoff,landing,debriefEnd,briefingMinutes:Number(brief),estimatedMinutes:duration,debriefMinutes:Number(debrief),
    clock:{briefing:fmt(briefingStart),takeoff:fmt(takeoff),landing:fmt(landing),debrief:fmt(debriefEnd)}};
 }
 const overlapping=(a,b,c,d)=>a<d&&c<b;
 function checkedSortie(input,rows,platform,date,allowedIds={trainees:[],instructors:[]},existing=null,settings=null){
  const time=clean(input?.time,5),aircraftId=clean(input?.aircraftId,100),traineeId=clean(input?.traineeId,100),
   instructorId=clean(input?.instructorId,100),syllabus=clean(input?.syllabus,200),mode=clean(input?.mode,20);
  if(!dateValid(date)||!clockValid(time))throw Error('Choose a valid flight date and time.');
  if(!['SOLO','INSTRUCTED'].includes(mode))throw Error('Choose Solo or Instructed flight.');
  if(!traineeId||!allowedIds.trainees.includes(traineeId))throw Error('Choose a trainee assigned to this course.');
  if(mode==='INSTRUCTED'&&(!instructorId||!allowedIds.instructors.includes(instructorId)))throw Error('Choose an instructor assigned to this course.');
  if(mode==='INSTRUCTED'&&instructorId===traineeId)throw Error('A person cannot be both trainee and instructor on the same flight.');
  if(!syllabus)throw Error('Select the flight syllabus.');
  const defaults=configuredTimings(settings,mode);
  const estimatedMinutes=positiveInteger(input?.estimatedMinutes,'Planned flight duration',720,1);
  const briefingMinutes=positiveInteger(input?.briefingMinutes??defaults.briefingMinutes,'Briefing time',180);
  const debriefMinutes=positiveInteger(input?.debriefMinutes??defaults.debriefMinutes,'Debriefing time',180);
  const aircraft=active(rows,platform).find(x=>x.id===aircraftId);
  if(!aircraft||aircraft.status!==AVAILABLE)throw Error('The selected aircraft is not serviceable. Choose a serviceable aircraft.');
  return {id:existing?.id||clean(input?.id,100),date,platformId:String(platform),time,aircraftId,tail:aircraft.tail,traineeId,
   traineeName:clean(input?.traineeName,200),instructorId:mode==='SOLO'?'':instructorId,
   instructorName:mode==='SOLO'?'':clean(input?.instructorName,200),syllabus,mode,estimatedMinutes,briefingMinutes,debriefMinutes,note:clean(input?.note,500)};
 }
 function upsertSortie(rows,input,aircraft,platform,date,allowed,now=new Date().toISOString(),idFactory=()=>String(Date.now()),settings=null){
  const list=Array.isArray(rows)?rows:[],old=input?.id?list.find(x=>x.id===input.id&&x.platformId===String(platform)&&x.date===date):null;
  if(input?.id&&!old)throw Error('Scheduled flight not found.');
  const valid=checkedSortie(input,aircraft,platform,date,allowed,old,settings),id=old?.id||idFactory();
  const incoming=flightTimeline(valid,settings);
  const people=new Set([valid.traineeId,...(valid.instructorId?[valid.instructorId]:[])]);
  for(const previous of list){
   if(previous.id===id)continue;
   const onSameAircraft=String(previous.aircraftId||'')===valid.aircraftId&&String(previous.platformId||'')===String(platform);
   const previousPeople=[String(previous.traineeId||''),String(previous.instructorId||'')].filter(Boolean);
   const common=previousPeople.find(person=>people.has(person));
   if(!onSameAircraft&&!common)continue;
   if(!dateValid(previous.date)||!clockValid(previous.time))continue;
   const delta=Math.abs(Date.parse(previous.date+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000;
   if(delta>2)continue; // Maximum flight + briefing + debriefing is less than 1 day.
   const prior=flightTimeline(previous,settings);
   if(!prior)throw Error('Existing flight on '+previous.date+' at '+previous.time+' has no valid duration. Update it before scheduling the same instructor, trainee or aircraft.');
   if(onSameAircraft&&overlapping(incoming.takeoff,incoming.landing,prior.takeoff,prior.landing))
    throw Error('Aircraft '+valid.tail+' is already booked '+prior.clock.takeoff+'–'+prior.clock.landing+'. Choose a non-overlapping flight time.');
   if(common&&overlapping(incoming.briefingStart,incoming.debriefEnd,prior.briefingStart,prior.debriefEnd)){
    const who=common===valid.traineeId?'Trainee '+(valid.traineeName||common):'Instructor '+(valid.instructorName||common);
    throw Error(who+' is already occupied by briefing, flight or debriefing for the '+previous.time+' flight. Available after '+prior.clock.debrief+'.');
   }
  }
  const record={...valid,id,createdAt:old?.createdAt||now,updatedAt:now};
  return old?list.map(x=>x===old?record:x):[...list,record];
 }
 function flightIssues(flight,aircraft,platform){
  const match=active(aircraft,platform).find(x=>x.id===flight.aircraftId);
  return !match?'Aircraft removed from the active fleet':match.status!==AVAILABLE?'Aircraft unserviceable: '+clean(match.reason,200):'';
 }
 return Object.freeze({AVAILABLE,UNAVAILABLE,dateValid,clockValid,active,count,validAircraft,upsertAircraft,archiveAircraft,checkedSortie,upsertSortie,flightIssues,flightTimeline,TIMING_DEFAULTS,configuredTimings});
});