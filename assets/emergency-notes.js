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
  return Object.freeze({MAX_LENGTH,normalize,collect,positiveCount});
});