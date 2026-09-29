const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const storage=()=>{const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
class ElementStub{
  constructor(){this.innerHTML="";this.textContent="";this.value="";this.dataset={};this.style={};this.classList={add(){},remove(){},toggle(){}}}
  querySelectorAll(){return[]} querySelector(){return null} addEventListener(){} click(){} appendChild(){}
}
const elements=new Map(["#menuBtn","#backdrop","#nav","#content","#drawer","#toast"].map(id=>[id,new ElementStub()]));
const document={querySelector:selector=>elements.get(selector)||null,querySelectorAll:()=>[],createElement:()=>new ElementStub()};
const context={window:{},document,localStorage:storage(),sessionStorage:storage(),console,confirm:()=>true,setTimeout:()=>0,clearTimeout(){},Date,Math,JSON,Number,String,Array,Object,Map,Set,FormData:class{},Blob:class{},URL:{createObjectURL(){return""},revokeObjectURL(){}},location:{},navigator:{}};
context.window=context;vm.createContext(context);
for(const file of ["assets/ep-catalog.js","assets/aerostar-platform.js","assets/ip-catalog.js","assets/technician-catalog.js","assets/training-core.js","assets/ep-lessons-screening.js","assets/ep-lessons-rc-1.js","assets/ep-lessons-rc-2.js","assets/ep-lessons-half.js","assets/ep-lessons-full-day-a.js","assets/ep-lessons-full-day-b.js","assets/ep-lessons-night.js"]){vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file})}
const html=fs.readFileSync("index.html","utf8");
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(x=>x.trim());
assert.equal(scripts.length,1);vm.runInContext(scripts[0],context,{filename:"index-inline.js"});
assert(elements.get("#content").innerHTML.length>1000,"Home must render");
vm.runInContext("go('settings')",context);assert.match(elements.get("#content").innerHTML,/Course Settings/);
assert.match(elements.get("#content").innerHTML,/Create a course/);
assert.match(elements.get("#content").innerHTML,/Sector/);
assert.match(elements.get("#content").innerHTML,/Tailor active course/);
vm.runInContext("Object.assign(state,{settingsTab:'builder',builderType:'EP',builderPhase:'ep_rc',builderPlatform:'',builderTraining:'',builderProgram:'',builderDay:'',builderCountry:'israel'});render()",context);
assert.match(elements.get("#content").innerHTML,/EP Course · RC Model/);
assert.doesNotMatch(elements.get("#content").innerHTML,/data-builder-platform=/);
assert.doesNotMatch(elements.get("#content").innerHTML,/data-builder-training=/);
vm.runInContext("Object.assign(state,{builderType:'EP',builderPhase:'ep_full',builderPlatform:'',builderTraining:'',builderProgram:'',builderDay:''});render()",context);
assert.match(elements.get("#content").innerHTML,/data-builder-platform="aerostar"/);
vm.runInContext("Object.assign(state,{builderType:'IP',builderPhase:'',builderPlatform:'aerostar',builderTraining:'new',builderProgram:'',builderDay:''});render()",context);
assert.doesNotMatch(elements.get("#content").innerHTML,/data-builder-phase=/);
assert.match(elements.get("#content").innerHTML,/IP Course · Full Scale · Aerostar/);
assert.match(elements.get("#content").innerHTML,/Aerostar configuration/);
vm.runInContext("Object.assign(state,{builderType:'TECHNICIAN',builderPhase:'',builderPlatform:'aerostar',builderTraining:'',builderProgram:'',builderDay:''});render()",context);
assert.match(elements.get("#content").innerHTML,/Technician Course · Full Scale · Aerostar/);
assert.doesNotMatch(elements.get("#content").innerHTML,/data-builder-training=/);
vm.runInContext("state.settingsTab='training_library';state.libraryProfession='IP';render()",context);assert.match(elements.get("#content").innerHTML,/Internal Pilot Training Architecture/);
vm.runInContext("state.libraryProfession='TECHNICIAN';render()",context);assert.match(elements.get("#content").innerHTML,/Technician Training Architecture/);
vm.runInContext("state.settingsTab='overrides';render()",context);assert.match(elements.get("#content").innerHTML,/Tailor active course/);
vm.runInContext("state.screen='roster';state.rosterManage=true;state.rosterType='TRAINEE';state.personEditKey='TRAINEE:t1';render()",context);
assert.match(elements.get("#content").innerHTML,/Add person/);
assert.match(elements.get("#content").innerHTML,/Remove from course/);
vm.runInContext("updateCourseMembership('t1','TRAINEE',{removed:true});state.personEditKey=null;render()",context);
assert.doesNotMatch(elements.get("#content").innerHTML,/Yoav Shauli/);
assert.equal(vm.runInContext("courseTrainees().some(x=>x.id==='t1')",context),false);
vm.runInContext("updateCourseMembership('t1','TRAINEE',{removed:false});state.screen='profile';state.selectedTrainee='t1';state.profileTab='activity';render()",context);
assert.match(elements.get("#content").innerHTML,/Flight experience/);
assert.match(elements.get("#content").innerHTML,/Record flight experience/);
assert.doesNotMatch(elements.get("#content").innerHTML,/Add accumulated activity/);
vm.runInContext("Object.assign(currentCourseMeta,{type:'TECHNICIAN',phase:'Full Scale',platformId:'aerostar',trainingKind:'New Training',dayNight:'Mixed / Day+Night',country:'Israel',programId:'tech_full_new'});render()",context);
assert.match(elements.get("#content").innerHTML,/Practical experience/);
assert.match(elements.get("#content").innerHTML,/Record practical task/);
assert.match(elements.get("#content").innerHTML,/Engine Installation \/ Removal/);
assert.match(elements.get("#content").innerHTML,/name="quantity" type="number" min="1" step="1"/);
console.log(JSON.stringify({ok:true,home:true,settings:true,guidedCourseWizard:true,ipLibrary:true,technicianLibrary:true,overrides:true,rosterMembership:true,experienceUx:true,technicianExperience:true}));
