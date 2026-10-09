const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const T=require('../assets/fleet-timeline-layout.js');
const overlaps=(a,b)=>a.left<a.width+b.left+6&&b.left<b.width+a.left+6;
function assertValid(layout,width){
 assert.equal(layout.compact,false);
 for(const p of layout.placements){
  assert.ok(p.left>=0,'No item escapes left');
  assert.ok(p.left+p.width<=width,'No item escapes right');
  for(const other of layout.placements){
   if(other===p||other.lane!==p.lane)continue;
   assert.ok(!overlaps(p,other),'Labels collide on lane '+p.lane+': '+p.key+'/'+other.key);
  }
 }
}

const intersects=(a,b,box)=>{
 const left=box.left-4,right=box.left+box.width+4,top=box.top-4,bottom=box.top+29;
 if(a.x===b.x)return a.x>left&&a.x<right&&Math.max(Math.min(a.y,b.y),top)<Math.min(Math.max(a.y,b.y),bottom);
 if(a.y===b.y)return a.y>top&&a.y<bottom&&Math.max(Math.min(a.x,b.x),left)<Math.min(Math.max(a.x,b.x),right);
 return true;
};
test('07:50 and 08:00 keep a continuous visible leader that detours around the nearer clock',()=>{
 const box={left:1,width:62,top:111};
 const path=T.routeLeader({x:40,y:100},{x:40,y:171},[box],360,200);
 assert.ok(path&&path.length>=4,'Route must detour rather than mask or disappear');
 assert.deepEqual(path[0],{x:40,y:100});
 assert.deepEqual(path.at(-1),{x:40,y:171});
 for(let i=1;i<path.length;i++){
  assert.ok(path[i].x===path[i-1].x||path[i].y===path[i-1].y,'Connected orthogonal path');
  assert.equal(intersects(path[i-1],path[i],box),false,'No segment crosses 07:50');
 }
});
test('RTL and upper lane use the same connected obstacle-avoiding geometry',()=>{
 for(const [start,end,box] of [
  [{x:320,y:100},{x:320,y:171},{left:297,width:62,top:111}],
  [{x:40,y:100},{x:40,y:10},{left:1,width:62,top:48}]
 ]){
  const path=T.routeLeader(start,end,[box],360,200);
  assert.ok(path&&path.length>=4);
  assert.deepEqual(path[0],start);
  assert.deepEqual(path.at(-1),end);
  for(let i=1;i<path.length;i++)assert.equal(intersects(path[i-1],path[i],box),false);
 }
});
test('Dense labels never return a truncated line: route exists or compact fallback is required',()=>{
 const blocked=[{left:0,width:360,top:45}];
 assert.equal(T.routeLeader({x:50,y:50},{x:50,y:130},blocked,360,200),null);
});
test('Four clock boundaries and a narrow debrief stay legible using shared upper/lower lanes',()=>{
 const layout=T.planTimeline({
  width:360,
  phases:[
   {key:'brief',width:160,center:80,labelWidth:70,outsideWidth:92},
   {key:'flight',width:160,center:240,labelWidth:45,outsideWidth:70},
   {key:'debrief',width:40,center:340,labelWidth:80,outsideWidth:92}
  ],
  clocks:[
   {key:'briefing',x:0,width:57},{key:'takeoff',x:160,width:57},
   {key:'landing',x:320,width:57},{key:'debrief',x:360,width:57}
  ]
 });
 assertValid(layout,360);
 assert.deepEqual(layout.externalKeys,['debrief']);
 assert.equal(layout.placements.filter(p=>p.kind==='clock').length,4);
 assert.equal(layout.placements.filter(p=>p.kind==='phase').length,1);
 assert.ok(layout.topRows>=1&&layout.bottomRows>=1);
 assert.ok(layout.placements.find(p=>p.kind==='phase'&&p.key==='debrief').lane>=2);
});
test('Normal wide timeline keeps all full phase names internal and clocks on one lower row',()=>{
 const layout=T.planTimeline({
  width:820,
  phases:[
   {key:'brief',width:250,center:125,labelWidth:76,outsideWidth:95},
   {key:'flight',width:330,center:415,labelWidth:55,outsideWidth:79},
   {key:'debrief',width:240,center:700,labelWidth:84,outsideWidth:108}
  ],
  clocks:[
   {key:'briefing',x:0,width:58},{key:'takeoff',x:250,width:58},
   {key:'landing',x:580,width:58},{key:'debrief',x:820,width:58}
  ]
 });
 assertValid(layout,820);
 assert.deepEqual(layout.externalKeys,[]);
 assert.equal(layout.topRows,0);
 assert.equal(layout.bottomRows,1);
 assert.ok(layout.placements.every(p=>p.lane===0));
});
test('RTL uses physical phase boundaries without changing temporal semantics',()=>{
 const layout=T.planTimeline({
  width:360,
  phases:[
   {key:'brief',width:160,center:280,labelWidth:55,outsideWidth:78},
   {key:'flight',width:160,center:120,labelWidth:45,outsideWidth:70},
   {key:'debrief',width:40,center:20,labelWidth:65,outsideWidth:86}
  ],
  clocks:[
   {key:'briefing',x:360,width:57},{key:'takeoff',x:200,width:57},
   {key:'landing',x:40,width:57},{key:'debrief',x:0,width:57}
  ]
 });
 assertValid(layout,360);
 assert.deepEqual(layout.externalKeys,['debrief']);
 assert.deepEqual(layout.placements.filter(p=>p.kind==='clock').map(p=>p.key),['briefing','takeoff','landing','debrief']);
});
test('Zero-length stages and impossible phone width use full accessible compact fallback',()=>{
 const layout=T.planTimeline({
  width:85,
  phases:[
   {key:'brief',width:0,center:0,labelWidth:65,outsideWidth:80},
   {key:'flight',width:85,center:42,labelWidth:45,outsideWidth:70},
   {key:'debrief',width:0,center:85,labelWidth:78,outsideWidth:82}
  ],
  clocks:[
   {key:'briefing',x:0,width:62},{key:'takeoff',x:0,width:62},
   {key:'landing',x:85,width:62},{key:'debrief',x:85,width:62}
  ]
 });
 assert.equal(layout.compact,true);
});
test('Timeline integration renders all four clock keys, external names only, and caches adaptive files',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../assets/fleet-views.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../assets/fleet-operations.css'),'utf8');
 const worker=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 const engine=fs.readFileSync(path.join(__dirname,'../assets/fleet-timeline-layout.js'),'utf8');
 assert.match(view,/class="fleetTimeFlowBody"/);
 assert.match(view,/class="fleetTimeFlowFloatingLabels"/);
 assert.match(view,/class="fleetTimeFlowLeaders"/);
 assert.match(view,/class="fleetTimeFlowFallback"/);
 assert.match(view,/class="fleetTimeFlowDetails"/);
 assert.match(view,/data-flight-clock/);
 assert.match(html,/FLYMPUS_FLEET_TIMELINE_LAYOUT\?\.attach\?\./);
 assert.match(html,/updateTimelineLayout\?\.\(\)/);
 assert.match(css,/\.fleetTimeFlowAdaptive \.fleetTimeFlowBoundaryTimes/);
 assert.match(css,/\.fleetTimeFlowFloatingLabel/);
 assert.match(css,/\.fleetTimeFlowIsCompact/);

 // The formerly opaque clock background covered the 08:50 leader line.
 const clockCss=css.split('.fleetTimeFlowAdaptive .fleetTimeFlowClock{')[1]?.split('}')[0];
 assert.ok(clockCss,'Adaptive clock styles exist');
 assert.match(clockCss,/background:transparent/);
 assert.match(clockCss,/border:0;box-shadow:none/);
 assert.doesNotMatch(clockCss,/background:\s*(?:#fff|white|#[0-9a-f]{3,8})/i);
 assert.match(css,/html\[data-flympus-theme="dark"\] \.fleetTimeFlowAdaptive \.fleetTimeFlowClock\{background:transparent;color:#e2f0ff\}/);
 assert.match(css,/\.fleetTimeFlowLeaders path\{/);
 assert.match(css,/\.fleetTimeFlowAdaptive \.fleetTimeFlowClock strong\{/);

 assert.match(engine,/element\.textContent=phaseLabel\(item\.key\)/);
 assert.match(engine,/const measureBadge=label=>/);
 assert.match(engine,/width:max-content/);
 assert.match(engine,/prefsObserver\.observe/);

 // All paths are fully connected; no opaque mask may sever their strokes.
 assert.match(engine,/function routeLeader\(/);
 assert.match(engine,/const routes=result\.placements\.map\(item=>/);
 assert.match(engine,/route\.map\(\(p,i\)=>\(i\?'L':'M'\)/);
 assert.doesNotMatch(engine,/leaderGroup\.setAttribute\('mask'/);
 assert.match(engine,/if\(routes\.some\(route=>!route\)\)/);

 assert.match(engine,/document\.fonts\?\.ready/);
 assert.doesNotMatch(engine,/element\.textContent=phaseLabel\(item\.key\)\s*\+.*min/);
 for(const asset of ['fleet-timeline-layout.js','fleet-views.js','fleet-operations.css']){
  const version=asset==='fleet-timeline-layout.js'?'20261009-connected-leaders-0800':asset==='fleet-views.js'?'20261009-flight-drag-tabs-0810':asset==='fleet-operations.css'?'20261009-stable-plan-layout-0812':'20261009-plan-single-row-stable-drag-0815';
  assert.match(html,new RegExp('assets/'+asset.replace('.','\\.')+'\\?v='+version));
  assert.match(worker,new RegExp('assets/'+asset.replace('.','\\.')+'\\?v='+version));
 }
 assert.match(worker,/const FLYMPUS_SW_VERSION='2026-10-09-plan-single-row-stable-drag-0815'/);
 assert.match(html,/flympus-deploy-build" content="__FLYMPUS_DEPLOY_BUILD__"/);
});
