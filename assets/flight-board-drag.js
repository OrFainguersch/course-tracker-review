/* FLYMPUS flight-card reslotting: stable iOS touch interactions.
   Drag is preview-only; DOM rows never change order before a validated write.
   Ghost remains in its original board to inherit identical responsive styles. */
(function(root){
 'use strict';
 const insertionIndex=(documentY,centers)=>{
  let index=0;
  for(const center of centers)if(documentY>=center)index++;else break;
  return index;
 };
 const movedIds=(original,from,to)=>{
  const order=original.slice();
  if(from<0||to<0||from>=order.length||to>=order.length)return order;
  const [item]=order.splice(from,1);
  order.splice(to,0,item);
  return order;
 };
 function attach(board,{onDrop,onError}={}){
  if(!board||typeof onDrop!=='function')return;
  const rows=()=>[...board.querySelectorAll('.fleetSortie[data-flight-id]')];
  if(rows().length<2)return;
  const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  const labels=()=>rows().map(item=>item.dataset.flightId);
  let busy=false,dragging=false;
  const commit=async next=>{
   // Do not insert live rows into the DOM: old timestamps and crews would
   // flash in the wrong slots before the asynchronous Plan update rerenders.
   if(busy||next.every((id,index)=>labels()[index]===id))return;
   busy=true;board.classList.add('fleetDragSaving');
   try{await onDrop(next)}
   catch(error){onError?.(error)}
   finally{board.classList.remove('fleetDragSaving');busy=false}
  };
  board.querySelectorAll('.fleetSortieDragHandle').forEach(handle=>{
   handle.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown'].includes(event.key)||busy||dragging)return;
    const source=handle.closest('.fleetSortie'),order=labels(),index=order.indexOf(source?.dataset.flightId);
    const dest=index+(event.key==='ArrowUp'?-1:1);
    if(index<0||dest<0||dest>=order.length)return;
    event.preventDefault();
    void commit(movedIds(order,index,dest));
   });
   handle.addEventListener('pointerdown',event=>{
    if(busy||dragging||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
    const source=handle.closest('.fleetSortie');
    if(!source||source.parentElement!==board)return;
    event.preventDefault();event.stopPropagation();
    dragging=true;
    const items=rows(),original=labels(),origin=items.indexOf(source);
    const sourceBox=source.getBoundingClientRect();
    const scroll=()=>Number(root.scrollY||document.documentElement?.scrollTop||0);
    const initialScroll=scroll(),startY=event.clientY,pointer=event.pointerId;
    const startingBoxes=items.map(item=>item.getBoundingClientRect());
    const peers=items.filter(item=>item!==source);
    const centers=peers.map(item=>{
     const rect=item.getBoundingClientRect();
     return rect.top+rect.height/2+initialScroll;
    });
    const height=sourceBox.height,gap=Number.parseFloat(root.getComputedStyle?.(board)?.rowGap)||11;
    const displacement=height+gap;
    const offsetY=startY-sourceBox.top;
    let y=startY,targetIndex=origin,active=false,ended=false,clone=null;
    let paintFrame=0,autoFrame=0,velocity=0;
    try{handle.setPointerCapture?.(pointer)}catch{}
    // Neither a tap nor an incidental scroll creates a ghost or changes
    // a platform badge. Only a deliberate >7px drag starts the animation.
    const lift=()=>{
     if(active)return;
     active=true;
     clone=source.cloneNode(true);
     clone.classList.add('fleetSortieDragGhost');
     clone.removeAttribute('data-flight-id');clone.removeAttribute('id');
     clone.querySelectorAll('button').forEach(button=>{button.disabled=true;button.tabIndex=-1});
     Object.assign(clone.style,{
      position:'fixed',zIndex:'99999',pointerEvents:'none',margin:'0',
      boxSizing:'border-box',left:sourceBox.left+'px',top:sourceBox.top+'px',
      width:sourceBox.width+'px',height:sourceBox.height+'px'
     });
     // Keep the ghost inside the original board. Appending to body made
     // .fleetBookedFlights selectors inapplicable and broke Shahak-02.
     board.appendChild(clone);
     source.classList.add('fleetSortieDragSource');
     handle.setAttribute('aria-grabbed','true');
     document.body.classList.add('flympusReordering');
     clone.style.transform='scale(1.012)';
    };
    const preview=()=>{
     if(ended||!active)return;
     const next=insertionIndex(y+scroll(),centers);
     if(next===targetIndex)return;
     targetIndex=next;
     peers.forEach((peer,index)=>{
      let offset=0;
      if(targetIndex>origin&&index>=origin&&index<targetIndex)offset=-displacement;
      if(targetIndex<origin&&index>=targetIndex&&index<origin)offset=displacement;
      peer.style.transition=reduced()?'none':'transform 180ms cubic-bezier(.22,.8,.24,1)';
      peer.style.transform=offset?'translateY('+offset+'px)':'';
     });
    };
    const paint=()=>{paintFrame=0;if(!ended&&clone)clone.style.top=y-offsetY+'px'};
    const autoScroll=()=>{
     // The bottom navigation occupies the viewport edge on iOS. For a short
     // list, autoscrolling there causes page jumps, not useful rescheduling.
     if(items.length<=3){velocity=0;return}
     const viewport=root.innerHeight||document.documentElement?.clientHeight||0;
     const edge=Math.max(60,Math.min(88,viewport*.12));
     const bounds=board.getBoundingClientRect();
     velocity=(y<edge&&bounds.top<edge-10)?-Math.min(12,Math.max(2,(edge-y)/6))
      :(y>viewport-edge&&bounds.bottom>viewport-edge+10)?Math.min(12,Math.max(2,(y-viewport+edge)/6)):0;
     if(velocity&&!autoFrame){
      const tick=()=>{
       if(ended||!velocity){autoFrame=0;return}
       root.scrollBy?.(0,velocity);
       preview();
       autoFrame=root.requestAnimationFrame(tick);
      };
      autoFrame=root.requestAnimationFrame(tick);
     }
    };
    const move=ev=>{
     if(ended||ev.pointerId!==pointer)return;
     ev.preventDefault();y=ev.clientY;
     if(!active&&Math.abs(y-startY)<8)return;
     lift();
     if(!paintFrame)paintFrame=root.requestAnimationFrame(paint);
     preview();autoScroll();
    };
    const clean=()=>{
     peers.forEach(peer=>{peer.style.transform='';peer.style.transition=''});
     clone?.remove();
     source.classList.remove('fleetSortieDragSource');
     handle.removeAttribute('aria-grabbed');
     document.body.classList.remove('flympusReordering');
     dragging=false;
    };
    const end=ev=>{
     if(ended||ev.pointerId!==pointer)return;
     ended=true;velocity=0;
     if(paintFrame)root.cancelAnimationFrame(paintFrame);
     if(autoFrame)root.cancelAnimationFrame(autoFrame);
     document.removeEventListener('pointermove',move);
     document.removeEventListener('pointerup',end);
     document.removeEventListener('pointercancel',end);
     try{handle.releasePointerCapture?.(pointer)}catch{}
     if(!active){dragging=false;return}
     if(ev.type==='pointercancel'||targetIndex===origin){clean();return}
     const desired=movedIds(original,origin,targetIndex);
     // Destination coordinates come from the initial stationary slots.
     const finishAt=startingBoxes[targetIndex];
     const top=(finishAt?finishAt.top+initialScroll-scroll():sourceBox.top);
     const settle=()=>{
      // Keep the original DOM and the lifted card untouched until the
      // validated Plan write resolves. One render will reveal the final times.
      void commit(desired).finally(clean);
     };
     if(reduced()){settle();return}
     const animation=clone.animate?.([
      {top:clone.style.top,transform:'scale(1.012)'},
      {top:top+'px',transform:'scale(1)'}
     ],{duration:165,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
     if(animation?.finished)animation.finished.then(settle,settle);
     else root.setTimeout(settle,170);
    };
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',end);
    document.addEventListener('pointercancel',end);
   });
  });
 }
 root.FLYMPUS_FLIGHT_DRAG=Object.freeze({attach,insertionIndex,movedIds});
})(window);
