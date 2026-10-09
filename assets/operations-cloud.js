/* UID-verified shared course operations; never falls back to a local submit. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FLYMPUS_OPERATIONS_CLOUD=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function create(env){
  const model=env.model;
  const ready=()=>env.active()&&!!env.user()?.uid&&!!env.db()&&!!env.sdk();
  const need=()=>{if(!ready())throw new Error('Sign in before using instructor approvals');};
  const key=value=>{const v=String(value||'').trim();if(!v||v.length>120)throw new Error('Invalid course identifier');return encodeURIComponent(v);};
  const uid=()=>String(env.user()?.uid||'');
  const doc=(course,...path)=>env.sdk().doc(env.db(),'courseOperations',key(course),...path);
  const stamp=()=>env.sdk().serverTimestamp();
  const data=s=>s.exists()?s.data():null;
  const decode=s=>{const v=s.data();return {...v,...Object.fromEntries(['submittedAt','reviewedAt','updatedAt'].filter(k=>v[k]?.toDate).map(k=>[k,v[k].toDate().toISOString()]))};};
  const member=c=>c?.members?.[uid()];
  const checkMember=c=>{if(!member(c))throw new Error('This course is not assigned to your account');};
  const checkReview=c=>{checkMember(c);if(!model.canReview(env.profile(),member(c)))throw new Error('An assigned instructor must approve this operation');};
  const result={
   ready,uid,
   manager:()=>ready()&&['owner','admin','training_manager'].includes(env.profile()?.role),
   async preview(context){
    need();if(!this.manager())throw new Error('A Training Manager must connect this course');
    const users=(await env.sdk().getDocs(env.sdk().collection(env.db(),'users'))).docs.map(s=>s.data()).filter(u=>u.status==='active');
    const matched=[],missing=[];
    for(const [people,kind] of [[context.instructors,'INSTRUCTOR'],[context.trainees,'DUTY_TRAINEE']])for(const p of people||[]){
     const email=String(p.email||'').trim().toLowerCase();if(!email)continue;
     const u=users.find(u=>String(u.email||'').toLowerCase()===email);
     if(!u){missing.push(email);continue;}
     if(kind==='DUTY_TRAINEE'&&u.role!=='duty_trainee')continue;
     if(kind==='INSTRUCTOR'&&u.role==='duty_trainee'){missing.push(email);continue;}
     matched.push({uid:u.uid,personId:p.id,role:kind==='INSTRUCTOR'&&p.role==='COURSE_MANAGER'?'COURSE_MANAGER':kind,name:String(u.displayName||p.name||email).slice(0,120)});
    }
    const me=env.profile();matched.push({uid:uid(),personId:'',role:'COURSE_MANAGER',name:String(me.displayName||env.user().displayName||'Course manager').slice(0,120)});
    return {matched:[...new Map(matched.map(x=>[x.uid,x])).values()],missing:[...new Set(missing)]};
   },
   async enroll(course,context,preview,fleet,seeds=[]){
    need();if(!this.manager())throw new Error('Training Manager access is required');
    const sdk=env.sdk(),batch=sdk.writeBatch(env.db()),members=Object.fromEntries(preview.matched.map(p=>[p.uid,{role:p.role,personId:p.personId||'',name:p.name}]));
    if(!members[uid()]||seeds.length>200)throw new Error('Invalid course enrollment');
    const existing=data(await sdk.getDoc(doc(course)));
    const sharedContext={...context,trainees:(context.trainees||[]).map(({email,...person})=>person),instructors:(context.instructors||[]).map(({email,...person})=>person)};
    batch.set(doc(course),{courseId:String(course),name:context.courseMeta.courseName,context:sharedContext,members,memberUids:Object.keys(members),updatedBy:uid(),updatedAt:stamp()});
    if(!existing){
     batch.set(doc(course,'fleet','current'),{platformId:context.courseMeta.platformId,aircraft:fleet.aircraft,timingDefaults:fleet.timingDefaults||{},revision:0,updatedBy:uid(),updatedAt:stamp()});
     for(const seed of seeds){const day={...model.emptyDay(seed.date),...seed,revision:1,sourceRequestId:'',updatedBy:uid(),updatedAt:stamp()};batch.set(doc(course,'days',seed.date),day);}
    }
    await batch.commit();return {members};
   },
   watchCourses(onCourses,onError){
    need();const sdk=env.sdk(),q=sdk.query(sdk.collection(env.db(),'courseOperations'),sdk.where('memberUids','array-contains',uid()));
    return sdk.onSnapshot(q,s=>onCourses(s.docs.map(decode)),onError);
   },
   listen(course,callbacks){
    need();const sdk=env.sdk(),stops=[];
    stops.push(sdk.onSnapshot(doc(course),s=>callbacks.course(data(s)),callbacks.error));
    stops.push(sdk.onSnapshot(doc(course,'fleet','current'),s=>callbacks.fleet(data(s)),callbacks.error));
    stops.push(sdk.onSnapshot(sdk.collection(env.db(),'courseOperations',key(course),'days'),s=>callbacks.days(s.docs.map(decode)),callbacks.error));
    const requests=sdk.collection(env.db(),'courseOperations',key(course),'requests');
    const q=env.profile()?.role==='duty_trainee'?sdk.query(requests,sdk.where('submittedBy','==',uid())):sdk.query(requests,sdk.where('status','==','PENDING'));
    stops.push(sdk.onSnapshot(q,s=>callbacks.requests(s.docs.map(decode)),callbacks.error));
    return ()=>stops.forEach(stop=>stop());
   },
   async submit(course,kind,date,value,baseRevision,id){
    need();if(env.profile()?.role!=='duty_trainee')throw new Error('Only Duty Trainees send approval requests');
    if(!/^[A-Za-z0-9_-]{8,100}$/.test(id))throw new Error('Invalid request identifier');
    const sdk=env.sdk();
    return sdk.runTransaction(env.db(),async tx=>{
     const c=data(await tx.get(doc(course))),fleet=data(await tx.get(doc(course,'fleet','current'))),day=data(await tx.get(doc(course,'days',date)))||model.emptyDay(date),request=data(await tx.get(doc(course,'requests',id)));
     checkMember(c);if(member(c).role!=='DUTY_TRAINEE')throw new Error('Duty Trainee assignment is required');
     const payload=model.payload(kind,value,c.context,fleet,day,date);
     if(request){if(request.submittedBy===uid()&&request.status==='PENDING'&&model.same(request.payload,payload))return id;throw new Error('This request has already been sent');}
     if(Number(baseRevision)!==Number(day.revision))throw new Error('Approved data changed. Reload the approved version before sending');
     tx.set(doc(course,'requests',id),{id,courseId:String(course),kind,date,payload,baseRevision:Number(baseRevision),status:'PENDING',submittedBy:uid(),submittedName:String(env.profile()?.displayName||env.user().displayName||'Duty Trainee').slice(0,120),submittedAt:stamp(),reviewedBy:'',reviewedAt:null,reviewNote:''});return id;
    });
   },
   async review(course,id,action,note=''){
    need();if(!['APPROVED','RETURNED'].includes(action))throw new Error('Invalid review action');
    note=String(note).trim();if(action==='RETURNED'&&(!note||note.length>2000))throw new Error('Add a correction note');
    const sdk=env.sdk();return sdk.runTransaction(env.db(),async tx=>{
     const c=data(await tx.get(doc(course))),request=data(await tx.get(doc(course,'requests',id)));
     checkReview(c);if(!request||request.status!=='PENDING')throw new Error('This request has already been reviewed');
     if(request.submittedBy===uid())throw new Error('You cannot approve your own request');
     if(action==='APPROVED'){
      const day=data(await tx.get(doc(course,'days',request.date)))||model.emptyDay(request.date),fleet=data(await tx.get(doc(course,'fleet','current')));
      model.assertReview(request,day,uid());
      const payload=model.payload(request.kind,request.payload,c.context,fleet,day,request.date);
      // The reviewed snapshot is immutable. An approval never changes its input.
      if(!model.same(payload,request.payload))throw new Error('Course requirements changed. Return this request for revision');
      tx.set(doc(course,'days',request.date),{...model.apply(day,request.kind,payload,uid(),id),updatedAt:stamp()});
     }
     tx.update(doc(course,'requests',id),{status:action,reviewedBy:uid(),reviewedAt:stamp(),reviewNote:note});return action;
    });
   },
   async withdraw(course,id){
    need();const sdk=env.sdk();return sdk.runTransaction(env.db(),async tx=>{
     const request=data(await tx.get(doc(course,'requests',id)));
     if(!request||request.submittedBy!==uid()||request.status!=='PENDING')throw new Error('This request cannot be withdrawn');
     tx.update(doc(course,'requests',id),{status:'WITHDRAWN',reviewedBy:uid(),reviewedAt:stamp(),reviewNote:''});
    });
   },
   async publish(course,kind,date,value,evaluationCount){
    need();const sdk=env.sdk();return sdk.runTransaction(env.db(),async tx=>{
     const c=data(await tx.get(doc(course))),fleet=data(await tx.get(doc(course,'fleet','current'))),day=data(await tx.get(doc(course,'days',date)))||model.emptyDay(date);
     checkReview(c);if(Number.isInteger(evaluationCount)&&evaluationCount>=0)day.evaluationCount=evaluationCount;
     const payload=model.payload(kind,value,c.context,fleet,day,date);
     tx.set(doc(course,'days',date),{...model.apply(day,kind,payload,uid()),updatedAt:stamp()});return payload;
    });
   },
   async evaluationCount(course,date,count){
    need();if(!Number.isInteger(count)||count<0)throw new Error('Invalid evaluation count');
    const sdk=env.sdk();return sdk.runTransaction(env.db(),async tx=>{
     const c=data(await tx.get(doc(course))),day=data(await tx.get(doc(course,'days',date)))||model.emptyDay(date);checkReview(c);
     if(day.evaluationCount===count)return;
     tx.set(doc(course,'days',date),{...day,evaluationCount:count,revision:day.revision+1,sourceRequestId:'',updatedBy:uid(),updatedAt:stamp()});
    });
   },
   async saveFleet(course,fleet,revision){
    need();const sdk=env.sdk();return sdk.runTransaction(env.db(),async tx=>{
     const c=data(await tx.get(doc(course))),old=data(await tx.get(doc(course,'fleet','current')));checkMember(c);
     if(!old||Number(old.revision)!==Number(revision))throw new Error('Fleet changed. Refresh before saving');
     if(!Array.isArray(fleet.aircraft)||fleet.aircraft.length>100||fleet.aircraft.some(x=>x.platformId!==c.context.courseMeta.platformId))throw new Error('Invalid course fleet');
     tx.set(doc(course,'fleet','current'),{platformId:c.context.courseMeta.platformId,aircraft:fleet.aircraft,timingDefaults:fleet.timingDefaults||{},revision:old.revision+1,updatedBy:uid(),updatedAt:stamp()});
    });
   }
  };
  return Object.freeze(result);
 }
 return {create};
});
