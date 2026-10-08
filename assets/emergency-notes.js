/* FLYMPUS · evaluation emergency instructor notes.
   Values belong to submitted evaluations; no independent note history that can drift. */
(function(root,factory){
  const api=factory();
  if(root)root.FLYMPUS_EMERGENCY_NOTES=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:undefined,function(){
  'use strict';
  const MAX_LENGTH=1500;
  const positiveCount=value=>{
    const n=Number(value);
    return Number.isFinite(n)&&n>0?Math.min(99,Math.floor(n)):0;
  };
  function normalize(notes,counts,allowedIds){
    const out={};
    if(!notes||typeof notes!=='object'||Array.isArray(notes))return out;
    for(const id of allowedIds||[]){
      if(!Object.prototype.hasOwnProperty.call(notes,id)||!positiveCount(counts?.[id]))continue;
      const value=notes[id];
      if(typeof value!=='string')continue;
      const text=value.trim().slice(0,MAX_LENGTH).trim();
      if(text)Object.defineProperty(out,id,{value:text,enumerable:true,writable:true,configurable:true});
    }
    return out;
  }
  function collect(evaluations,traineeId,emergencyId){
    const results=[];
    for(const ev of evaluations||[]){
      if(String(ev?.traineeId)!==String(traineeId)||!positiveCount(ev?.emergencyCounts?.[emergencyId]))continue;
      const note=ev?.emergencyNotes?.[emergencyId];
      if(typeof note!=='string'||!note.trim())continue;
      results.push({
        evaluationId:String(ev.id||''),
        date:String(ev.flightDate||ev.date||''),
        instructorName:String(ev.instructorName||'Instructor'),
        instructorId:String(ev.instructorId||''),
        note:note.trim().slice(0,MAX_LENGTH),
        occurrences:positiveCount(ev.emergencyCounts[emergencyId]),
        revision:Number(ev.revision)||1
      });
    }
    return results.sort((a,b)=>b.date.localeCompare(a.date)||b.evaluationId.localeCompare(a.evaluationId));
  }
  // Only submitted, course-scoped evaluations are supplied by the caller.
  // Plans and synthetic review flights must never establish a performance date.
  function canonicalDate(value){
    const raw=String(value??'').trim();
    let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/),year,month,day;
    if(match){year=Number(match[1]);month=Number(match[2]);day=Number(match[3])}
    else{
      match=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if(!match)return '';
      day=Number(match[1]);month=Number(match[2]);year=Number(match[3]);
    }
    const date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return '';
    return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  }
  function latestPerformedDates(evaluations,traineeId,emergencyDefs,legacyNames){
    const latest=Object.create(null),knownIds=new Set(),byName=new Map();
    for(const def of emergencyDefs||[]){
      const id=String(def?.id??'').trim(),name=String(def?.name??'').trim().toLocaleLowerCase('en');
      if(!id)continue;
      knownIds.add(id);
      if(name&&!byName.has(name))byName.set(name,id);
    }
    for(const ev of evaluations||[]){
      if(String(ev?.traineeId)!==String(traineeId)||ev?.source==='mock')continue;
      const date=canonicalDate(ev?.flightDate||ev?.date);
      if(!date)continue;
      const hasKeyedCounts=ev.emergencyCounts&&typeof ev.emergencyCounts==='object'&&!Array.isArray(ev.emergencyCounts);
      if(hasKeyedCounts){
        for(const [id,n] of Object.entries(ev.emergencyCounts)){
          if(knownIds.has(id)&&positiveCount(n)&&(latest[id]===undefined||date>latest[id]))latest[id]=date;
        }
      }else if(Array.isArray(ev.emergencies)){
        ev.emergencies.forEach((count,index)=>{
          if(!positiveCount(count))return;
          const id=byName.get(String(legacyNames?.[index]||'').trim().toLocaleLowerCase('en'));
          if(id&&(latest[id]===undefined||date>latest[id]))latest[id]=date;
        });
      }
    }
    return latest;
  }
  return Object.freeze({MAX_LENGTH,normalize,collect,positiveCount,latestPerformedDates});
});