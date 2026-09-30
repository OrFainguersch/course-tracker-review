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
  const uniq=(list,key="id")=>[...new Map((list||[]).filter(Boolean).map(x=>[x?.[key]||JSON.stringify(x),x])).values()];
  function mergeProgramList(list,meta={}){
    const programs=(list||[]).filter(Boolean);if(!programs.length)return null;if(programs.length===1)return clone(programs[0]);
    const platformIds=[...new Set(programs.map(x=>x.platformId).filter(Boolean))],ids=programs.map(x=>x.id),base=clone(programs[0]);
    const syllabi=[];programs.forEach(p=>(p.syllabi||[]).forEach(x=>syllabi.push({...clone(x),platformId:x.platformId||p.platformId,track:x.track||p.dayNight||"shared"})));
    return {...base,
      id:meta.id||("bundle__"+ids.join("__")),
      name:meta.name||programs.map(x=>x.name).join(" + "),
      phaseId:meta.phaseId||base.phaseId,
      platformId:meta.platformId!==undefined?meta.platformId:(platformIds.length===1?platformIds[0]:""),
      platformIds,
      trainingKind:meta.trainingKind||base.trainingKind,
      dayNight:meta.dayNight||([...new Set(programs.map(x=>x.dayNight))].length===1?base.dayNight:"mixed"),
      tracks:[...new Set(programs.flatMap(x=>x.tracks?.length?x.tracks:[x.dayNight||"shared"]))],
      source:programs.map(sourceText).filter(Boolean).join(" + "),
      sourceRevision:null,
      composedFrom:ids,
      theory:uniq(programs.flatMap(x=>x.theory||[])),
      exams:uniq(programs.flatMap(x=>x.exams||[])),
      syllabi:uniq(syllabi).map((x,i)=>({...x,order:i+1})),
      criteria:uniq(programs.flatMap(x=>x.criteria||[])),
      experienceCounters:uniq(programs.flatMap(x=>x.experienceCounters||[])),
      emergencyRequirementIds:[...new Set(programs.flatMap(x=>x.emergencyRequirementIds||[]))],
      progression:uniq(programs.flatMap(x=>x.progression||[]))
    };
  }
  function mergePrograms(a,b){
    return mergeProgramList([a,b],{name:a.name.replace(/Day\s*·?\s*/i,"")+" · Day + Night",dayNight:"mixed",platformId:a.platformId});
  }
  const customPackagesKey="flympus-custom-packages";
  function getCustomPackages(){try{const v=JSON.parse(localStorage.getItem(customPackagesKey)||"{}");return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}catch{return {}}}
  function saveCustomPackages(value){localStorage.setItem(customPackagesKey,JSON.stringify(value||{}))}
  function customPackagesFor(professionId){const root=getCustomPackages(),list=root[professionId];return Array.isArray(list)?clone(list):[]}
  function saveCustomPackage(professionId,packageDef){
    if(!professionId||!packageDef?.id)return null;
    const root=getCustomPackages(),list=Array.isArray(root[professionId])?root[professionId]:[],idx=list.findIndex(x=>x.id===packageDef.id),next={...clone(packageDef),professionId,customPackage:true};
    if(idx>=0)list[idx]=next;else list.push(next);root[professionId]=list;saveCustomPackages(root);return clone(next);
  }
  function removeCustomPackage(professionId,packageId){
    const root=getCustomPackages(),list=Array.isArray(root[professionId])?root[professionId]:[],next=list.filter(x=>x.id!==packageId);
    root[professionId]=next;saveCustomPackages(root);return next.length!==list.length;
  }
  function packageBase(professionId,packageId){
    const c=catalog(professionId);if(!c||!packageId)return null;
    let p=clone(customPackagesFor(professionId).find(x=>x.id===packageId))||null;
    if(professionId==="EP"&&packageId==="ep_screening"){
      const parts=(c.programs||[]).filter(x=>x.phaseId==="ep_screening");
      p=mergeProgramList(parts,{id:"ep_screening",name:"EP Screening · Simulator + Live RC",phaseId:"ep_screening",trainingKind:"screening",dayNight:"day",platformId:""});
    }else if(professionId==="EP"&&packageId==="ep_full_new_mixed"){
      const parts=(c.programs||[]).filter(x=>x.phaseId==="ep_full"&&x.trainingKind==="new"&&(x.dayNight==="day"||x.dayNight==="night"));
      p=mergeProgramList(parts,{id:"ep_full_new_mixed",name:"EP Course · Full Scale · Aerostar · Day + Night",phaseId:"ep_full",trainingKind:"new",dayNight:"mixed",platformId:"aerostar"});
    }else if(!p)p=clone((c.programs||[]).find(x=>x.id===packageId));
    if(!p)return null;
    if(professionId==="EP")p=normalizeEp(p);
    p.criteria=p.criteria||clone(c.criteria||[]);
    return p;
  }
  function packageIdsFor(professionId){
    const c=catalog(professionId);if(!c)return[];
    if(professionId!=="EP")return [...new Set([...(c.programs||[]).map(x=>x.id),...customPackagesFor(professionId).map(x=>x.id)])];
    const raw=(c.programs||[]).map(x=>x.id),out=[];
    if(raw.includes("ep_screening_simulator")||raw.includes("ep_screening_rc"))out.push("ep_screening");
    ["ep_rc_new","ep_half_new","ep_full_day_new","ep_full_night_new"].forEach(id=>{if(raw.includes(id))out.push(id)});
    if(raw.includes("ep_full_day_new")&&raw.includes("ep_full_night_new"))out.push("ep_full_new_mixed");
    ["ep_full_refresh","ep_full_rtc"].forEach(id=>{if(raw.includes(id))out.push(id)});
    raw.filter(id=>!["ep_screening_simulator","ep_screening_rc",...out].includes(id)).forEach(id=>out.push(id));
    customPackagesFor(professionId).forEach(x=>{if(!out.includes(x.id))out.push(x.id)});
    return out;
  }
  function packageCatalog(professionId){return packageIdsFor(professionId).map(id=>packageBase(professionId,id)).filter(Boolean).map(applyGlobalOverrides)}
  function resolvePackage(professionId,packageId,opts={}){
    let p=packageBase(professionId,packageId);if(!p)return null;
    p=applyGlobalOverrides(p);
    return opts.courseKey?applyOverrides(p,getOverrides(opts.courseKey)):p;
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
    program.experienceCounters=program.experienceCounters||[];
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
  function globalOverrideKey(programId){return "flympus-global-program-overrides:"+(programId||"default")}
  function getGlobalOverrides(programId){try{return JSON.parse(localStorage.getItem(globalOverrideKey(programId))||"{}")||{}}catch{return {}}}
  function saveGlobalOverrides(programId,value){localStorage.setItem(globalOverrideKey(programId),JSON.stringify(value||{}))}
  function mergeOverrideObjects(list){
    const out={};
    (list||[]).filter(Boolean).forEach(o=>{
      if(o.program)out.program={...(out.program||{}),...o.program};
      for(const key of ["syllabi","exams","criteria","counters","progression","emergencies"])if(o[key])out[key]={...(out[key]||{}),...o[key]};
      if(o.custom){
        out.custom=out.custom||{};
        for(const key of ["syllabi","exams","criteria","counters","progression","emergencies"]){
          if(Array.isArray(o.custom[key]))out.custom[key]=[...(out.custom[key]||[]),...clone(o.custom[key])];
        }
      }
      if(Array.isArray(o.emergencyRequirementIds))out.emergencyRequirementIds=o.emergencyRequirementIds.slice();
    });
    return out;
  }
  function globalOverridesForProgram(program){
    if(!program)return{};
    const ids=[...(program.composedFrom||[]),program.id].filter(Boolean);
    return mergeOverrideObjects(ids.map(getGlobalOverrides));
  }
  function applyOverrides(program,overrides,scope="course"){
    const p=clone(program);if(!p)return null;const o=overrides||{},custom=o.custom||{};
    if(o.program)Object.assign(p,o.program);
    const markCustom=x=>scope==="global"?({...x,packageCustom:true,courseOnly:false}):({...x,courseOnly:true});
    const mergeItems=(base,patches,added)=>[...(base||[]),...(clone(added||[]).map(markCustom))].filter(x=>patches?.[x.id]?.applicable!==false&&x.applicable!==false).map(x=>({...x,...(patches?.[x.id]||{})}));
    p.syllabi=mergeItems(p.syllabi,o.syllabi,custom.syllabi).sort((a,b)=>(a.order||0)-(b.order||0));
    p.exams=mergeItems(p.exams,o.exams,custom.exams);
    p.criteria=mergeItems(p.criteria,o.criteria,custom.criteria);
    p.experienceCounters=mergeItems(p.experienceCounters,o.counters,custom.counters);
    p.progression=mergeItems(p.progression,o.progression,custom.progression);
    p.courseEmergencies=mergeItems(p.courseEmergencies,o.emergencies,custom.emergencies);
    if(Array.isArray(o.emergencyRequirementIds))p.emergencyRequirementIds=o.emergencyRequirementIds.slice();
    p.courseOverrideApplied=scope==="course"&&Object.keys(o).length>0;
    return p;
  }
  function applyGlobalOverrides(program){
    const o=globalOverridesForProgram(program),p=applyOverrides(program,o,"global");
    if(p)p.globalOverrideApplied=Object.keys(o).length>0;
    return p;
  }
  function resolve(sel,opts={}){
    let p=findBase(sel||{});if(!p)return null;
    if((sel||{}).courseType==="EP")p=normalizeEp(p);
    p.criteria=p.criteria||clone(catalog((sel||{}).courseType)?.criteria||[]);
    p=applyGlobalOverrides(p);
    return opts.courseKey?applyOverrides(p,getOverrides(opts.courseKey)):p;
  }
  function normalizeGuidedSelection(sel={}){
    const s={...clone(sel)},c=catalog(s.courseType);if(!c)return s;
    s.country=s.country||"israel";
    if(s.courseType==="EP"){
      if(!s.phaseId)return s;
      if(s.phaseId!=="ep_full"){
        s.trainingKind=s.phaseId==="ep_screening"?"screening":"new";
        s.dayNight="day";
        const matches=(c.programs||[]).filter(p=>p.phaseId===s.phaseId&&p.trainingKind===s.trainingKind&&(!p.countryIds?.length||p.countryIds.includes(s.country)));
        const platforms=[...new Set(matches.map(p=>p.platformId).filter(Boolean))];
        if(platforms.length===1)s.platformId=platforms[0];else s.platformId="";
        if(matches.length===1)s.programId=matches[0].id;else s.programId="";
      }
    }else if(s.courseType==="IP"){
      s.phaseId=s.phaseId||c.phases?.[0]?.id||"";
      if(s.platformId&&s.trainingKind){
        const matches=programsFor(s);
        if(!s.programId&&matches.length){
          const preferred=matches.find(p=>p.configurationId==="gcs_d")||matches[0];
          s.programId=preferred.id;
        }
        const chosen=matches.find(p=>p.id===s.programId)||matches[0];
        if(chosen&&!s.dayNight)s.dayNight=chosen.dayNight||"mixed";
      }
    }else if(s.courseType==="TECHNICIAN"){
      s.phaseId=s.phaseId||c.phases?.[0]?.id||"";
      if(s.platformId&&s.trainingKind){
        const matches=programsFor(s);
        if(!s.programId&&matches.length){
          const preferred=matches.find(p=>p.configurationId==="engine_h_gcs_d")||matches[0];
          s.programId=preferred.id;
        }
        const chosen=matches.find(p=>p.id===s.programId)||matches[0];
        if(chosen&&!s.dayNight)s.dayNight=chosen.dayNight||"mixed";
      }
    }
    return s;
  }
  function guidedOptions(sel={}){
    const s=normalizeGuidedSelection(sel),c=catalog(s.courseType),profession=s.courseType||"";
    const epFull=profession==="EP"&&s.phaseId==="ep_full";
    const phaseId=s.phaseId||(profession!=="EP"?c?.phases?.[0]?.id:"");
    const platformOptions=(profession==="EP"&&!epFull)?[]:platformsFor(profession,phaseId);
    const basePrograms=c?(c.programs||[]).filter(p=>(!phaseId||p.phaseId===phaseId)&&(!s.platformId||p.platformId===s.platformId)&&(!p.countryIds?.length||p.countryIds.includes(s.country||"israel"))):[];
    const trainingKinds=[...new Set(basePrograms.map(p=>p.trainingKind).filter(Boolean))];
    const selectedPrograms=basePrograms.filter(p=>!s.trainingKind||p.trainingKind===s.trainingKind);
    const daySet=new Set(selectedPrograms.flatMap(p=>p.dayNight==="mixed"?["day","night","mixed"]:[p.dayNight]).filter(Boolean));if(daySet.has("day")&&daySet.has("night"))daySet.add("mixed");const dayNights=[...daySet];
    const configPrograms=selectedPrograms.filter(p=>!s.dayNight||s.dayNight==="mixed"||p.dayNight===s.dayNight||p.dayNight==="mixed");
    return {
      selection:s,
      showPhase:profession==="EP",
      showPlatform:profession==="IP"||profession==="TECHNICIAN"||epFull,
      showTrainingKind:profession==="IP"||profession==="TECHNICIAN"||epFull,
      showTracks:epFull,
      phaseOptions:phasesFor(profession),
      platformOptions,
      trainingKinds,
      dayNights,
      configurationOptions:configPrograms.map(applyGlobalOverrides),
      canResolve:!!resolveGuided(s)
    };
  }
  function resolveGuided(sel={},opts={}){
    const s=normalizeGuidedSelection(sel),c=catalog(s.courseType);if(!c)return null;
    if(s.courseType==="EP"&&s.phaseId&&s.phaseId!=="ep_full"){
      const matches=(c.programs||[]).filter(p=>p.phaseId===s.phaseId&&p.trainingKind===s.trainingKind&&(!p.countryIds?.length||p.countryIds.includes(s.country||"israel")));
      if(!matches.length)return null;
      let p=matches.length===1?clone(matches[0]):mergeProgramList(matches,{id:"ep_phase__"+s.phaseId,name:"EP · "+(c.phases?.find(x=>x.id===s.phaseId)?.name||s.phaseId),phaseId:s.phaseId,platformId:"",trainingKind:s.trainingKind,dayNight:"day"});
      p=normalizeEp(p);p.criteria=p.criteria||clone(c.criteria||[]);p=applyGlobalOverrides(p);
      return opts.courseKey?applyOverrides(p,getOverrides(opts.courseKey)):p;
    }
    return resolve(s,opts);
  }
  function emergencyCatalog(platformId){
    const p=platform(platformId);if(p?.emergencies)return clone(p.emergencies);
    const ep=window.EP_CATALOG?.emergencyCatalogs?.[platformId]||[];return clone(ep);
  }
  function requiredEmergencies(program){
    if(!program)return[];
    const platformIds=program.platformId?[program.platformId]:(program.platformIds||[]);
    const all=uniq([...platformIds.flatMap(id=>emergencyCatalog(id)),...(program.courseEmergencies||[])]);
    const ids=program.emergencyRequirementIds;if(!Array.isArray(ids))return all;const wanted=new Set(ids);return all.filter(x=>wanted.has(x.id));
  }
  function validate(){
    const errors=[],warnings=[];
    Object.values(catalogs).forEach(c=>(c.programs||[]).forEach(p=>{if(!p.phaseId||!p.platformId)errors.push(p.id+": missing phase/platform");const ids=new Set();(p.syllabi||[]).forEach(s=>{if(ids.has(s.id))errors.push(p.id+": duplicate syllabus "+s.id);ids.add(s.id);if(s.minimum!=null&&Number(s.minimum)<0)errors.push(p.id+": invalid minimum "+s.id)});(p.conflicts||[]).forEach(x=>warnings.push(p.id+": "+x.message))}));
    return {ok:!errors.length,errors,warnings,catalogs:Object.keys(catalogs).length,programs:Object.values(catalogs).reduce((n,c)=>n+(c.programs||[]).length,0)};
  }
  window.FLYMPUS_TRAINING={catalogs,register,catalog,phasesFor,platformsFor,programsFor,packageBase,packageCatalog,resolvePackage,getCustomPackages,saveCustomPackages,customPackagesFor,saveCustomPackage,removeCustomPackage,resolve,resolveGuided,normalizeGuidedSelection,guidedOptions,emergencyCatalog,requiredEmergencies,getOverrides,saveOverrides,getGlobalOverrides,saveGlobalOverrides,globalOverridesForProgram,applyOverrides,applyGlobalOverrides,validate,sourceText};
})();
