/* FLYMPUS Safety UI adapter: keeps cloud enrollment separate from local course data. */
(function(root){
'use strict';
function create(ctx){
  const model=root.FLYMPUS_SAFETY_WORKFLOW;
  let cloud={courseId:'',mode:'idle',records:[],members:{},unsubscribe:null,error:'',initialized:false};
  const api=()=>root.FLYMPUS_AUTH?.safetyCloud;
  const uid=()=>api()?.uid?.()||'';
  const local=()=>ctx.readLocal();
  const active=()=>cloud.courseId===ctx.courseId()&&cloud.mode==='shared';
  const pending=()=>cloud.courseId===ctx.courseId()&&cloud.mode==='checking';
  const escape=ctx.escape;
  const notify=(message,tone)=>ctx.toast(message,tone);
  function records(){return active()?cloud.records:local()}
  function reset(){try{cloud.unsubscribe?.()}catch{}cloud={courseId:'',mode:'idle',records:[],members:{},unsubscribe:null,error:'',initialized:false}}
  function refresh(){if(['home','safety'].includes(ctx.screen()))ctx.render();else inbox()}
  function connect(){
    if(!api()?.ready?.()||ctx.isDuty())return;
    ctx.startGlobalInbox?.();
    if(api().manager?.())void reconcile();
    const key=String(ctx.courseId());
    if(cloud.courseId===key&&cloud.mode!=='idle')return;
    reset();cloud.courseId=key;cloud.mode='checking';
    api().course(key).then(course=>{
      if(cloud.courseId!==key)return;
      if(!course||course.unavailable){cloud.mode=course?.unavailable?'unavailable':'local';refresh();return}
      cloud.mode='shared';cloud.members=course.members||{};
      cloud.unsubscribe=api().listen(key,entries=>{
        if(cloud.courseId!==key)return;
        const before=JSON.stringify(cloud.records);
        const next=(entries||[]).map(model.normalize);
        if(cloud.initialized&&next.some(x=>!cloud.records.some(old=>old.id===x.id)&&x.createdBy!==uid()&&model.notification(x,uid()))){
          notify('New course safety event · acknowledgement required','warning');
          ctx.notifySound?.();
        }
        cloud.initialized=true;
        cloud.records=next;
        if(before!==JSON.stringify(cloud.records))refresh();else inbox();
      },err=>{cloud.error=String(err?.message||err);cloud.mode='unavailable';refresh()});
      refresh();
    }).catch(err=>{if(cloud.courseId!==key)return;cloud.error=String(err?.message||err);cloud.mode='unavailable';refresh()});
  }
  function manager(){
    if(active())return api()?.manager?.()===true||cloud.members[uid()]?.role==='COURSE_MANAGER';
    return !ctx.isDuty()&&(api()?.manager?.()===true||ctx.courseManager());
  }
  function recipientName(record,id){return String(record.requiredAckNames?.[id]||cloud.members[id]?.name||id)}
  function actions(entry){
    const x=model.normalize(entry),status=model.status(x),id=escape(x.id),counts=model.progress(x),remaining=model.pending(x);
    const label=status==='IN_PROGRESS'?'In Progress':status==='RESOLVED'?'Resolved':'Open';
    const unread=remaining.filter(person=>!model.viewed(x,person));
    const seenUnack=remaining.filter(person=>model.viewed(x,person));
    const summary=active()?'<b>Acknowledged '+counts.acknowledged+' / '+counts.total+'</b><small>'+(unread.length?'Not yet viewed: '+escape(unread.map(p=>recipientName(x,p)).join(', '))+' · ':'')+(seenUnack.length?'Viewed, awaiting acknowledgement: '+escape(seenUnack.map(p=>recipientName(x,p)).join(', ')):'')+(!remaining.length?'All assigned instructors acknowledged':'')+'</small>':'<small>Local-only record · no shared read receipts</small>';
    const ack=active()&&model.recipientUids(x).includes(uid())&&!model.acknowledged(x,uid())?'<button class="btn sky small" type="button" data-safety-ack="'+id+'">Acknowledge reading</button>':'';
    const statusControls=manager()?(status==='OPEN'?'<button class="btn secondary small" type="button" data-safety-status="'+id+'" data-status="IN_PROGRESS">Start handling</button>':'')+(status!=='RESOLVED'?'<button class="btn secondary small" type="button" data-safety-status="'+id+'" data-status="RESOLVED">Resolve event</button>':'<button class="btn secondary small" type="button" data-safety-status="'+id+'" data-status="OPEN">Reopen</button>'):'';
    return '<div class="safetyWorkflowRow"><span class="safetyStatusPill '+(status==='IN_PROGRESS'?'in_progress':status==='RESOLVED'?'resolved':'')+'">'+label+'</span><div class="safetyAckSummary">'+summary+'</div><div class="safetyWorkflowActions">'+ack+statusControls+'</div></div>';
  }
  function banner(){
    const mode=cloud.courseId===ctx.courseId()?cloud.mode:'idle',enroll=api()?.manager?.()===true;
    const count=local().length;
    if(active())return '<div class="safetySharedInfo shared"><div><b>Shared Safety · Firestore</b><small>Enrolled instructors receive events and acknowledge reading individually. Managers can track progress and resolve events.'+(count?' '+count+' older device-only records have NOT been published.':'')+' Photos are device-only and cannot be added to a shared report.</small></div>'+(enroll?'<button class="btn secondary small" data-safety-enroll type="button">Update recipients</button>':'')+'</div>';
    return '<div class="safetySharedInfo local"><div><b>Device-only Safety'+(mode==='checking'?' · checking cloud access':'')+'</b><small>Events created here are NOT delivered to other instructors until secure shared Safety is activated.'+(cloud.error?' '+escape(cloud.error):'')+'</small></div>'+(enroll?'<button class="btn secondary small" data-safety-enroll type="button">Enable shared Safety</button>':'')+'</div>';
  }
  async function submit(record){
    if(pending())throw new Error('Wait for shared Safety access verification before submitting');
    if(active()){
      if((record.photos||[]).length)throw new Error('Photos are stored only on this device. Remove photos before submitting a shared safety report.');
      await api().submit(ctx.courseId(),record);
      return 'shared';
    }
    if(!ctx.saveLocal([record,...local()]))throw new Error('Unable to save the event in device storage.');
    return 'local';
  }
  async function enroll(){
    if(!api()?.manager?.())return notify('A Training Manager must enroll course instructors.','error');
    try{
      const emailList=ctx.instructors().map(p=>p.email||'').filter(Boolean),preview=await api().rosterPreview(emailList);
      if(!preview.matched.length){
        notify('No active Firebase instructor accounts matched the course roster emails. Update the roster first.','error');return;
      }
      const missing=preview.missing.length;
      const message=missing?'Only '+preview.matched.length+' instructors matched active Firebase accounts. '+missing+' roster emails will NOT receive events. Activate for matched instructors only?':'Enable shared Safety for '+preview.matched.length+' enrolled instructor'+(preview.matched.length===1?'':'s')+'?';
      if(!await ctx.confirm(message,{title:'Shared safety enrollment',confirmLabel:'Confirm enrollment',tone:missing?'warning':'info'}))return;
      await api().enable(ctx.courseId(),ctx.courseName(),preview.matched);
      reset();connect();notify('Shared Safety enrollment saved.','success');
    }catch(err){notify(String(err?.message||err),'error')}
  }
  function inbox(){
    const menu=document.querySelector('#topNotificationDropdown'),dot=document.querySelector('#topNotificationDot'),empty=menu?.querySelector('.notificationEmpty');
    if(!menu||!dot)return;
    let list=menu.querySelector('#safetyNotificationList');
    if(!list){list=document.createElement('div');list.id='safetyNotificationList';list.className='safetyNotificationList';menu.querySelector('.notificationHead')?.after(list)}
    const events=active()&&!ctx.isDuty()&&uid()?records().filter(x=>model.notification(x,uid())).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))):[];
    dot.hidden=!events.length;
    if(empty)empty.hidden=events.length>0;
    list.innerHTML=events.slice(0,30).map(x=>'<button type="button" class="safetyNotificationItem '+(model.viewed(x,uid())?'seen':'')+'" data-safety-open="'+escape(x.id)+'"><b>Safety: '+escape(x.title||'Event')+'</b><small>'+escape(ctx.courseName())+' · '+escape(x.severity||'')+'</small><em>'+(model.viewed(x,uid())?'Viewed · acknowledgement still required':'New event · open to read')+'</em></button>').join('');
    list.querySelectorAll('[data-safety-open]').forEach(b=>b.onclick=async e=>{
      e.stopPropagation();const id=b.dataset.safetyOpen,event=records().find(x=>x.id===id);
      if(event&&!model.viewed(event,uid()))try{await api().viewed(ctx.courseId(),id)}catch{notify('Could not record event view','error')}
      menu.hidden=true;document.querySelector('#topNotificationBtn')?.setAttribute('aria-expanded','false');
      ctx.openSafety();
      setTimeout(()=>[...document.querySelectorAll('[data-safety-record-id]')].find(x=>x.dataset.safetyRecordId===id)?.scrollIntoView?.({behavior:'smooth',block:'center'}),90);
    });
  }
  function bind(){
    document.querySelectorAll('[data-safety-enroll]').forEach(b=>b.onclick=enroll);
    document.querySelectorAll('[data-safety-ack]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.safetyAck,event=records().find(x=>x.id===id);
      if(!event||!active()||!model.recipientUids(event).includes(uid())||model.acknowledged(event,uid()))return;
      if(!await ctx.confirm('Confirm that you have read this safety event? Merely viewing it does not acknowledge it.',{title:'Acknowledge safety event',confirmLabel:'Acknowledge'}))return;
      b.disabled=true;
      try{await api().acknowledge(ctx.courseId(),id);notify('Safety event acknowledged.','success')}
      catch(err){notify(String(err?.message||err),'error');b.disabled=false}
    });
    document.querySelectorAll('[data-safety-status]').forEach(b=>b.onclick=async()=>{
      if(!manager())return;
      const id=b.dataset.safetyStatus,status=b.dataset.status,event=records().find(x=>x.id===id);
      if(!event||!['OPEN','IN_PROGRESS','RESOLVED'].includes(status))return;
      if(!await ctx.confirm('Change this safety event status to '+(status==='RESOLVED'?'Resolved':status==='IN_PROGRESS'?'In Progress':'Open')+'? Read acknowledgements are tracked separately.',{title:'Safety event status',confirmLabel:'Update status'}))return;
      b.disabled=true;
      try{
        if(active())await api().setStatus(ctx.courseId(),id,status);
        else if(!ctx.saveLocal(local().map(x=>x.id===id?{...x,status,statusAt:new Date().toISOString(),statusBy:uid()}:x)))throw new Error('Could not save local safety status');
        notify('Safety status updated.','success');if(!active())ctx.render();
      }catch(err){notify(String(err?.message||err),'error');b.disabled=false}
    });
  }
  return Object.freeze({records,connect,reset,banner,actions,bind,inbox,submit,isShared:active,isChecking:pending});
}
root.FLYMPUS_SAFETY_UI=Object.freeze({create});
})(window);
