/* FLYMPUS scheduled-flight drag ordering: touch, pen, mouse and keyboard.
   Rows move visually with the same lifted-clone/FLIP cadence as course syllabi.
   Only the supplied callback may commit a validated time-slot exchange. */
(function(root){
 'use strict';
 function attach(board,{onDrop,onError}={}){
  if(!board||typeof onDrop!=='function')return;
  const rows=()=>[...board.querySelectorAll('.fleetSortie[data-flight-id]')];
  if(rows().length<2)return;
  const reduce=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  const positions=()=>new Map(rows().map(row=>[row,row.getBoundingClientRect()]));
  const animate=(before)=>{
   if(reduce())return;
   rows().forEach(row=>{
    const a=before.get(row),b=row.getBoundingClientRect();if(!a||!b)return;
    const dx=a.left-b.left,dy=a.top-b.top;
    if(Math.abs(dx)>1||Math.abs(dy)>1)row.animate?.([
     {transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}
    ],{duration:220,easing:'cubic-bezier(.22,.8,.24,1)'});
   });
  };
  const labels=()=>rows().map(row=>row.dataset.flightId);
  let busy=false;
  const commit=async(oldOrder)=>{
   const next=labels();
   if(next.every((id,i)=>id===oldOrder[i]))return;
   if(busy)return;
   busy=true;
   board.classList.add('fleetDragSaving');
   try{await onDrop(next)}
   catch(err){onError?.(err)}
   finally{board.classList.remove('fleetDragSaving');busy=false}
  };
  board.querySelectorAll('.fleetSortieDragHandle').forEach(handle=>{
   handle.addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown'].includes(e.key)||busy)return;
    const row=handle.closest('.fleetSortie'),old=labels(),items=rows(),i=items.indexOf(row);
    const next=i+(e.key==='ArrowUp'?-1:1);
    if(i<0||next<0||next>=items.length)return;
    e.preventDefault();
    const before=positions();
    board.insertBefore(row,e.key==='ArrowUp'?items[next]:items[next].nextSibling);
    animate(before);
    void commit(old);
   });
   handle.addEventListener('pointerdown',e=>{
    if(busy||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
    const row=handle.closest('.fleetSortie');
    if(!row||row.parentElement!==board)return;
    e.preventDefault();e.stopPropagation();
    const first=positions(),old=labels(),box=row.getBoundingClientRect();
    const pointer=e.pointerId,delta=e.clientY-box.top,initialY=e.clientY;
    let y=e.clientY,changed=false,finished=false,raf=0,scrollRaf=0,speed=0;
    const clone=row.cloneNode(true);
    clone.classList.add('fleetSortieDragGhost');
    clone.querySelectorAll('button').forEach(b=>{b.disabled=true;b.tabIndex=-1});
    clone.removeAttribute('data-flight-id');
    Object.assign(clone.style,{
     position:'fixed',zIndex:'99999',pointerEvents:'none',
     margin:'0',boxSizing:'border-box',left:box.left+'px',top:box.top+'px',
     width:box.width+'px',height:box.height+'px'
    });
    document.body.appendChild(clone);
    row.classList.add('fleetSortieDragSource');
    handle.setAttribute('aria-grabbed','true');
    document.body.classList.add('flympusReordering');
    if(!reduce())clone.animate?.([{transform:'scale(.99)'},{transform:'scale(1.025)'}],{duration:135,fill:'forwards'});
    try{handle.setPointerCapture?.(pointer)}catch{}
    const paint=()=>{raf=0;if(!finished)clone.style.top=y-delta+'px'};
    const update=()=>{
     if(finished||Math.abs(y-initialY)<4)return;
     const others=rows().filter(item=>item!==row);
     const beforeRow=others.find(item=>{const rect=item.getBoundingClientRect();return y<rect.top+rect.height/2})||null;
     if(row.nextElementSibling===beforeRow||(!row.nextElementSibling&&!beforeRow))return;
     const previous=positions();
     board.insertBefore(row,beforeRow);
     changed=true;animate(previous);
    };
    const autoscroll=()=>{
     const height=root.innerHeight||document.documentElement.clientHeight||0;
     const edge=Math.max(64,Math.min(96,height*.14));
     speed=y<edge?-Math.min(16,Math.max(3,(edge-y)/5)):y>height-edge?Math.min(16,Math.max(3,(y-height+edge)/5)):0;
     if(speed&&!scrollRaf){
      const tick=()=>{if(finished||!speed){scrollRaf=0;return}root.scrollBy?.(0,speed);update();scrollRaf=root.requestAnimationFrame(tick)};
      scrollRaf=root.requestAnimationFrame(tick);
     }
    };
    const move=ev=>{
     if(finished||ev.pointerId!==pointer)return;
     ev.preventDefault();y=ev.clientY;
     if(!raf)raf=root.requestAnimationFrame(paint);
     update();autoscroll();
    };
    const end=ev=>{
     if(finished||ev.pointerId!==pointer)return;
     finished=true;
     if(raf)root.cancelAnimationFrame(raf);
     if(scrollRaf)root.cancelAnimationFrame(scrollRaf);
     speed=0;
     document.removeEventListener('pointermove',move);
     document.removeEventListener('pointerup',end);
     document.removeEventListener('pointercancel',end);
     try{handle.releasePointerCapture?.(pointer)}catch{}
     handle.removeAttribute('aria-grabbed');
     document.body.classList.remove('flympusReordering');
     const cancelled=ev.type==='pointercancel';
     const finish=()=>{
      clone.remove();
      row.classList.remove('fleetSortieDragSource');
      if(cancelled){const map=new Map(rows().map(item=>[item.dataset.flightId,item]));old.forEach(id=>board.appendChild(map.get(id)));return}
      if(changed)void commit(old);
     };
     const rect=row.getBoundingClientRect();
     if(reduce()){finish();return}
     clone.animate?.([{transform:'scale(1.025)',top:clone.style.top,left:clone.style.left},
       {transform:'scale(1)',top:rect.top+'px',left:rect.left+'px'}],
       {duration:180,easing:'cubic-bezier(.22,.8,.24,1)'}).finished.then(finish,finish);
     if(!clone.getAnimations?.().length)root.setTimeout(finish,185);
    };
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',end);
    document.addEventListener('pointercancel',end);
   });
  });
 }
 root.FLYMPUS_FLIGHT_DRAG=Object.freeze({attach});
})(window);
