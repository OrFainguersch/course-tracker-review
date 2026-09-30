const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const memory=new Map();
const context={window:{},console,localStorage:{getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)}};
context.window=context;
vm.createContext(context);
for(const file of ["assets/ep-catalog.js","assets/aerostar-platform.js","assets/ip-catalog.js","assets/technician-catalog.js","assets/training-core.js"]){
  vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
}
const core=context.FLYMPUS_TRAINING;
assert.deepEqual(Object.keys(core.catalogs).sort(),["EP","IP","TECHNICIAN"]);
assert.equal(core.validate().ok,true,core.validate().errors.join("\n"));

for(const profession of ["EP","IP","TECHNICIAN"]){
  const phases=core.phasesFor(profession);
  assert(phases.some(x=>x.name==="Full Scale"),profession+" must own Full Scale phase");
  const full=phases.find(x=>x.name==="Full Scale");
  assert(core.platformsFor(profession,full.id).some(x=>x.id==="aerostar"),profession+" must map Aerostar beneath Full Scale");
  assert(!phases.some(x=>x.name.toLowerCase()==="aerostar"),"Aerostar must not be a phase");
}

const epMixed=core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"mixed"});
assert(epMixed.composedFrom?.length===2,"EP Day + Night must compose parallel tracks");
assert(epMixed.syllabi.some(x=>x.track==="day")&&epMixed.syllabi.some(x=>x.track==="night"));
assert(core.requiredEmergencies(epMixed).length>0&&core.requiredEmergencies(epMixed).length<core.emergencyCatalog("aerostar").length,"Suit requirements must be a subset of platform QRH catalog");
const epDay=core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day"});
const epNight=core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"night"});
assert(epDay.experienceCounters.some(x=>x.kind==="TAKEOFF"&&x.track==="day"&&x.minimum===3),"Day EP must track 3 takeoffs");
assert(epDay.experienceCounters.some(x=>x.kind==="LANDING"&&x.track==="day"&&x.minimum===3),"Day EP must track 3 full-stop landings");
assert(epNight.experienceCounters.some(x=>x.kind==="TAKEOFF"&&x.track==="night"&&x.minimum===3),"Night EP must track 3 takeoffs");
assert(epNight.experienceCounters.some(x=>x.kind==="LANDING"&&x.track==="night"&&x.minimum===3),"Night EP must track 3 full-stop landings");
assert.equal(epMixed.experienceCounters.filter(x=>x.kind==="TAKEOFF").length,2,"Mixed EP must keep Day and Night takeoffs separate");
assert.equal(epMixed.experienceCounters.filter(x=>x.kind==="LANDING").length,2,"Mixed EP must keep Day and Night landings separate");

const epRcGuide=core.guidedOptions({courseType:"EP",phaseId:"ep_rc"});
assert.equal(epRcGuide.showPhase,true);assert.equal(epRcGuide.showPlatform,false);assert.equal(epRcGuide.showTrainingKind,false);
const epRcAuto=core.resolveGuided({courseType:"EP",phaseId:"ep_rc"});
assert.equal(epRcAuto.id,"ep_rc_new");assert.equal(epRcAuto.platformId,"rc_model");assert.equal(epRcAuto.trainingKind,"new");
assert.equal(epRcAuto.experienceCounters.length,0,"RC must not invent a generic Flights experience counter");

const epScreening=core.resolveGuided({courseType:"EP",phaseId:"ep_screening"});
assert(epScreening.composedFrom?.length===2,"EP screening must resolve simulator + live RC as one phase package");
assert.deepEqual([...epScreening.platformIds].sort(),["rc_model","rc_simulator"]);
assert(epScreening.syllabi.some(x=>x.id==="screen_sim_basics")&&epScreening.syllabi.some(x=>x.id==="screen_rc_flights"));

