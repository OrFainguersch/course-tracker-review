/* FLYMPUS: authenticated app-wide Safety notifications, including manager read receipts. */
(function(root){
'use strict';
function create(ctx){
 const state={uid:'',unsubscribe:null,watchers:new Map(),records:new Map(),courses:new Map(),ready:false};
 const api=()=>root.FLYMPUS_AUTH?.safetyCloud,model=root.FLYMPUS_SAFETY_WORKFLOW;
 const currentUid=()=>String(api()?.uid?.()||'');
 const esc=ctx.escape,when=value=>{
   try{const date=value?.toDate?.()||(value?new Date(value):null);
     return date&&!isNaN(date.getTime())?date.toLocaleString():'—';
   }catch{return'—'}
 };
 function stop(){
   try{state.unsubscribe?.()}catch{}
   for(const off of state.watchers.values())try{off()}catch{}
   state.unsubscribe=null;state.watchers.clear();state.records.clear();state.courses.clear();state.uid='';state.ready=false;
 }
 function start(){
   const user=currentUid();
   if(!user||ctx.isDuty()||!api()?.ready?.())return;
   if(state.uid===user&&state.unsubscribe)return;
   stop();state.uid=user;
   state.unsubscribe=api().watchCourses(courses=>{
     if(state.uid!==currentUid())return;
     const allowed=new Set(courses.map(c=>String(c.courseId||'')));
     for(const [id,unsub] of state.watchers){
       if(!allowed.has(id)){try{unsub()}catch{}state.watchers.delete(id);state.records.delete(id)}
     }
     state.courses=new Map(courses.map(c=>[String(c.courseId),c]));
     for(const c of courses){
       const key=String(c.courseId||'');
       if(!key||state.watchers.has(key))continue;
       const unsubscribe=api().listen(key,rows=>{
         if(state.uid!==currentUid())return;
         const prior=state.records.get(key)||[],next=rows.map(model.normalize);
         const isManager=c.members?.[state.uid]?.role==='COURSE_MANAGER';
         if(state.records.has(key)){
           const added=next.some(e=>!prior.some(p=>p.id===e.id)&&model.notification(e,state.uid)&&e.createdBy!==state.uid);
           const changed=isManager&&next.some(e=>{
             const old=prior.find(p=>p.id===e.id);if(!old)return false;
             return Object.keys(e.seenBy||{}).some(uid=>uid!==state.uid&&!old.seenBy?.[uid])
                 ||Object.keys(e.ackBy||{}).some(uid=>uid!==state.uid&&!old.ackBy?.[uid]);
           });
           if(added||changed){ctx.toast(added?'New Safety event: reading acknowledgement required':'Safety event: instructor reading status updated','warning');ctx.notifySound?.()}
         }
         state.records.set(key,next);render();
       },error=>{console.warn('Course Safety inbox',key,error);render()});
       state.watchers.set(key,unsubscribe);
     }
     state.ready=true;render();
   },err=>{console.warn('FLYMPUS Safety inbox subscription',err);stop();render()});
 }
 function managerNoticesSeenAt(){
   try{return Number(localStorage.getItem('ct-review-safety-manager-read-'+state.uid)||0)}catch{return 0}
 }
 function markSeen(){
   if(!state.uid)return;
   try{localStorage.setItem('ct-review-safety-manager-read-'+state.uid,String(Date.now()))}catch{}
   render();
 }
 function items(){
   const user=state.uid,out=[];
   for(const [key,rows] of state.records){
     const course=state.courses.get(key)||{},manager=course.members?.[user]?.role==='COURSE_MANAGER';
     for(const event of rows){
       if(model.notification(event,user))out.push({type:'action',key,event,at:event.createdAt,course});
       if(!manager)continue;
       for(const [person,at] of Object.entries(event.seenBy||{})){
         if(person!==user)out.push({type:'view',key,event,person,at,course});
       }
       for(const [person,at] of Object.entries(event.ackBy||{})){
         if(person!==user)out.push({type:'ack',key,event,person,at,course});
       }
     }
   }
   return out.sort((a,b)=>{
     const v=x=>{try{return x?.toDate?.()?.getTime?.()||new Date(x||0).getTime()||0}catch{return 0}};
     return v(b.at)-v(a.at)
   }).slice(0,60);
 }
 function displayName(item){
   return String(item.event.requiredAckNames?.[item.person]||item.course.members?.[item.person]?.name||'Instructor');
 }
 function show(item){
   const e=item.event,overlay=document.createElement('div');overlay.className='siteDialogOverlay safetyReadOverlay';
   const title=item.type==='action'?'Read safety event':'Safety event update';
   const canAck=model.recipientUids(e).includes(state.uid)&&!model.acknowledged(e,state.uid);
   overlay.innerHTML='<div class="siteDialogCard safetyReadCard" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
     '<div class="siteDialogEyebrow">FLYMPUS · SAFETY</div><h3>'+esc(e.title||'Safety event')+'</h3>'+
     '<p><b>Course:</b> '+esc(item.course.name||item.key)+'</p>'+
     '<p><b>Severity:</b> '+esc(e.severity||'—')+' · <b>Date:</b> '+esc(e.date||'—')+'</p>'+
     '<div class="safetyReadDetails"><b>Event description</b><p>'+esc(e.briefDescription||e.details||'—')+'</p>'+
     '<b>Findings</b><p>'+esc(e.findings||'—')+'</p><b>Lessons learned</b><p>'+esc(e.lessonsLearned||'—')+'</p></div>'+
     '<div class="siteDialogActions"><button type="button" class="btn secondary" data-safety-close>Close</button>'+
     (canAck?'<button type="button" class="btn sky" data-safety-confirm>Acknowledge reading</button>':'')+'</div></div>';
   document.body.append(overlay);
   overlay.querySelector('[data-safety-close]').onclick=()=>overlay.remove();
   overlay.onclick=x=>{if(x.target===overlay)overlay.remove()};
   const ack=overlay.querySelector('[data-safety-confirm]');
   const needsView=model.recipientUids(e).includes(state.uid)&&!model.viewed(e,state.uid);
   const viewPromise=needsView?api().viewed(item.key,e.id):Promise.resolve();
   if(ack&&needsView)ack.disabled=true;
   viewPromise.then(()=>{if(ack)ack.disabled=false}).catch(err=>{
     ctx.toast('Could not record Safety view: '+String(err?.message||err),'error');
     if(ack)ack.disabled=true;
   });
   if(ack)ack.onclick=async()=>{
     ack.disabled=true;
     try{
       await viewPromise;
       await api().acknowledge(item.key,e.id);
       overlay.remove();ctx.toast('Safety reading acknowledged','success');
     }catch(err){ctx.toast(String(err?.message||err),'error');ack.disabled=false}
   };
 }
 function render(){
   const panel=document.querySelector('#topNotificationDropdown'),dot=document.querySelector('#topNotificationDot'),empty=panel?.querySelector('.notificationEmpty');
   if(!panel||!dot||ctx.isDuty())return;
   let list=panel.querySelector('#safetyNotificationList');
   if(!list){list=document.createElement('div');list.id='safetyNotificationList';list.className='safetyNotificationList';panel.querySelector('.notificationHead')?.after(list)}
   const rows=items(),outstanding=rows.filter(x=>x.type==='action');
   dot.hidden=outstanding.length===0&&rows.filter(x=>x.type!=='action').every(x=>{
     const stamp=x.at?.seconds?x.at.seconds*1000:new Date(x.at||0).getTime();
     return !stamp||stamp<=managerNoticesSeenAt();
   });
   if(empty)empty.hidden=!!rows.length;
   list.innerHTML=rows.slice(0,40).map((item,i)=>{
     const action=item.type==='action';
     const label=action?'Safety event · acknowledgement required':item.type==='view'?displayName(item)+' viewed an event':displayName(item)+' acknowledged reading';
     const readState=action?(model.viewed(item.event,state.uid)?'Viewed · awaiting acknowledgement':'New · read and acknowledge'):when(item.at);
     return '<button type="button" class="safetyNotificationItem" data-global-safety-index="'+i+'">'+
       '<b>'+esc(label)+'</b><small>'+esc(item.course.name||item.key)+' · '+esc(item.event.title||'Safety event')+'</small>'+
       '<em>'+esc(readState)+'</em></button>';
   }).join('');
   list.querySelectorAll('[data-global-safety-index]').forEach(btn=>btn.onclick=ev=>{
     ev.preventDefault();ev.stopPropagation();const item=rows[Number(btn.dataset.globalSafetyIndex)];
     if(item)show(item);
     panel.hidden=true;document.querySelector('#topNotificationBtn')?.setAttribute('aria-expanded','false');
   });
 }
 return Object.freeze({start,stop,render,items,when,markSeen});
}
root.FLYMPUS_GLOBAL_SAFETY=Object.freeze({create});
})(window);
