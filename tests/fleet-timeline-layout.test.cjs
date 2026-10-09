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
 assert.match(engine,/element\.textContent=phaseLabel\(item\.key\)/);
 assert.match(engine,/const measureBadge=label=>/);
 assert.match(engine,/width:max-content/);
 assert.match(engine,/prefsObserver\.observe/);
 assert.match(engine,/document\.fonts\?\.ready/);
 assert.doesNotMatch(engine,/element\.textContent=phaseLabel\(item\.key\)\s*\+.*min/);
 for(const asset of ['fleet-timeline-layout.js','fleet-views.js','fleet-operations.css']){
  assert.match(html,new RegExp('assets/'+asset.replace('.','\\.')+'\\?v=20261009-adaptive-timeline-0797'));
  assert.match(worker,new RegExp('assets/'+asset.replace('.','\\.')+'\\?v=20261009-adaptive-timeline-0797'));
 }
 assert.match(worker,/const FLYMPUS_SW_VERSION='2026-10-09-adaptive-timeline-0797'/);
 assert.match(html,/build 0797/);
});
