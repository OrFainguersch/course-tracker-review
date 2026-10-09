/* Stable touch/pen/mouse/keyboard reslotting of scheduled flights.
   Start-of-drag slot boundaries remain fixed in document coordinates while
   the source card animates, preventing iOS reorder jitter/oscillation. */
(function(root){
 'use strict';
 const insertionIndex=(pointerDocumentY,centers)=>{
  let index=0;
  for(const y of centers)if(pointerDocumentY>=y)index++;else break;
  return index;
 };
 function attach(board,{onDrop,onError}={}){
  if(!board||typeof onDrop!=='function')return;
  const rows=()=>[...board.querySelectorAll('.fleetSortie[data-flight-id]')];
  if(rows().length<2)return;
  const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  const positions=()=>new Map(rows().map(row=>[row,row.getBoundingClientRect()]));
  const animate=(before)=>{
   if(reduced())return;
   rows().forEach(row=>{
    const a=before.get(row),b=row.getBoundingClientRect();
    if(!a||!b)return;
    const dx=a.left-b.left,dy=a.top-b.top;
    if(Math.abs(dx)>1||Math.abs(dy)>1)row.animate?.(
     [{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],
     {duration:220,easing:'cubic-bezier(.22,.8,.24,1)'});
   });
  };
  const labels=()=>rows().map(row=>row.dataset.flightId);
  let busy=false,dragging=false;
  const commit=async oldOrder=>{
   const next=labels();
   if(next.every((id,i)=>id===oldOrder[i]))return;
   if(busy)return;
   busy=true;board.classList.add('fleetDragSaving');
   try{await onDrop(next)}catch(err){onError?.(err)}
   finally{board.classList.remove('fleetDragSaving');busy=false}
  };
  const revert=oldOrder=>{
   const before=positions(),byId=new Map(rows().map(row=>[row.dataset.flightId,row]));
   for(const id of oldOrder)if(byId.has(id))board.appendChild(byId.get(id));
   animate(before);
  };
  board.querySelectorAll('.fleetSortieDragHandle').forEach(handle=>{
   handle.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown'].includes(event.key)||busy||dragging)return;
    const row=handle.closest('.fleetSortie'),old=labels(),items=rows(),at=items.indexOf(row);
    const target=at+(event.key==='ArrowUp'?-1:1);
    if(at<0||target<0||target>=items.length)return;
    event.preventDefault();
    const before=positions();
    board.insertBefore(row,event.key==='ArrowUp'?items[target]:items[target].nextSibling);
    animate(before);
    void commit(old);
   });
   handle.addEventListener('pointerdown',event=>{
    if(busy||dragging||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
    const row=handle.closest('.fleetSortie');
    if(!row||row.parentElement!==board)return;
    event.preventDefault();event.stopPropagation();
    dragging=true;
    const oldOrder=labels(),origin=rows().indexOf(row),startRect=row.getBoundingClientRect();
    const scroll=()=>Number(root.scrollY||document.documentElement?.scrollTop||0);
    const startScroll=scroll();
    const centers=rows().filter(item=>item!==row).map(item=>{
     const box=item.getBoundingClientRect();
     return box.top+box.height/2+startScroll;
    });
    const pointer=event.pointerId,offsetY=event.clientY-startRect.top;
    let y=event.clientY,ended=false,raf=0,scrollRaf=0,velocity=0;
    let targetIndex=origin,committed=false;
    const clone=row.cloneNode(true);
    clone.classList.add('fleetSortieDragGhost');
    clone.querySelectorAll('button').forEach(button=>{button.disabled=true;button.tabIndex=-1});
    clone.removeAttribute('id');clone.removeAttribute('data-flight-id');
    Object.assign(clone.style,{
     position:'fixed',zIndex:'99999',pointerEvents:'none',margin:'0',boxSizing:'border-box',
     left:startRect.left+'px',top:startRect.top+'px',
     width:startRect.width+'px',height:startRect.height+'px'
    });
    document.body.appendChild(clone);
    row.classList.add('fleetSortieDragSource');
    handle.setAttribute('aria-grabbed','true');
    document.body.classList.add('flympusReordering');
    let lift=null;
    if(!reduced())lift=clone.animate?.([{transform:'scale(.99)'},{transform:'scale(1.015)'}],
     {duration:130,easing:'ease-out',fill:'forwards'});
    try{handle.setPointerCapture?.(pointer)}catch{}
    const paint=()=>{raf=0;if(!ended)clone.style.top=y-offsetY+'px'};
    const update=()=>{
     if(ended||Math.abs(y-event.clientY)<5)return;
     // Crucially, these boundaries NEVER come from the moving/animated DOM.
     const next=insertionIndex(y+scroll(),centers);
     if(next===targetIndex)return;
     targetIndex=next;
     const before=positions(),others=rows().filter(item=>item!==row);
     board.insertBefore(row,others[targetIndex]||null);
     animate(before);
    };
    const autoScroll=()=>{
     const height=root.innerHeight||document.documentElement?.clientHeight||0;
     const edge=Math.max(64,Math.min(96,height*.14));
     velocity=y<edge?-Math.min(16,Math.max(3,(edge-y)/5))
      :y>height-edge?Math.min(16,Math.max(3,(y-height+edge)/5)):0;
     if(velocity&&!scrollRaf){
      const tick=()=>{
       if(ended||!velocity){scrollRaf=0;return}
       root.scrollBy?.(0,velocity);
       update();
       scrollRaf=root.requestAnimationFrame(tick);
      };
      scrollRaf=root.requestAnimationFrame(tick);
     }
    };
    const move=ev=>{
     if(ended||ev.pointerId!==pointer)return;
     ev.preventDefault();y=ev.clientY;
     if(!raf)raf=root.requestAnimationFrame(paint);
     update();autoScroll();
    };
    const end=ev=>{
     if(ended||ev.pointerId!==pointer)return;
     ended=true;
     if(raf)root.cancelAnimationFrame(raf);
     if(scrollRaf)root.cancelAnimationFrame(scrollRaf);
     velocity=0;
     document.removeEventListener('pointermove',move);
     document.removeEventListener('pointerup',end);
     document.removeEventListener('pointercancel',end);
     try{handle.releasePointerCapture?.(pointer)}catch{}
     handle.removeAttribute('aria-grabbed');
     document.body.classList.remove('flympusReordering');
     try{lift?.cancel?.()}catch{}
     const cancelled=ev.type==='pointercancel';
     const settle=()=>{
      if(committed)return;
      committed=true;clone.remove();
      row.classList.remove('fleetSortieDragSource');
      dragging=false;
      if(cancelled){revert(oldOrder);return}
      if(targetIndex!==origin)void commit(oldOrder);
     };
     const last=row.getBoundingClientRect();
     if(reduced()){settle();return}
     const animation=clone.animate?.([
       {transform:'scale(1.015)',top:clone.style.top,left:clone.style.left},
       {transform:'scale(1)',top:last.top+'px',left:last.left+'px'}
      ],{duration:175,easing:'cubic-bezier(.22,.8,.24,1)'});
     if(animation?.finished)animation.finished.then(settle,settle);
     else root.setTimeout(settle,180);
    };
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',end);
    document.addEventListener('pointercancel',end);
   });
  });
 }
 root.FLYMPUS_FLIGHT_DRAG=Object.freeze({attach,insertionIndex});
})(window);
