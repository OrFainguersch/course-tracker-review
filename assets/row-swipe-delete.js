/* FLYMPUS row swipe reveal — additive shortcut only.
   The existing Remove button retains its own permission check and confirmation. */
(function(root){
 'use strict';
 const attached=new WeakSet();
 let openRow=null;
 const THRESHOLD=56;
 function close(row){
  if(!row)return;
  row.classList.remove('flympusSwipeOpen');
  const toggle=row.querySelector('.flympusSwipeDeleteAction');
  if(toggle)toggle.setAttribute('aria-expanded','false');
  if(openRow===row)openRow=null;
 }
 function open(row){
  if(openRow&&openRow!==row)close(openRow);
  row.classList.add('flympusSwipeOpen');
  const toggle=row.querySelector('.flympusSwipeDeleteAction');
  if(toggle)toggle.setAttribute('aria-expanded','true');
  openRow=row;
 }
 function eligible(row){
  if(!row||row.classList?.contains('fleetSortieDragGhost'))return null;
  // Explicit opt-in also works for other list rows with a confirmed delete handler.
  return row.querySelector?.('[data-flight-delete], [data-swipe-delete-target]')||null;
 }
 function install(row){
  if(attached.has(row))return;
  const original=eligible(row);
  if(!original)return;
  attached.add(row);
  const action=row.ownerDocument.createElement('button');
  action.type='button';
  action.className='flympusSwipeDeleteAction';
  const hebrew=row.ownerDocument.documentElement?.dataset?.flympusLanguage==='he';
  action.textContent=hebrew?'הסר':'Remove';
  action.setAttribute('aria-label',hebrew?'הצג אפשרות הסרה':'Remove this row');
  action.setAttribute('aria-expanded','false');
  action.addEventListener('click',event=>{
   event.stopPropagation();
   close(row);
   const target=eligible(row);
   if(target&&!target.disabled)target.click(); // original confirm + authorization
  });
  row.appendChild(action);
  let start=null,claimed=false,blockUntil=0;
  const blocked=target=>!!target?.closest?.('button,a,input,select,textarea,[contenteditable], [data-flight-drag], .fleetSortieDragHandle');
  row.addEventListener('touchstart',event=>{
   if(event.touches?.length!==1||blocked(event.target)||row.classList.contains('fleetSortieDragSource')){start=null;return}
   const touch=event.touches[0];
   start={x:touch.clientX,y:touch.clientY};
   claimed=false;
  },{passive:true});
  row.addEventListener('touchmove',event=>{
   if(!start||event.touches?.length!==1)return;
   const touch=event.touches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
   if(Math.abs(dy)>Math.abs(dx)*1.1&&Math.abs(dy)>10){start=null;return}
   if(Math.abs(dx)>13&&Math.abs(dx)>Math.abs(dy)*1.35&&(dx<0||row===openRow)){
    claimed=true;
    if(event.cancelable)event.preventDefault();
   }
  },{passive:false});
  row.addEventListener('touchend',event=>{
   if(!start)return;
   const touch=event.changedTouches?.[0];
   const dx=touch?touch.clientX-start.x:0;
   if(claimed){
    blockUntil=Date.now()+360;
    if(dx<=-THRESHOLD)open(row);
    else if(dx>=THRESHOLD)close(row);
    if(event.cancelable)event.preventDefault();
   }
   start=null;claimed=false;
  },{passive:false});
  row.addEventListener('touchcancel',()=>{start=null;claimed=false});
  row.addEventListener('click',event=>{
   if(Date.now()>=blockUntil||event.target===action)return;
   event.preventDefault();
   event.stopImmediatePropagation();
  },true);
  row.addEventListener('keydown',event=>{
   if(event.key==='Escape')close(row);
  });
 }
 function attach(container){
  if(!container?.querySelectorAll)return;
  container.querySelectorAll('.fleetSortie[data-flight-id], [data-swipe-delete-row]').forEach(install);
 }
 // Outside taps close the exposed action without affecting the tapped control.
 root.document?.addEventListener?.('pointerdown',event=>{
  if(openRow&&!openRow.contains(event.target))close(openRow);
 },true);
 root.FLYMPUS_ROW_SWIPE=Object.freeze({attach,close});
})(window);
