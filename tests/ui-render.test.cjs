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
vm.runInContext("state.settingsTab='training_library';state.libraryProfession='IP';render()",context);assert.match(elements.get("#content").innerHTML,/Internal Pilot Training Architecture/);
vm.runInContext("state.libraryProfession='TECHNICIAN';render()",context);assert.match(elements.get("#content").innerHTML,/Technician Training Architecture/);
vm.runInContext("state.settingsTab='overrides';render()",context);assert.match(elements.get("#content").innerHTML,/Course overrides/);
vm.runInContext("state.screen='roster';state.rosterManage=true;state.rosterType='TRAINEE';state.personEditKey='TRAINEE:t1';render()",context);
assert.match(elements.get("#content").innerHTML,/Add person/);
assert.match(elements.get("#content").innerHTML,/Remove from course/);
vm.runInContext("updateCourseMembership('t1','TRAINEE',{removed:true});state.personEditKey=null;render()",context);
assert.doesNotMatch(elements.get("#content").innerHTML,/Yoav Shauli/);
assert.equal(vm.runInContext("courseTrainees().some(x=>x.id==='t1')",context),false);
console.log(JSON.stringify({ok:true,home:true,settings:true,ipLibrary:true,technicianLibrary:true,overrides:true,rosterMembership:true}));
