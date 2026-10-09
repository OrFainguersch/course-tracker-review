/* FLYMPUS calculated timeline: collision-aware labels, never edits flight data. */
(function(root){
'use strict';
const PHASE_KEYS=['brief','flight','debrief'];
const CLOCK_KEYS=['briefing','takeoff','landing','debrief'];
const GAP=6;
const ROW=31;
const clamp=(n,low,high)=>Math.min(Math.max(n,low),high);

/* Pure and deterministic: candidates share the same four rows, so phase names
   and clocks cannot occupy the same space. All x values are physical pixels;
   the caller converts RTL phase boundaries before invoking this function. */
function planTimeline({width,phases,clocks}){
 const widthPx=Number(width);
 if(!Number.isFinite(widthPx)||widthPx<1)return {compact:true,placements:[],externalKeys:[],topRows:0,bottomRows:0};
 const placements=[],occupied=[[],[],[],[]];
 const externalKeys=phases.filter(p=>p.width<p.labelWidth+10).map(p=>p.key);
 const outside=phases.filter(p=>externalKeys.includes(p.key)).map(p=>({
  kind:'phase',key:p.key,x:p.center,width:p.outsideWidth,
  preferences:[2,3,0,1]
 }));
 const times=clocks.map(c=>({kind:'clock',key:c.key,x:c.x,width:c.width,preferences:[0,2,1,3]}));
 // Lane codes: 0=bottom-near, 1=bottom-far, 2=top-near, 3=top-far.
 for(const item of [...outside,...times]){
  const boxWidth=Math.ceil(item.width);
  if(!Number.isFinite(boxWidth)||boxWidth>widthPx-2)return {compact:true,placements:[],externalKeys,topRows:0,bottomRows:0};
  const left=clamp(item.x-boxWidth/2,1,widthPx-boxWidth-1);
  let lane=-1;
  for(const candidate of item.preferences){
   if(occupied[candidate].every(p=>left>=p.right+GAP||left+boxWidth+GAP<=p.left)){lane=candidate;break}
  }
  if(lane<0)return {compact:true,placements:[],externalKeys,topRows:0,bottomRows:0};
  occupied[lane].push({left,right:left+boxWidth});
  placements.push({kind:item.kind,key:item.key,x:item.x,left,width:boxWidth,lane});
 }
 const topRows=occupied[3].length?2:occupied[2].length?1:0;
 const bottomRows=occupied[1].length?2:occupied[0].length?1:0;
 return {compact:false,placements,externalKeys,topRows,bottomRows};
}
function attach(flow,form){
 if(!flow||!form||!root.document)return ()=>{};
 if(attach.active)attach.active.dispose();
 const body=flow.querySelector('.fleetTimeFlowBody');
 const track=flow.querySelector('.fleetTimeFlowTrack');
 const clockArea=flow.querySelector('.fleetTimeFlowBoundaryTimes');
 const labelArea=flow.querySelector('.fleetTimeFlowFloatingLabels');
 const leaderArea=flow.querySelector('.fleetTimeFlowLeaders');
 const fallback=flow.querySelector('.fleetTimeFlowFallback');
 const info=flow.querySelector('.fleetTimeFlowDetails');
 if(!body||!track||!clockArea||!labelArea||!leaderArea||!fallback)return ()=>{};
 const measureCanvas=root.document.createElement('canvas');
 const context=measureCanvas.getContext('2d');
 const measure=(el,value,extra)=>{
  const style=root.getComputedStyle(el);
  if(context)context.font=style.font;
  const textWidth=context?context.measureText(String(value||'')).width:String(value||'').length*9;
  return Math.ceil(textWidth+extra);
 };
 const phaseEls=PHASE_KEYS.map(key=>track.querySelector('[data-phase="'+key+'"]'));
 const clockEls=CLOCK_KEYS.map(key=>clockArea.querySelector('[data-flight-clock="'+key+'"]')?.closest('.fleetTimeFlowClock'));
 let scheduled=false,observer=null,prefsObserver=null,selected='',disposed=false;
 const phaseLabel=key=>phaseEls[PHASE_KEYS.indexOf(key)]?.querySelector('.fleetTimeFlowPhaseText')?.textContent||key;
 const measureBadge=label=>{
  const sample=root.document.createElement('span');
  sample.className='fleetTimeFlowFloatingLabel';
  sample.textContent=label;
  sample.style.cssText='position:absolute;visibility:hidden;left:0;top:0;width:max-content;pointer-events:none';
  labelArea.append(sample);
  const width=Math.ceil(sample.getBoundingClientRect().width+2);
  sample.remove();
  return width;
 };
 const draw=()=>{
  scheduled=false;
  if(disposed||!flow.isConnected){return}
  const rect=track.getBoundingClientRect();
  const width=rect.width;
  if(width<20||phaseEls.some(x=>!x)||clockEls.some(x=>!x))return;
  const rtl=root.getComputedStyle(track).direction==='rtl';
  const segments=phaseEls.map(x=>x.getBoundingClientRect());
  const physicalX=(x)=>x-rect.left;
  const ends=rtl?[segments[0].right,segments[0].left,segments[1].left,segments[2].left]:
                 [segments[0].left,segments[0].right,segments[1].right,segments[2].right];
  const iconVisible=root.getComputedStyle(phaseEls[0].querySelector('.fleetTimeFlowIcon')).display!=='none';
  const phases=phaseEls.map((el,i)=>{
   const labelEl=el.querySelector('.fleetTimeFlowPhaseText');
   const label=labelEl.textContent;
   const piece=segments[i];
   return {key:PHASE_KEYS[i],width:piece.width,center:physicalX((piece.left+piece.right)/2),
    labelWidth:measure(labelEl,label,iconVisible?33:9),
    outsideWidth:measureBadge(label)};
  });
  const clocks=clockEls.map((el,i)=>{
   const strong=el.querySelector('strong');
   return {key:CLOCK_KEYS[i],x:clamp(physicalX(ends[i]),0,width),
    width:measure(strong,strong.textContent,12)};
  });
  const result=planTimeline({width,phases,clocks});
  flow.classList.add('fleetTimeFlowAdaptive');
  flow.classList.toggle('fleetTimeFlowIsCompact',result.compact);
  phaseEls.forEach((el,i)=>el.classList.toggle('fleetTimeFlowPhaseExternal',result.compact||result.externalKeys.includes(PHASE_KEYS[i])));
  labelArea.replaceChildren();
  leaderArea.replaceChildren();
  if(result.compact){
   body.style.paddingTop='0px';
   body.style.paddingBottom='0px';
   fallback.replaceChildren();
   const names=root.document.createElement('div');
   names.className='fleetTimeFlowFallbackPhases';
   for(const key of PHASE_KEYS){
    const chip=root.document.createElement('span');chip.dataset.phase=key;chip.textContent=phaseLabel(key);names.append(chip);
   }
   const values=root.document.createElement('div');
   values.className='fleetTimeFlowFallbackClocks';
   for(let i=0;i<CLOCK_KEYS.length;i++){
    const item=root.document.createElement('div');
    const title=root.document.createElement('small');
    title.textContent=clockEls[i].getAttribute('aria-label')||CLOCK_KEYS[i];
    const value=root.document.createElement('strong');value.dir='ltr';value.textContent=clockEls[i].querySelector('strong').textContent;
    item.append(title,value);values.append(item);
   }
   fallback.append(names,values);
   fallback.hidden=false;
   return;
  }
  fallback.hidden=true;
  const topPad=result.topRows?result.topRows*ROW+9:0;
  const bottomPad=result.bottomRows?result.bottomRows*ROW+12:0;
  body.style.paddingTop=topPad+'px';
  body.style.paddingBottom=bottomPad+'px';
  // Track is normal-flow content; overlays are absolutely positioned within body.
  const bodyRect=body.getBoundingClientRect();
  const shiftX=rect.left-bodyRect.left;
  const barY=track.offsetTop;
  const barBottom=barY+track.offsetHeight;
  leaderArea.setAttribute('viewBox','0 0 '+Math.ceil(bodyRect.width)+' '+Math.ceil(body.offsetHeight));
  leaderArea.setAttribute('preserveAspectRatio','none');
  for(const item of result.placements){
   const top=item.lane>=2;
   const depth=top?item.lane-2:item.lane;
   const y=top?topPad-(depth+1)*ROW:barBottom+10+depth*ROW;
   let element;
   if(item.kind==='clock'){
    element=clockEls[CLOCK_KEYS.indexOf(item.key)];
    element.style.left=(shiftX+item.left)+'px';
    element.style.top=y+'px';
    element.style.width=item.width+'px';
   }else{
    element=root.document.createElement('button');
    element.type='button';
    element.className='fleetTimeFlowFloatingLabel';
    element.dataset.phaseDetail=item.key;
    element.dataset.phase=item.key;
    element.textContent=phaseLabel(item.key);
    element.style.left=(shiftX+item.left)+'px';
    element.style.top=y+'px';
    element.style.width=item.width+'px';
    labelArea.append(element);
   }
   const anchorX=shiftX+item.x;
   const targetX=shiftX+item.left+item.width/2;
   const startY=top?barY:barBottom;
   const endY=top?y+25:y-2;
   const path=root.document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d','M'+anchorX+' '+startY+' L'+anchorX+' '+(startY+(endY-startY)*0.55)+' L'+targetX+' '+endY);
   path.setAttribute('class',item.kind==='phase'?'fleetTimeFlowPhaseLeader':'fleetTimeFlowClockLeader');
   leaderArea.append(path);
  }
 };
 const queue=()=>{
  if(disposed||scheduled)return;
  scheduled=true;
  if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(draw);
  else draw();
 };
 const showPhase=key=>{
  if(!info)return;
  if(selected===key&&!info.hidden){info.hidden=true;selected='';return}
  const fields={brief:'briefingMinutes',flight:'estimatedMinutes',debrief:'debriefMinutes'};
  const bounds={brief:['briefing','takeoff'],flight:['takeoff','landing'],debrief:['landing','debrief']};
  const minutes=Number(form.querySelector('[name="'+fields[key]+'"]')?.value||0);
  const [a,b]=bounds[key].map(k=>clockArea.querySelector('[data-flight-clock="'+k+'"]')?.textContent||'—');
  const he=root.FLYMPUS_FLEET_LANGUAGE?.()==='he';
  info.textContent=phaseLabel(key)+' · '+minutes+(he?' דקות':' min')+' · '+a+' – '+b;
  info.hidden=false;selected=key;
 };
 const onClick=e=>{
  const target=e.target.closest('[data-phase-detail],.fleetTimeFlowTrack [data-phase]');
  if(!target||!flow.contains(target))return;
  const key=target.dataset.phaseDetail||target.dataset.phase;
  if(PHASE_KEYS.includes(key))showPhase(key);
 };
 const onKey=e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const target=e.target.closest('.fleetTimeFlowTrack [data-phase]');
  if(target){e.preventDefault();showPhase(target.dataset.phase)}
 };
 for(const el of phaseEls){
  if(el){el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',phaseLabel(el.dataset.phase));}
 }
 flow.addEventListener('click',onClick);
 flow.addEventListener('keydown',onKey);
 root.addEventListener('resize',queue,{passive:true});
 if(typeof root.ResizeObserver==='function'){
  observer=new root.ResizeObserver(queue);
  observer.observe(track);
 }
 // Large-text and language preference changes can occur without a window resize.
 if(typeof root.MutationObserver==='function'){
  prefsObserver=new root.MutationObserver(queue);
  prefsObserver.observe(root.document.documentElement,{attributes:true,
   attributeFilter:['class','data-flympus-language','data-flympus-theme']});
 }
 root.document.fonts?.ready?.then(queue).catch(()=>{});
 const dispose=()=>{
  if(disposed)return;
  disposed=true;observer?.disconnect();prefsObserver?.disconnect();
  root.removeEventListener('resize',queue);
  flow.removeEventListener('click',onClick);flow.removeEventListener('keydown',onKey);
 };
 attach.active={dispose};
 queue();
 return queue;
}
const api={planTimeline,attach};
root.FLYMPUS_FLEET_TIMELINE_LAYOUT=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
