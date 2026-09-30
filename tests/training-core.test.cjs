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
assert.equal(techGuide.showPhase,false);assert.equal(techGuide.showPlatform,true);assert.equal(techGuide.showTrainingKind,true);assert.equal(techGuide.showTracks,false);
const techNewGuide=core.guidedOptions({courseType:"TECHNICIAN",platformId:"aerostar",trainingKind:"new"});
assert(techNewGuide.configurationOptions.some(x=>x.configurationId==="engine_h_gcs_d")&&techNewGuide.configurationOptions.some(x=>x.configurationId==="engine_d_gcs_c"),"Technician New Training must expose system packages instead of Day/Night");
const techQualGuide=core.guidedOptions({courseType:"TECHNICIAN",platformId:"aerostar",trainingKind:"customer_qualification"});
assert(techQualGuide.configurationOptions.some(x=>x.id==="tech_full_brakes")&&techQualGuide.configurationOptions.some(x=>x.id==="tech_full_commint"),"Technician qualification packages must be selectable");
const techAuto=core.resolveGuided({courseType:"TECHNICIAN",platformId:"aerostar",trainingKind:"new"});
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

core.saveGlobalOverrides("ip_full_new_gcs_d",{program:{name:"Global IP GCS-D Package"},counters:{ip_takeoffs:{name:"Global takeoffs",minimum:6}},exams:{ip_exam_theory:{pass:83}}});
const globalIp=core.resolve({courseType:"IP",phaseId:"ip_full",platformId:"aerostar",trainingKind:"new",programId:"ip_full_new_gcs_d",dayNight:"mixed"});
assert.equal(globalIp.name,"Global IP GCS-D Package");
assert.equal(globalIp.experienceCounters.find(x=>x.id==="ip_takeoffs").minimum,6);
assert.equal(globalIp.exams.find(x=>x.id==="ip_exam_theory").pass,83);
core.saveOverrides("GLOBAL-COURSE",{program:{name:"Course-only Package"},counters:{ip_takeoffs:{minimum:9}}});
const layeredIp=core.resolve({courseType:"IP",phaseId:"ip_full",platformId:"aerostar",trainingKind:"new",programId:"ip_full_new_gcs_d",dayNight:"mixed"},{courseKey:"GLOBAL-COURSE"});
assert.equal(layeredIp.name,"Course-only Package","Course Tailor must override the global package name");
assert.equal(layeredIp.experienceCounters.find(x=>x.id==="ip_takeoffs").minimum,9,"Course Tailor must override global package defaults");
assert.equal(core.guidedOptions({courseType:"IP",platformId:"aerostar",trainingKind:"new"}).configurationOptions.find(x=>x.id==="ip_full_new_gcs_d").name,"Global IP GCS-D Package","Global package name must appear in course creation");
core.saveGlobalOverrides("ip_full_new_gcs_d",{});

core.saveGlobalOverrides("ep_full_refresh",{
  custom:{
    syllabi:[{id:"pkg_syll_1",name:"Package custom syllabus",order:99,minimum:1,mode:"INSTRUCTED",instructorRequired:true,track:"day"}],
    criteria:[{id:"pkg_criterion_1",name:"Package custom criterion",weight:10}],
    emergencies:[{id:"pkg_emergency_1",name:"Package custom emergency",category:"General / Operational"}]
  },
  emergencyRequirementIds:["pkg_emergency_1"]
});
const refreshPackage=core.resolvePackage("EP","ep_full_refresh");
assert(refreshPackage.syllabi.some(x=>x.id==="pkg_syll_1"&&x.packageCustom===true&&x.courseOnly===false),"Global Package custom syllabus must resolve as a reusable Package item");
assert(refreshPackage.criteria.some(x=>x.id==="pkg_criterion_1"&&x.packageCustom===true),"Global Package custom criterion must resolve");
assert(core.requiredEmergencies(refreshPackage).some(x=>x.id==="pkg_emergency_1"),"Global Package custom emergency must resolve");
const refreshCourse=core.resolvePackage("EP","ep_full_refresh",{courseKey:"PKG-COURSE"});
assert(refreshCourse.syllabi.some(x=>x.id==="pkg_syll_1"),"Courses using the Package must inherit Package custom syllabus");
core.saveGlobalOverrides("ep_full_refresh",{});