const epFullGuide=core.guidedOptions({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new"});
assert.equal(epFullGuide.showPlatform,true);assert.equal(epFullGuide.showTrainingKind,true);assert.equal(epFullGuide.showTracks,true);
assert(epFullGuide.dayNights.includes("mixed"),"EP Full Scale must allow Day + Night in the same course");

const ipGuide=core.guidedOptions({courseType:"IP"});
assert.equal(ipGuide.showPhase,false);assert.equal(ipGuide.showPlatform,true);assert.equal(ipGuide.showTrainingKind,true);assert.equal(ipGuide.showTracks,false);
const ipAuto=core.resolveGuided({courseType:"IP",platformId:"aerostar",trainingKind:"new"});
assert.equal(ipAuto.id,"ip_full_new_gcs_d");assert.equal(ipAuto.phaseId,"ip_full");assert.equal(ipAuto.platformId,"aerostar");

const techGuide=core.guidedOptions({courseType:"TECHNICIAN"});
assert.equal(techGuide.showPhase,false);assert.equal(techGuide.showPlatform,true);assert.equal(techGuide.showTrainingKind,false);assert.equal(techGuide.showTracks,false);
const techAuto=core.resolveGuided({courseType:"TECHNICIAN",platformId:"aerostar"});
assert.equal(techAuto.id,"tech_full_new");assert.equal(techAuto.phaseId,"tech_full");assert.equal(techAuto.trainingKind,"new");

const ipC=core.resolve({courseType:"IP",phaseId:"ip_full",platformId:"aerostar",trainingKind:"new",programId:"ip_full_new_gcs_c",dayNight:"mixed"});
const ipD=core.resolve({courseType:"IP",phaseId:"ip_full",platformId:"aerostar",trainingKind:"new",programId:"ip_full_new_gcs_d",dayNight:"mixed"});
assert.equal(ipC.configurationId,"gcs_c");assert.equal(ipD.configurationId,"gcs_d");
assert(ipD.syllabi.some(x=>x.mode==="CHECK")&&ipD.syllabi.some(x=>x.mode==="CERTIFICATION"),"Solo/check/certification semantics must remain explicit");
assert(ipD.progression.some(x=>x.decisionRequired),"IP final gate must require a decision");

const tech=core.resolve({courseType:"TECHNICIAN",phaseId:"tech_full",platformId:"aerostar",trainingKind:"new",dayNight:"mixed"});
assert(tech.syllabi.length>100,"Technician practical requirements must not be flattened into a flight-only syllabus");
assert(tech.experienceCounters.some(x=>/Assembly \/ Disassembly/.test(x.name)&&x.minimum===2));
assert(tech.experienceCounters.some(x=>x.group==="Flight Experience"));

const original=ipD.syllabi.find(x=>x.id==="ip_basic_knobs").minimum;
core.saveOverrides("TEST-COURSE",{syllabi:{ip_basic_knobs:{minimum:7,instructorRequired:false,mode:"SOLO"}},emergencyRequirementIds:["aero_single_ins"]});
const overridden=core.resolve({courseType:"IP",phaseId:"ip_full",platformId:"aerostar",trainingKind:"new",programId:"ip_full_new_gcs_d",dayNight:"mixed"},{courseKey:"TEST-COURSE"});
assert.equal(overridden.syllabi.find(x=>x.id==="ip_basic_knobs").minimum,7);
assert.equal(overridden.syllabi.find(x=>x.id==="ip_basic_knobs").instructorRequired,false);
assert.equal(core.resolve({courseType:"IP",phaseId:"ip_full",platformId:"aerostar",trainingKind:"new",programId:"ip_full_new_gcs_d",dayNight:"mixed"}).syllabi.find(x=>x.id==="ip_basic_knobs").minimum,original,"Course override must not mutate base source");
assert.equal(core.requiredEmergencies(overridden).map(x=>x.id).join(","),"aero_single_ins");

core.saveOverrides("EP-TEST",{syllabi:{full_preflight:{name:"Course Preflight",minimum:2}},counters:{ep_full_day_takeoffs:{name:"Course takeoffs",minimum:5}},criteria:{flight_path_control:{name:"Course flight path",weight:30}}});
const epCourseOverride=core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day"},{courseKey:"EP-TEST"});
assert.equal(epCourseOverride.syllabi.find(x=>x.id==="full_preflight").name,"Course Preflight");
assert.equal(epCourseOverride.syllabi.find(x=>x.id==="full_preflight").minimum,2);
assert.equal(epCourseOverride.experienceCounters.find(x=>x.id==="ep_full_day_takeoffs").name,"Course takeoffs");
assert.equal(epCourseOverride.experienceCounters.find(x=>x.id==="ep_full_day_takeoffs").minimum,5);
assert.equal(epCourseOverride.criteria.find(x=>x.id==="flight_path_control").name,"Course flight path");
assert.equal(core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day"}).syllabi.find(x=>x.id==="full_preflight").name,"Preflight","Tailor must not mutate the source suit");

console.log(JSON.stringify({ok:true,catalogs:core.validate().catalogs,programs:core.validate().programs,aerostarEmergencies:core.emergencyCatalog("aerostar").length,technicianTasks:tech.syllabi.length},null,2));
