const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function evaluationInstructorForAccount(){'),end=html.indexOf('function evaluation(){',start);
assert(start>0&&end>start);
const helpers=html.slice(start,end);
const members=[{id:'i1',uid:'uid1',email:'one@example.org'},{id:'i2',uid:'uid2',email:'two@example.org'}];
const flight={id:'p1',date:'2026-10-09',time:'08:00',mode:'INSTRUCTED',traineeId:'t1',instructorId:'i2',syllabus:'Circuits',estimatedMinutes:42};
const ctx={window:{FLYMPUS_AUTH:null},courseInstructors:()=>members,getDailyFlightBoard:()=>[flight]};
vm.createContext(ctx);vm.runInContext(helpers,ctx);
test('Instructor preselection follows active account and course roster identity, not hardcoded i1',()=>{
 ctx.window.FLYMPUS_AUTH={currentUser:{uid:'uid2'},isActive:()=>true};
 assert.equal(ctx.evaluationInstructorForAccount(),'i2');
 ctx.window.FLYMPUS_AUTH={profile:{email:'ONE@EXAMPLE.ORG'},isActive:()=>true};
 assert.equal(ctx.evaluationInstructorForAccount(),'i1');
 ctx.window.FLYMPUS_AUTH={currentUser:{uid:'unknown',email:'outside@example.org'},isActive:()=>true};
 assert.equal(ctx.evaluationInstructorForAccount(),'');
 ctx.window.FLYMPUS_AUTH={currentUser:{uid:'uid1'},isActive:()=>false};
 assert.equal(ctx.evaluationInstructorForAccount(),'');
});
test('Evaluation matches only unique instructed flights on same date/trainee/instructor/syllabus',()=>{
 const params={date:'2026-10-09',traineeId:'t1',instructorId:'i2',syllabus:'Circuits'};
 assert.equal(ctx.evaluationFlightMatch(params).flight.estimatedMinutes,42);
 for(const diff of [{date:'2026-10-10'},{traineeId:'t2'},{instructorId:'i1'},{syllabus:'Figure Eights'}])
  assert.equal(ctx.evaluationFlightMatch({...params,...diff}).status,'none');
 ctx.getDailyFlightBoard=()=>[flight,{...flight,id:'p2',time:'10:00'}];
 assert.equal(ctx.evaluationFlightMatch(params).status,'ambiguous');
 ctx.getDailyFlightBoard=()=>[{...flight,mode:'SOLO'}];
 assert.equal(ctx.evaluationFlightMatch(params).status,'none');
});
test('Plan suggestion never clobbers drafts, revisions or manually entered actual minutes',()=>{
 assert.match(html,/<select class="input" name="duration" required>/);
 assert.match(html,/evaluationDurationOptions\(edit\?\.duration\?\?autoDraft\?\.data\?\.duration\)/);
 assert.match(html,/ensureEvaluationDurationOption\(evalDurationControl,result\.flight\.estimatedMinutes\)/);
 assert.doesNotMatch(html,/Flight duration \(min\)/);
 assert.match(html,/evalDurationManual=Boolean\(state.editingEval\|\|canRestore\)/);
 assert.match(html,/if\(evalDurationManual\|\|!evalDurationControl\)return/);
 assert.match(html,/evalDurationControl\?\.addEventListener\('input'/);
 assert.match(html,/evaluationFlightMatch\(/);
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 assert.match(css,/\.fleetTimeFlowLegend\{display:none!important\}/);
});

test('Evaluation minute picker preserves non-preset saved and draft durations',()=>{
 ctx.getFlympusAppPreferences=()=>({language:'en'});
 const options=ctx.evaluationDurationOptions('42');
 assert.match(options,/value="42" selected>42 min/);
 assert.match(options,/value="10" >10 min/);
 assert.match(options,/value="40" >40 min/);
});
