'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(name,'utf8');
test('Scheduled flights use only visible Remove and a red confirmation',()=>{
 const html=read('index.html'),css=read('assets/roster-swipe-actions.css');
 assert.doesNotMatch(html,/FLYMPUS_ROW_SWIPE\?\.attach\?\.\(document\.querySelector/);
 assert.match(html,/title:'Remove flight\?',confirmLabel:'Remove',tone:'danger'/);
 assert.match(css,/\.fleetSortie \.flympusSwipeDeleteAction\{display:none!important\}/);
 assert.match(css,/\.fleetSortie:not\(\.conflict\)\{border-color:#dce7f0!important;background:#fff!important/);
 assert.match(css,/data-flympus-theme="dark"/);
});
test('Roster swipe is mobile-only and uses the established course membership permission',()=>{
 const html=read('index.html'),js=read('assets/roster-swipe-actions.js'),css=read('assets/roster-swipe-actions.css'),worker=read('sw.js');
 assert.match(html,/FLYMPUS_ROSTER_SWIPE\?\.attach\?\.\(document\.querySelector\('\.people'\),flympusCan\('roster\.manage'\)\)/);
 assert.match(html,/document\.querySelectorAll\('\[data-roster-remove\]'\)/);
 assert.match(html,/coursePersonIsAssignedTo\(p,type,currentCourseId\)/);
 assert.match(html,/updateCourseMembership\(id,type,\{removed:true\}\)/);
 assert.match(html,/Historical records will be preserved/);
 assert.match(js,/\(hover: none\) and \(pointer: coarse\)/);
 assert.match(js,/const attached=new WeakSet\(\),WIDTH=146,THRESHOLD=52/);
 assert.match(js,/event\.target\?\.closest\?\.\('button,input,select,textarea,a/);
 assert.match(css,/rosterSwipeRow/);
 assert.match(css,/right:0;top:0;bottom:0/);
 assert.match(css,/rosterSwipeOpen/);
 for(const filename of ['roster-swipe-actions.js','roster-swipe-actions.css']){
  assert.match(html,new RegExp(filename.replace('.','\\.')+'\\?v=20261010-visual-swipe-polish-0828'));
  assert.match(worker,new RegExp(filename.replace('.','\\.')+'\\?v=20261010-visual-swipe-polish-0828'));
 }
});
test('Swipe module creates neither tray nor handlers without a touch screen and roster authority',()=>{
 const source=read('assets/roster-swipe-actions.js');
 const sandbox={window:{matchMedia:()=>({matches:false}),document:{addEventListener(){}}}};
 vm.runInNewContext(source,sandbox,{filename:'roster-swipe-actions.js'});
 let calls=0;
 const host={querySelectorAll(){calls++;return []}};
 sandbox.window.FLYMPUS_ROSTER_SWIPE.attach(host,true);
 assert.equal(calls,0);
 sandbox.window.matchMedia=()=>({matches:true});
 sandbox.window.FLYMPUS_ROSTER_SWIPE.attach(host,false);
 assert.equal(calls,0);
 sandbox.window.FLYMPUS_ROSTER_SWIPE.attach(host,true);
 assert.equal(calls,1);
});
test('User Management sorts roles by hierarchy and filters roles across statuses',()=>{
 const auth=read('auth.js'),css=read('auth.css'),rules=read('firestore.rules'),release=read('scripts/course-operations-release.cjs');
 assert.match(auth,/let managedRoleFilter='ALL'/);
 assert.match(auth,/managedRoleRank\(b\.role\)-managedRoleRank\(a\.role\)/);
 assert.match(auth,/data-managed-role-filter/);
 assert.match(auth,/invitations\.filter\(x=>managedRoleFilter==='ALL'/);
 assert.match(auth,/normalized\.filter\(user=>user\.status===status&&\(managedRoleFilter==='ALL'/);
 assert.match(auth,/data-managed-account-delete/);
 assert.match(auth,/function canDeleteManagedAccount\(user\)/);
 assert.match(auth,/\['training_manager','user','duty_trainee'\]\.includes\(role\)/);
 assert.match(auth,/firestoreSdk\.writeBatch\(db\)/);
 assert.match(auth,/batch\.delete\(ref\)/);
 assert.match(auth,/loadManagedInvitations\(\)/);
 assert.doesNotMatch(auth,/authSdk\.deleteUser\(/);
 assert.match(rules,/function managerMayDelete\(uid\)[\s\S]*?return administrator\(\)/);
 assert.match(release,/PREVIOUS_USER_DELETE_RULE/);
 assert.match(release,/REVISED_USER_DELETE_RULE/);
 assert.match(css,/flympusManagedRoleFilter/);
 assert.match(css,/flympusUserDelete/);
});

test('mobile roster swipe action reveal follows the finger before settling gently',()=>{
 const js=read('assets/roster-swipe-actions.js'),css=read('assets/roster-swipe-actions.css');
 assert.match(js,/--roster-swipe-reveal/);
 assert.match(js,/getBoundingClientRect/);
 assert.match(css,/\.34s cubic-bezier\(\.2,\.76,\.18,1\)/);
 assert.match(css,/rosterSwipeMoving \.rosterSwipeActionTray\{opacity:var\(--roster-swipe-reveal,0\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
