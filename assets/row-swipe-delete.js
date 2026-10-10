/* Swipe-to-reveal Remove: only the inner card slides.
   Outer row stays stable for flight reorder/FLIP; existing delete confirmation is reused. */
(function(root){
 'use strict';
 const bound=new WeakSet();
 let openRow=null;
 const WIDTH=94,THRESHOLD=44;
 const removeTarget=row=>row?.querySelector?.('[data-flight-delete],[data-swipe-delete-target]')||null;
 const slide=row=>row?.querySelector?.('.fleetSortieSlide');
 function close(row){
  if(!row)return;
  slide(row)?.style?.removeProperty('transform');
  row.classList.remove('flympusSwipeOpen','flympusSwipeTracking');
  row.querySelector('.flympusSwipeDeleteAction')?.setAttribute('aria-expanded','false');
  if(openRow===row)openRow=null;
 }
 function open(row){
  if(!row)return;
  if(openRow&&openRow!==row)close(openRow);
  slide(row)?.style?.removeProperty('transform');
  row.classList.remove('flympusSwipeTracking');
  row.classList.add('flympusSwipeOpen');
  row.querySelector('.flympusSwipeDeleteAction')?.setAttribute('aria-expanded','true');
  openRow=row;
 }
 function install(row){
  if(bound.has(row)||row.classList?.contains('fleetSortieDragGhost'))return;
  if(!removeTarget(row)||!slide(row))return;
  bound.add(row);
  const button=row.ownerDocument.createElement('button');
  button.type='button';button.className='flympusSwipeDeleteAction';
  const he=row.ownerDocument.documentElement?.dataset?.flympusLanguage==='he';
  button.textContent=he?'הסר':'Remove';
  button.setAttribute('aria-label',he?'מחיקת הטיסה':'Remove scheduled flight');
  button.setAttribute('aria-expanded','false');
  button.addEventListener('click',event=>{
   event.stopPropagation();
   close(row);
   const target=removeTarget(row);
   if(target&&!target.disabled)target.click(); // original permission and confirmation
  });
  row.appendChild(button);
  let start=null,claimed=false,blockUntil=0;
  const blocked=t=>!!t?.closest?.('button,a,input,select,textarea,[contenteditable],[data-flight-drag],.fleetSortieDragHandle');
  row.addEventListener('touchstart',event=>{
   if(event.touches?.length!==1||blocked(event.target)||row.classList.contains('fleetSortieDragSource')){start=null;return}
   const t=event.touches[0];
   start={x:t.clientX,y:t.clientY,open:row.classList.contains('flympusSwipeOpen')};
   claimed=false;
  },{passive:true});
  row.addEventListener('touchmove',event=>{
   if(!start||event.touches?.length!==1)return;
   const t=event.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
   if(!claimed&&Math.abs(dy)>Math.abs(dx)*1.1&&Math.abs(dy)>10){start=null;return}
   if(!claimed&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.3&&(dx<0||start.open))claimed=true;
   if(!claimed)return;
   if(event.cancelable)event.preventDefault();
   row.classList.add('flympusSwipeTracking');
   slide(row).style.transform='translate3d('+Math.min(0,Math.max(-WIDTH,(start.open?-WIDTH:0)+dx))+'px,0,0)';
  },{passive:false});
  row.addEventListener('touchend',event=>{
   if(!start)return;
   const t=event.changedTouches?.[0],dx=t?t.clientX-start.x:0;
   if(claimed){
    blockUntil=Date.now()+450;
    if(start.open?dx<THRESHOLD:dx<=-THRESHOLD)open(row);
    else close(row);
    if(event.cancelable)event.preventDefault();
   }
   start=null;claimed=false;
  },{passive:false});
  row.addEventListener('touchcancel',()=>{start=null;claimed=false;close(row)});
  row.addEventListener('click',event=>{
   if(Date.now()>=blockUntil||event.target===button)return;
   event.preventDefault();event.stopImmediatePropagation();
  },true);
  row.addEventListener('pointerdown',event=>{
   if(event.target?.closest?.('[data-flight-drag]'))close(row);
  },true);
  row.addEventListener('keydown',event=>{if(event.key==='Escape')close(row)});
 }
 function attach(container){
  if(!container?.querySelectorAll)return;
  container.querySelectorAll('.fleetSortie[data-flight-id],[data-swipe-delete-row]').forEach(install);
 }
 root.document?.addEventListener?.('pointerdown',event=>{
  if(openRow&&!openRow.contains(event.target))close(openRow);
 },true);
 root.FLYMPUS_ROW_SWIPE=Object.freeze({attach,close});
})(window);
