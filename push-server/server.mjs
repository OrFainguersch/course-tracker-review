import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT=Number(process.env.PORT||8787);
const VAPID_PUBLIC_KEY=String(process.env.VAPID_PUBLIC_KEY||'').trim();
const VAPID_PRIVATE_KEY=String(process.env.VAPID_PRIVATE_KEY||'').trim();
const VAPID_SUBJECT=String(process.env.VAPID_SUBJECT||'mailto:admin@example.com').trim();
const ADMIN_TOKEN=String(process.env.ADMIN_TOKEN||'').trim();
const DATA_FILE=path.resolve(process.env.SUBSCRIPTIONS_FILE||'./data/subscriptions.json');
const ALLOWED_ORIGINS=String(process.env.ALLOWED_ORIGINS||'https://orfainguersch.github.io,http://localhost:8000,http://localhost:8080')
  .split(',').map(x=>x.trim()).filter(Boolean);

if(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY)webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);

const app=express();
app.use(express.json({limit:'256kb'}));
app.use((req,res,next)=>{
  const origin=String(req.headers.origin||'');
  if(origin&&ALLOWED_ORIGINS.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
  if(req.method==='OPTIONS')return res.sendStatus(204);
  next();
});

async function readStore(){
  try{
    const raw=JSON.parse(await fs.readFile(DATA_FILE,'utf8'));
    return Array.isArray(raw)?raw:[];
  }catch{return []}
}
async function writeStore(rows){
  await fs.mkdir(path.dirname(DATA_FILE),{recursive:true});
  const temp=DATA_FILE+'.tmp';
  await fs.writeFile(temp,JSON.stringify(rows,null,2),'utf8');
  await fs.rename(temp,DATA_FILE);
}
function endpointOf(input){return String(input?.subscription?.endpoint||input?.endpoint||'').trim()}
function publicRecord(body){
  const subscription=body?.subscription;
  if(!subscription?.endpoint)throw new Error('subscription.endpoint is required');
  return {
    subscription,
    userId:String(body.userId||''),
    userName:String(body.userName||''),
    courseCode:String(body.courseCode||''),
    preferences:body.preferences&&typeof body.preferences==='object'?body.preferences:{},
    language:String(body.language||'en'),
    timezone:String(body.timezone||''),
    userAgent:String(body.userAgent||''),
    standalone:body.standalone===true,
    updatedAt:new Date().toISOString()
  }
}
function authorized(req){
  if(!ADMIN_TOKEN)return false;
  const auth=String(req.headers.authorization||'');
  return auth===`Bearer ${ADMIN_TOKEN}`
}
function matches(record,filter={}){
  if(filter.userId&&String(record.userId)!==String(filter.userId))return false;
  if(filter.courseCode&&String(record.courseCode)!==String(filter.courseCode))return false;
  if(filter.type&&record.preferences?.[filter.type]===false)return false;
  return true
}

app.get('/health',(req,res)=>res.json({ok:true,pushConfigured:!!(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY)}));
app.get('/config',(req,res)=>res.json({enabled:!!VAPID_PUBLIC_KEY,vapidPublicKey:VAPID_PUBLIC_KEY}));

app.post('/subscriptions',async(req,res)=>{
  try{
    const record=publicRecord(req.body||{}),endpoint=record.subscription.endpoint,rows=await readStore(),index=rows.findIndex(x=>endpointOf(x)===endpoint);
    if(index>=0)rows[index]={...rows[index],...record};else rows.push(record);
    await writeStore(rows);
    res.status(index>=0?200:201).json({ok:true,subscribed:true,count:rows.length})
  }catch(err){res.status(400).json({ok:false,error:String(err?.message||err)})}
});

app.delete('/subscriptions',async(req,res)=>{
  const endpoint=endpointOf(req.body||{});
  if(!endpoint)return res.status(400).json({ok:false,error:'subscription.endpoint is required'});
  const rows=await readStore(),next=rows.filter(x=>endpointOf(x)!==endpoint);
  await writeStore(next);
  res.json({ok:true,removed:rows.length-next.length,count:next.length})
});

app.post('/send',async(req,res)=>{
  if(!authorized(req))return res.status(401).json({ok:false,error:'Unauthorized'});
  if(!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY)return res.status(503).json({ok:false,error:'VAPID keys are not configured'});
  const body=req.body||{},title=String(body.title||'FLYMPUS'),message=String(body.body||''),type=String(body.type||''),courseCode=String(body.courseCode||''),userId=String(body.userId||'');
  const data={...(body.data&&typeof body.data==='object'?body.data:{}),screen:String(body.screen||body.data?.screen||'home'),courseCode:String(body.data?.courseCode||courseCode||'')};
  const payload=JSON.stringify({title,body:message,tag:String(body.tag||`flympus:${type||'update'}`),data});
  const rows=await readStore(),targets=rows.filter(x=>matches(x,{type,courseCode,userId})),stale=new Set(),results=[];
  for(const record of targets){
    try{
      await webpush.sendNotification(record.subscription,payload,{TTL:Number(body.ttl||3600),urgency:String(body.urgency||'normal')});
      results.push({endpoint:endpointOf(record),ok:true})
    }catch(err){
      const status=Number(err?.statusCode||0);
      if(status===404||status===410)stale.add(endpointOf(record));
      results.push({endpoint:endpointOf(record),ok:false,status,error:String(err?.body||err?.message||err)})
    }
  }
  if(stale.size)await writeStore(rows.filter(x=>!stale.has(endpointOf(x))));
  res.json({ok:true,matched:targets.length,sent:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,removedStale:stale.size,results})
});

app.listen(PORT,()=>console.log(`FLYMPUS push server listening on :${PORT}`));
