/* Course Roster touch-only swipe actions. The app authorizes every destructive action separately. */
(function(root){
'use strict';
const attached=new WeakSet(),WIDTH=146,THRESHOLD=52;
let openRow=null;
function close(row){
 if(!row)return;
 row.classList.remove('rosterSwipeOpen','rosterSwipeMoving');
 row.style.removeProperty('--roster-swipe-offset');
 if(openRow===row)openRow=null;
}
function open(row){
 if(openRow&&openRow!==row)close(openRow);
 row.classList.remove('rosterSwipeMoving');
 row.style.removeProperty('--roster-swipe-offset');
 row.classList.add('rosterSwipeOpen');openRow=row;
}
function touchDevice(){try{return root.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches===true}catch{return false}}
function attach(host,canManage){
 if(!touchDevice()||!canManage||!host)return;
 host.querySelectorAll('.personCard.traineeRosterCard,.personCard.instructorRosterCard').forEach(row=>{
  if(attached.has(row))return;
  const kind=row.classList.contains('traineeRosterCard')?'TRAINEE':'INSTRUCTOR';
  const id=row.dataset.trainee||row.dataset.instructor||row.querySelector('[data-person-edit]')?.dataset.personEdit?.split(':').slice(1).join(':');
  if(!id)return;
  attached.add(row);row.classList.add('rosterSwipeRow');
  const tray=row.ownerDocument.createElement('div');tray.className='rosterSwipeActionTray';
  const edit=row.ownerDocument.createElement('button');edit.type='button';edit.className='rosterSwipeEdit';edit.dataset.personEdit=kind+':'+id;
  const remove=row.ownerDocument.createElement('button');remove.type='button';remove.className='rosterSwipeRemove';remove.dataset.rosterRemove=kind+':'+id;
  const he=row.ownerDocument.documentElement?.dataset?.flympusLanguage==='he';
  edit.textContent=he?'עריכה':'Edit';remove.textContent=he?'הסרה':'Remove';
  edit.setAttribute('aria-label',he?'עריכת חבר סגל':'Edit roster member');
  remove.setAttribute('aria-label',he?'הסרה מהקורס':'Remove from course');
  tray.append(edit,remove);row.append(tray);
  let start=null,claimed=false,blockUntil=0;
  row.addEventListener('touchstart',event=>{
   if(event.touches?.length!==1||event.target?.closest?.('button,input,select,textarea,a,[contenteditable],.rosterSwipeActionTray')){start=null;return}
   const t=event.touches[0];start={x:t.clientX,y:t.clientY,open:row.classList.contains('rosterSwipeOpen')};claimed=false;
  },{passive:true});
  row.addEventListener('touchmove',event=>{
   if(!start||event.touches?.length!==1)return;
   const t=event.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
   if(!claimed&&Math.abs(dy)>Math.abs(dx)*1.1&&Math.abs(dy)>10){start=null;return}
   if(!claimed&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.3&&(dx<0||start.open))claimed=true;
   if(!claimed)return;
   if(event.cancelable)event.preventDefault();
   row.classList.add('rosterSwipeMoving');
   row.style.setProperty('--roster-swipe-offset',Math.max(-WIDTH,Math.min(0,(start.open?-WIDTH:0)+dx))+'px');
  },{passive:false});
  row.addEventListener('touchend',event=>{
   if(!start)return;
   const t=event.changedTouches?.[0],dx=t?t.clientX-start.x:0;
   if(claimed){blockUntil=Date.now()+480;if(start.open?dx<THRESHOLD:dx<=-THRESHOLD)open(row);else close(row);if(event.cancelable)event.preventDefault()}
   start=null;claimed=false;
  },{passive:false});
  row.addEventListener('touchcancel',()=>{start=null;claimed=false;close(row)});
  row.addEventListener('click',event=>{
   if(event.target?.closest?.('.rosterSwipeActionTray'))return;
   if(Date.now()<blockUntil||row.classList.contains('rosterSwipeOpen')){event.preventDefault();event.stopImmediatePropagation()}
  },true);
  row.addEventListener('keydown',event=>{if(event.key==='Escape')close(row)});
 });
}
root.document?.addEventListener?.('pointerdown',event=>{if(openRow&&!openRow.contains(event.target))close(openRow)},true);
root.FLYMPUS_ROSTER_SWIPE=Object.freeze({attach,close});
})(window);
