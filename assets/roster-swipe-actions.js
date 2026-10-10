/* Course Roster touch-only swipe actions. The app authorizes every destructive action separately. */
(function(root){
'use strict';
const attached=new WeakSet(),WIDTH=146,THRESHOLD=52;
const isHebrew=row=>row?.ownerDocument?.documentElement?.dataset?.flympusLanguage==='he';
const offsetFor=(row,open)=>open?(isHebrew(row)?WIDTH:-WIDTH):0;
let openRow=null;
/* Snap naturally from the exact touch displacement without a zero-offset flash. */
function settle(row,shouldOpen){
 if(!row)return;
 if(shouldOpen&&openRow&&openRow!==row)settle(openRow,false);
 if(row.classList.contains('rosterSwipeMoving'))row.querySelector('.rosterSwipeContent')?.getBoundingClientRect?.();
 // During closing, keep the clipped tray visible only until the horizontal
 // transform has reached zero; never show the hidden colored tray at rest.
 const draggedTrainee=!shouldOpen&&row.classList.contains('traineeRosterCard')&&row.classList.contains('rosterSwipeMoving');
 row.classList.toggle('rosterSwipeSettling',!shouldOpen&&(row.classList.contains('rosterSwipeOpen')||draggedTrainee||(!shouldOpen&&row.classList.contains('rosterSwipeMoving'))));
 row.classList.toggle('rosterSwipeOpen',shouldOpen);
 row.classList.remove('rosterSwipeMoving');
 row.style.setProperty('--roster-swipe-offset',offsetFor(row,shouldOpen)+'px');
 row.style.setProperty('--roster-swipe-reveal',shouldOpen?'1':'0');
 row.style.setProperty('--roster-swipe-clip',shouldOpen?'0%':'100%');
 if(shouldOpen)openRow=row;else if(openRow===row)openRow=null;
}
const close=row=>settle(row,false);
const open=row=>settle(row,true);
function touchDevice(){try{return root.matchMedia?.('(max-width: 759px) and (hover: none) and (pointer: coarse)')?.matches===true}catch{return false}}
function attach(host,canManage){
 if(!touchDevice()||!canManage||!host)return;
 host.querySelectorAll('.personCard.traineeRosterCard,.personCard.instructorRosterCard').forEach(row=>{
  if(attached.has(row))return;
  const kind=row.classList.contains('traineeRosterCard')?'TRAINEE':'INSTRUCTOR';
  const id=row.dataset.trainee||row.dataset.instructor||row.querySelector('[data-person-edit]')?.dataset.personEdit?.split(':').slice(1).join(':');
  if(!id)return;
  // Group the existing card children in ONE grid surface before applying transforms.
  // Reparenting preserves the actual DOM nodes, their listeners, and card click behavior.
  // Multiple independently transformed grid children caused Safari vertical jitter on close.
  const content=row.ownerDocument.createElement('div');
  content.className='rosterSwipeContent';
  while(row.firstChild)content.appendChild(row.firstChild);
  row.appendChild(content);
  // Keep the badge on the SAME horizontally translating rail as its text.
  // Never measure its inset while the wrapper still has pre-swipe grid geometry:
  // that measured the wrong grid column and pushed the rank off the card.
  const rank=content.querySelector?.('.rankCorner');
  if(rank){content.appendChild(rank);rank.classList.add('rosterSwipeFixedRank')}
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
   if(!claimed&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.25&&((isHebrew(row)?dx>0:dx<0)||start.open))claimed=true;
   if(!claimed)return;
   if(event.cancelable)event.preventDefault();
   row.classList.add('rosterSwipeMoving');
   const distance=isHebrew(row)?WIDTH:-WIDTH;
   const offset=Math.max(-WIDTH,Math.min(WIDTH,(start.open?distance:0)+dx));
   const constrained=isHebrew(row)?Math.max(0,offset):Math.min(0,offset);
   row.style.setProperty('--roster-swipe-offset',constrained+'px');
   const fraction=Math.abs(constrained)/WIDTH;
   row.style.setProperty('--roster-swipe-reveal',String(fraction));
   row.style.setProperty('--roster-swipe-clip',(100*(1-fraction))+'%');
  },{passive:false});
  row.addEventListener('touchend',event=>{
   if(!start)return;
   const t=event.changedTouches?.[0],dx=t?t.clientX-start.x:0;
   if(claimed){blockUntil=Date.now()+480;if(start.open?(isHebrew(row)?dx>-THRESHOLD:dx<THRESHOLD):(isHebrew(row)?dx>=THRESHOLD:dx<=-THRESHOLD))open(row);else close(row);if(event.cancelable)event.preventDefault()}
   start=null;claimed=false;
  },{passive:false});
  row.addEventListener('transitionend',event=>{
   if(event.target===content&&event.propertyName==='transform'&&!row.classList.contains('rosterSwipeOpen')){
    row.classList.remove('rosterSwipeSettling');
   }
  });
  row.addEventListener('touchcancel',()=>{start=null;claimed=false;close(row)});
  row.addEventListener('click',event=>{
   if(event.target?.closest?.('.rosterSwipeActionTray'))return;
   if(Date.now()<blockUntil||row.classList.contains('rosterSwipeOpen')){event.preventDefault();event.stopImmediatePropagation();if(Date.now()>=blockUntil)close(row)}
  },true);
  row.addEventListener('keydown',event=>{if(event.key==='Escape')close(row)});
 });
}
root.document?.addEventListener?.('pointerdown',event=>{if(openRow&&!openRow.contains(event.target))close(openRow)},true);
root.FLYMPUS_ROSTER_SWIPE=Object.freeze({attach,close});
})(window);
