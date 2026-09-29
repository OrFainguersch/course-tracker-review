(function(){
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const catalogs={};
  const register=cat=>{if(cat?.profession?.id)catalogs[cat.profession.id]=cat};
  register(window.EP_CATALOG);register(window.IP_CATALOG);register(window.TECHNICIAN_CATALOG);
  const allPlatforms=()=>Object.values(window.FLYMPUS_PLATFORMS||{});
  const platform=(id)=>allPlatforms().find(x=>x.id===id)||Object.values(catalogs).flatMap(x=>x.platforms||[]).find(x=>x.id===id)||null;
  const catalog=id=>catalogs[id]||null;
  const phasesFor=professionId=>(catalog(professionId)?.phases||[]).map(clone);
  const platformsFor=(professionId,phaseId)=>(catalog(professionId)?.platforms||[]).filter(x=>(x.phaseIds||[]).includes(phaseId)).map(clone);
  const programsFor=sel=>{
    const c=catalog(sel?.courseType);if(!c)return[];
    return (c.programs||[]).filter(p=>(!sel.phaseId||p.phaseId===sel.phaseId)&&(!sel.platformId||p.platformId===sel.platformId)&&(!sel.trainingKind||p.trainingKind===sel.trainingKind)&&(!p.countryIds?.length||!sel.country||p.countryIds.includes(sel.country))).map(clone);
  };
  const sourceText=p=>[p.source,p.sourceRevision&&"Edition "+p.sourceRevision].filter(Boolean).join(" · ");
  function mergePrograms(a,b){
    const uniq=(list,key="id")=>[...new Map(list.filter(Boolean).map(x=>[x[key]||JSON.stringify(x),x])).values()];
    return {...clone(a),id:a.id+"__"+b.id,name:a.name.replace(/Day\s*·?\s*/i,"")+" · Day + Night",dayNight:"mixed",tracks:["day","night"],source:sourceText(a)+" + "+sourceText(b),sourceRevision:null,composedFrom:[a.id,b.id],theory:uniq([...(a.theory||[]),...(b.theory||[])]),exams:uniq([...(a.exams||[]),...(b.exams||[])]),syllabi:uniq([...(a.syllabi||[]).map(x=>({...x,track:x.track||"day"})),...(b.syllabi||[]).map(x=>({...x,track:x.track||"night"}))]).map((x,i)=>({...x,order:i+1})),experienceCounters:uniq([...(a.experienceCounters||[]),...(b.experienceCounters||[])]),emergencyRequirementIds:[...new Set([...(a.emergencyRequirementIds||[]),...(b.emergencyRequirementIds||[])])],progression:[...(a.progression||[]),...(b.progression||[])]};
  }
  const findBase=sel=>{
    const list=programsFor(sel);
    if(sel.programId){const chosen=list.find(p=>p.id===sel.programId);if(chosen)return chosen}
    const exact=list.find(p=>p.dayNight===sel.dayNight);if(exact)return exact;
    if(sel.dayNight==="mixed"){
      const day=list.find(p=>p.dayNight==="day"),night=list.find(p=>p.dayNight==="night");
      if(day&&night)return mergePrograms(day,night);
      return list.find(p=>p.dayNight==="mixed")||null;
    }
    return list.find(p=>p.dayNight==="mixed")||null;
  };
  const normalizeEp=program=>{
    if(!program)return null;
    program.professionId="EP";
    program.exams=program.exams||((program.theory||[]).filter(x=>/exam/i.test((x.type||"")+" "+(x.name||""))).map((x,i)=>({id:program.id+"_exam_"+i,name:x.name,pass:/regulation|limitation/i.test(x.name)?85:80,unit:"percent",gate:true,source:{document:program.source,section:"Theory"}})));
    program.syllabi=(program.syllabi||[]).map((x,i)=>({...x,order:x.order||i+1,mandatory:x.optional?false:true,instructorRequired:x.instructorRequired===undefined?x.mode!=="SOLO":x.instructorRequired,track:x.track||(/night/i.test(program.name)?"night":/day/i.test(program.name)?"day":"shared"),source:x.source||{document:program.source,profession:"EP",phase:program.phaseId,platform:program.platformId}}));
    if(!program.experienceCounters?.length)program.experienceCounters=[{id:program.id+"_flights",name:"Flights",unit:"flights",minimum:null,profession:"EP",phaseId:program.phaseId,platformIds:[program.platformId],source:{document:program.source}}];
    if(!program.emergencyRequirementIds?.length&&program.platformId==="aerostar"){
      const text=(program.syllabi||[]).map(x=>(x.name||"")+" "+(x.topics||"")).join(" ").toLowerCase();
      const rules=[["engine cut","aero_engine_cut"],["stuck throttle","aero_throttle_jam"],["low max rpm","aero_low_max_rpm"],["rpm drops","aero_rpm_drop"],["fading rpm","aero_rpm_fading"],["high cht","aero_high_cht"],["low cht","aero_low_cht"],["high idle","aero_high_idle"],["propeller","aero_prop_damage"],["gen","aero_gen_fail"],["no rpt","aero_no_report_tx"],["no report","aero_no_report_tx"],["flap","aero_flap_fail"],["ias","aero_ias_stuck"],["intercom","aero_intercom"],["low visibility","aero_low_visibility"],["takeoff","aero_takeoff_emergency"]];
      program.emergencyRequirementIds=[...new Set(rules.filter(x=>text.includes(x[0])).map(x=>x[1]))];
    }
    return program;
  };
  function overrideKey(courseKey){return "flympus-course-overrides:"+(courseKey||"default")}
  function getOverrides(courseKey){try{return JSON.parse(localStorage.getItem(overrideKey(courseKey))||"{}")||{}}catch{return {}}}
  function saveOverrides(courseKey,value){localStorage.setItem(overrideKey(courseKey),JSON.stringify(value||{}))}
  function applyOverrides(program,overrides){
    const p=clone(program);if(!p)return null;const o=overrides||{};
    p.syllabi=(p.syllabi||[]).filter(x=>o.syllabi?.[x.id]?.applicable!==false).map(x=>({...x,...(o.syllabi?.[x.id]||{})})).sort((a,b)=>(a.order||0)-(b.order||0));
    p.exams=(p.exams||[]).filter(x=>o.exams?.[x.id]?.applicable!==false).map(x=>({...x,...(o.exams?.[x.id]||{})}));
    p.criteria=(p.criteria||[]).filter(x=>o.criteria?.[x.id]?.applicable!==false).map(x=>({...x,...(o.criteria?.[x.id]||{})}));
    p.experienceCounters=(p.experienceCounters||[]).filter(x=>o.counters?.[x.id]?.applicable!==false).map(x=>({...x,...(o.counters?.[x.id]||{})}));
    p.progression=(p.progression||[]).filter(x=>o.progression?.[x.id]?.applicable!==false).map(x=>({...x,...(o.progression?.[x.id]||{})}));
    if(Array.isArray(o.emergencyRequirementIds))p.emergencyRequirementIds=o.emergencyRequirementIds.slice();
    p.courseOverrideApplied=Object.keys(o).length>0;return p;
  }
  function resolve(sel,opts={}){
    let p=findBase(sel||{});if(!p)return null;
    if((sel||{}).courseType==="EP")p=normalizeEp(p);
    p.criteria=p.criteria||clone(catalog((sel||{}).courseType)?.criteria||[]);
    return opts.courseKey?applyOverrides(p,getOverrides(opts.courseKey)):p;
  }
  function emergencyCatalog(platformId){
    const p=platform(platformId);if(p?.emergencies)return clone(p.emergencies);
    const ep=window.EP_CATALOG?.emergencyCatalogs?.[platformId]||[];return clone(ep);
  }
  function requiredEmergencies(program){const all=emergencyCatalog(program?.platformId);if(!program)return[];const ids=program.emergencyRequirementIds;if(!Array.isArray(ids))return all;const wanted=new Set(ids);return all.filter(x=>wanted.has(x.id));}
  function validate(){
    const errors=[],warnings=[];
    Object.values(catalogs).forEach(c=>(c.programs||[]).forEach(p=>{if(!p.phaseId||!p.platformId)errors.push(p.id+": missing phase/platform");const ids=new Set();(p.syllabi||[]).forEach(s=>{if(ids.has(s.id))errors.push(p.id+": duplicate syllabus "+s.id);ids.add(s.id);if(s.minimum!=null&&Number(s.minimum)<0)errors.push(p.id+": invalid minimum "+s.id)});(p.conflicts||[]).forEach(x=>warnings.push(p.id+": "+x.message))}));
    return {ok:!errors.length,errors,warnings,catalogs:Object.keys(catalogs).length,programs:Object.values(catalogs).reduce((n,c)=>n+(c.programs||[]).length,0)};
  }
  window.FLYMPUS_TRAINING={catalogs,register,catalog,phasesFor,platformsFor,programsFor,resolve,emergencyCatalog,requiredEmergencies,getOverrides,saveOverrides,applyOverrides,validate,sourceText};
})();
