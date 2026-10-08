/* Course-scoped trainee Evaluation History filter logic.
   Presentation stays in the app; this module has no storage or DOM side-effects. */
(function(root,factory){
  const api=factory();
  if(root)root.FLYMPUS_TRAINEE_EVAL_HISTORY=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:undefined,function(){
  'use strict';
  function validDate(y,m,d){
    const x=new Date(Date.UTC(y,m-1,d));
    return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;
  }
  function isoDate(raw){
    const s=String(raw??'').trim();let match=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    let y,m,d;
    if(match){y=+match[1];m=+match[2];d=+match[3]}
    else{
      match=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if(!match)return '';
      d=+match[1];m=+match[2];y=+match[3];
    }
    return validDate(y,m,d)?String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):'';
  }
  function instructorKey(row){
    const id=String(row?.instructorId||'').trim();
    return id||('name:'+String(row?.instructorName||'Instructor').trim());
  }
  function numeric(value){
    if(value==null||String(value).trim()==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }
  function filtered(rows,filters={}){
    const from=isoDate(filters.from),to=isoDate(filters.to),min=numeric(filters.minGrade),max=numeric(filters.maxGrade);
    const instructors=new Set(Array.isArray(filters.instructors)?filters.instructors.map(String):[]);
    const syllabi=new Set(Array.isArray(filters.syllabi)?filters.syllabi.map(String):[]);
    if((from&&to&&from>to)||(min!==null&&max!==null&&min>max))return [];
    return (rows||[]).filter(row=>{
      const date=isoDate(row?.date||row?.flightDate||'');
      if((from||to)&&(!date||(from&&date<from)||(to&&date>to)))return false;
      if(instructors.size&&!instructors.has(instructorKey(row)))return false;
      if(syllabi.size&&!syllabi.has(String(row?.syllabus||'')))return false;
      const grade=numeric(row?.grade);
      if((min!==null||max!==null)&&(grade===null||(min!==null&&grade<min)||(max!==null&&grade>max)))return false;
      return true;
    });
  }
  function choices(rows){
    const instructors=new Map(),syllabi=new Set();
    for(const row of rows||[]){
      const name=String(row?.instructorName||'Instructor');
      instructors.set(instructorKey(row),name);
      if(String(row?.syllabus||'').trim())syllabi.add(String(row.syllabus));
    }
    const collate=(a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'});
    return {
      instructors:[...instructors].map(([value,label])=>({value,label})).sort(collate),
      syllabi:[...syllabi].map(value=>({value,label:value})).sort(collate)
    };
  }
  return Object.freeze({isoDate,instructorKey,filtered,choices});
});