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
 assert.match(css,/right:0;left:auto;top:0;bottom:0/);
 assert.match(css,/rosterSwipeOpen/);
 for(const filename of ['roster-swipe-actions.js','roster-swipe-actions.css']){
  assert.match(html,new RegExp(filename.replace('.','\\.')+'\\?v=20261010-notes-rail-motion-0832'));
  assert.match(worker,new RegExp(filename.replace('.','\\.')+'\\?v=20261010-notes-rail-motion-0832'));
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
 assert.match(css,/--roster-motion-duration:\.42s/);
 assert.match(css,/--roster-motion-duration:\.46s/);
 assert.match(css,/transition:transform var\(--roster-motion-duration\) var\(--roster-motion-easing\)/);
 assert.match(css,/\.rosterSwipeActionTray\{[\s\S]*?visibility:hidden/);
 assert.match(css,/filter:none!important/);
 assert.match(css,/transition:clip-path var\(--roster-motion-duration\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('mobile Course Roster swipe wraps each person card into a single moving grid',()=>{
 const js=read('assets/roster-swipe-actions.js'),css=read('assets/roster-swipe-actions.css');
 assert.match(js,/content\.className='rosterSwipeContent'/);
 assert.match(js,/while\(row\.firstChild\)content\.appendChild\(row\.firstChild\)/);
 assert.match(js,/querySelector\('\.rosterSwipeContent'\)\?\.getBoundingClientRect/);
 assert.match(css,/\.personCard\.rosterSwipeRow\.traineeRosterCard/);
 assert.match(css,/rosterSwipeContent\{/);
 assert.match(css,/grid-template-columns:auto minmax\(0,1fr\) auto/);
 assert.match(css,/\.rosterSwipeMoving \.rosterSwipeContent\{transition:none!important\}/);
 assert.doesNotMatch(css,/> :not\(\.rosterSwipeActionTray\)/);
 assert.match(css,/\.rosterSwipeContent\{display:contents!important;transform:none!important\}/);
});
test('authorised touch attach preserves original roster nodes in one wrapper',()=>{
 const source=read('assets/roster-swipe-actions.js');
 const doc={documentElement:{dataset:{flympusLanguage:'en'}},addEventListener(){}};
 class FakeNode{
  constructor(tag='div'){this.tag=tag;this.children=[];this.parentNode=null;this.ownerDocument=doc;this.dataset={};this.attrs={};this.listeners={};
   const names=new Set();this.classList={contains:x=>names.has(x),add:x=>names.add(x),remove:x=>names.delete(x),toggle:(x,on)=>on?names.add(x):names.delete(x)};
   this.style={setProperty(){},removeProperty(){}}}
  get firstChild(){return this.children[0]||null}
  appendChild(child){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(x=>x!==child);
   this.children.push(child);child.parentNode=this;return child}
  append(...children){children.forEach(child=>this.appendChild(child))}
  setAttribute(k,v){this.attrs[k]=v}
  addEventListener(k,fn){this.listeners[k]=fn}
  querySelector(){return null}
 }
 doc.createElement=tag=>new FakeNode(tag);
 const row=new FakeNode('article');row.dataset.instructor='inst1';row.classList.add('instructorRosterCard');
 const original=[new FakeNode('avatar'),new FakeNode('personInfo'),new FakeNode('rosterActions')];
 original.forEach(x=>row.appendChild(x));
 const host={querySelectorAll:()=>[row]};
 const sandbox={window:{matchMedia:()=>({matches:true}),document:doc}};
 vm.runInNewContext(source,sandbox);
 sandbox.window.FLYMPUS_ROSTER_SWIPE.attach(host,true);
 assert.equal(row.children.length,2);
 const content=row.children[0],actions=row.children[1];
 assert.equal(content.className,'rosterSwipeContent');
 assert.deepEqual(content.children,original);
 assert.equal(actions.className,'rosterSwipeActionTray');
 assert.equal(actions.children.length,2);
 assert.equal(actions.children[0].dataset.personEdit,'INSTRUCTOR:inst1');
 assert.equal(actions.children[1].dataset.rosterRemove,'INSTRUCTOR:inst1');
 sandbox.window.FLYMPUS_ROSTER_SWIPE.attach(host,true);
 assert.equal(row.children.length,2,'repeated binding must not wrap twice');
});

test('Trainee rank and progress share the same horizontal compositor surface',()=>{
 const js=read('assets/roster-swipe-actions.js'),css=read('assets/roster-swipe-actions.css');
 assert.match(js,/content\.appendChild\(rank\)/);
 assert.match(js,/getBoundingClientRect\?\.\(\)/);
 for(const side of ['top','left','right'])assert.match(js,new RegExp('--roster-rank-'+side));
 assert.match(css,/\.rosterSwipeContent > \.rosterSwipeFixedRank\{/);
 assert.match(css,/transform:none!important;transition:none!important/);
 assert.doesNotMatch(css,/rosterSwipeRow > \.rosterSwipeFixedRank/);
 assert.match(css,/\.rosterSwipeMoving \.rosterSwipeContent\{transition:none!important\}/);
});

test('Roster swipe runs only on mobile, mirrors to RTL, and keeps the rank anchored to the original card corner',()=>{
 const js=read('assets/roster-swipe-actions.js'),css=read('assets/roster-swipe-actions.css');
 assert.match(js,/max-width: 759px/);
 assert.match(js,/const isHebrew=row=>/);
 assert.match(js,/const rank=content\.querySelector\?\.\('\.rankCorner'\)/);
 assert.match(js,/content\.appendChild\(rank\)/);
 assert.match(js,/--roster-rank-top/);
 assert.match(js,/--roster-rank-right/);
 assert.match(js,/--roster-rank-left/);
 assert.match(js,/rosterSwipeFixedRank/);
 assert.match(js,/const constrained=isHebrew\(row\)\?Math\.max\(0,offset\):Math\.min\(0,offset\)/);
 assert.match(css,/\.rosterSwipeContent > \.rosterSwipeFixedRank\{/);
 assert.match(css,/position:absolute!important;top:var\(--roster-rank-top,0px\)!important/);
 assert.match(css,/right:var\(--roster-rank-right,0px\)!important/);
 assert.match(css,/right:auto!important;left:var\(--roster-rank-left,0px\)!important/);
 assert.match(css,/transform:none!important;transition:none!important/);
 assert.doesNotMatch(css,/rosterSwipeRow > \.rosterSwipeFixedRank/);
 assert.match(css,/max-width:759px/);
});
test('Opaque contextual Edit and Remove panels are revealed by clipping, not blur/fade',()=>{
 const css=read('assets/roster-swipe-actions.css');
 assert.match(css,/\.rosterSwipeActionTray\{[\s\S]*?visibility:hidden/);
 assert.match(css,/filter:none!important/);
 assert.match(css,/transition:clip-path var\(--roster-motion-duration\)/);
 assert.doesNotMatch(css,/opacity:var\(--roster-swipe-reveal/);
 assert.doesNotMatch(css,/blur\(/);
 assert.match(css,/\.rosterSwipeOpen \.rosterSwipeActionTray\{[\s\S]*?visibility:visible/);
});

test('Roster action tray is fully concealed before swipe and progressively unclipped on drag',()=>{
 const js=read('assets/roster-swipe-actions.js'),css=read('assets/roster-swipe-actions.css');
 assert.match(css,/visibility:hidden/);
 assert.match(css,/clip-path:inset\(0 0 0 100%\)/);
 assert.match(css,/\.rosterSwipeMoving \.rosterSwipeActionTray\{[\s\S]*?clip-path:inset\(0 0 0 var\(--roster-swipe-clip,100%\)\)/);
 assert.match(css,/\.rosterSwipeSettling \.rosterSwipeActionTray\{[\s\S]*?clip-path:inset\(0 0 0 100%\)/);
 assert.match(js,/row\.style\.setProperty\('--roster-swipe-clip',\(100\*\(1-fraction\)\)\+'%'\)/);
 assert.match(js,/event\.propertyName==='transform'/);
 assert.doesNotMatch(css,/blur\(/);
});

test('Swipe settling and opaque action clipping share one damped horizontal rail',()=>{
 const css=read('assets/roster-swipe-actions.css');
 assert.match(css,/--roster-motion-duration:\.42s/);
 assert.match(css,/\.rosterSwipeSettling\{--roster-motion-duration:\.46s\}/);
 assert.match(css,/transition:transform var\(--roster-motion-duration\) var\(--roster-motion-easing\)/);
 assert.match(css,/transition:clip-path var\(--roster-motion-duration\) var\(--roster-motion-easing\)/);
 assert.doesNotMatch(css,/blur\(/);
 assert.match(css,/visibility:hidden/);
 assert.match(css,/--roster-motion-easing:cubic-bezier\(\.32,\.72,0,1\)/);
 assert.match(css,/touch-action:pan-y/);
});