core.saveCustomPackage("EP",{id:"ep_custom_pkg_test",name:"EP · Custom Package",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day",theory:[],syllabi:[],criteria:[],experienceCounters:[],exams:[],progression:[],emergencyRequirementIds:[],courseEmergencies:[]});
assert(core.packageCatalog("EP").some(x=>x.id==="ep_custom_pkg_test"),"Custom Package must be associated with its sector");
const customPkg=core.resolvePackage("EP","ep_custom_pkg_test");
assert.equal(customPkg.name,"EP · Custom Package");
assert.equal(customPkg.professionId,"EP");
core.removeCustomPackage("EP","ep_custom_pkg_test");
assert(!core.packageCatalog("EP").some(x=>x.id==="ep_custom_pkg_test"),"Removed custom Package must leave the sector package list");

core.saveOverrides("EP-TEST",{syllabi:{full_preflight:{name:"Course Preflight",minimum:2}},counters:{ep_full_day_takeoffs:{name:"Course takeoffs",minimum:5}},criteria:{flight_path_control:{name:"Course flight path",weight:30}}});
const epCourseOverride=core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day"},{courseKey:"EP-TEST"});
assert.equal(epCourseOverride.syllabi.find(x=>x.id==="full_preflight").name,"Course Preflight");
assert.equal(epCourseOverride.syllabi.find(x=>x.id==="full_preflight").minimum,2);
assert.equal(epCourseOverride.experienceCounters.find(x=>x.id==="ep_full_day_takeoffs").name,"Course takeoffs");
assert.equal(epCourseOverride.experienceCounters.find(x=>x.id==="ep_full_day_takeoffs").minimum,5);
assert.equal(epCourseOverride.criteria.find(x=>x.id==="flight_path_control").name,"Course flight path");
assert.equal(core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day"}).syllabi.find(x=>x.id==="full_preflight").name,"Preflight","Tailor must not mutate the source suit");

core.saveOverrides("COURSE-CUSTOM",{
  custom:{
    syllabi:[{id:"course_syll_1",name:"Course-only circuits",order:999,minimum:2,mode:"INSTRUCTED",instructorRequired:true,track:"day"}],
    counters:[{id:"course_counter_1",name:"Course-only repetitions",minimum:4,unit:"count",track:"shared",kind:"CUSTOM"}],
    criteria:[{id:"course_criterion_1",name:"Course-only airmanship",weight:15}],
    exams:[{id:"course_exam_1",name:"Course-only exam",pass:85}],
    progression:[{id:"course_gate_1",prerequisite:"Course Manager approval"}],
    emergencies:[{id:"course_emergency_1",name:"Course-only emergency",category:"General / Operational"}]
  },
  emergencyRequirementIds:["aero_engine_cut","course_emergency_1"]
});
const customCourse=core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day"},{courseKey:"COURSE-CUSTOM"});
assert(customCourse.syllabi.some(x=>x.id==="course_syll_1"&&x.courseOnly===true),"Course-only syllabus must resolve only in that course");
assert(customCourse.experienceCounters.some(x=>x.id==="course_counter_1"&&x.minimum===4),"Course-only experience requirement must resolve");
assert(customCourse.criteria.some(x=>x.id==="course_criterion_1"),"Course-only criterion must resolve");
assert(customCourse.exams.some(x=>x.id==="course_exam_1"),"Course-only exam must resolve");
assert(customCourse.progression.some(x=>x.id==="course_gate_1"),"Course-only progression gate must resolve");
assert(core.requiredEmergencies(customCourse).some(x=>x.id==="course_emergency_1"),"Course-only emergency must resolve into course emergency requirements");
const cleanCourse=core.resolve({courseType:"EP",phaseId:"ep_full",platformId:"aerostar",trainingKind:"new",dayNight:"day"});
assert(!cleanCourse.syllabi.some(x=>x.id==="course_syll_1"),"Course-only syllabus must not leak into Package defaults");
assert(!core.requiredEmergencies(cleanCourse).some(x=>x.id==="course_emergency_1"),"Course-only emergency must not leak into other courses");

console.log(JSON.stringify({ok:true,catalogs:core.validate().catalogs,programs:core.validate().programs,aerostarEmergencies:core.emergencyCatalog("aerostar").length,technicianTasks:tech.syllabi.length},null,2));
