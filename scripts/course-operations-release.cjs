/* Append the reviewed namespace to the active rules; preserve every other rule. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const START='    /* BEGIN FLYMPUS COURSE OPERATIONS */';
const END='    /* END FLYMPUS COURSE OPERATIONS */';
/* Separately approved 2026-10-10 user-deletion hierarchy change.
   Narrow exact-match replacement; reject every unknown production variant. */
const PREVIOUS_USER_DELETE_RULE="    function managerMayDelete(uid) {\n      let actorRole = currentUserRecord().data.role;\n      let targetRole = resource.data.role;\n      return userManager()\n        && managerMayTarget(actorRole, targetRole, uid);\n    }";
const REVISED_USER_DELETE_RULE="    function managerMayDelete(uid) {\n      let actorRole = currentUserRecord().data.role;\n      let targetRole = resource.data.role;\n      return administrator()\n        && actorRole in ['owner', 'admin']\n        && targetRole in ['training_manager', 'user', 'duty_trainee']\n        && managerMayTarget(actorRole, targetRole, uid);\n    }";
function userDeleteRule(source){
  const marker='    function managerMayDelete(uid) {';
  const at=source.indexOf(marker);
  if(at<0||source.indexOf(marker,at+1)>=0)throw new Error('Expected exactly one user-deletion permission function');
  const end=source.indexOf('\n    }',at);
  if(end<at)throw new Error('User-deletion permission function is not terminated');
  return source.slice(at,end+'\n    }'.length);
}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function block(source){
  const start=source.indexOf(START),end=source.indexOf(END);
  if(start<0||end<start||source.indexOf(START,start+1)>=0||source.indexOf(END,end+1)>=0)throw new Error('Expected one reviewed course operations block');
  const result=source.slice(start,end+END.length);
  if(!result.includes('match /courseOperations/{courseId}'))throw new Error('Unexpected rules namespace');
  return result;
}
function merge(active,candidate){
  const addition=block(candidate);
  if(userDeleteRule(candidate)!==REVISED_USER_DELETE_RULE)throw new Error('Candidate must contain reviewed Administrator-only user deletion');
  let merged;
  if(active.includes(START)){
    const previous=block(active);
    merged=active.replace(previous,()=>addition);
  }else{
    const ending=active.match(/\n[ \t]*}\s*\n[ \t]*}\s*$/);
    if(!ending||!active.includes('service cloud.firestore'))throw new Error('Unrecognized active Firestore source; production rules were not changed');
    merged=active.slice(0,ending.index)+'\n'+addition+active.slice(ending.index);
  }
  const existing=userDeleteRule(merged);
  if(existing!==PREVIOUS_USER_DELETE_RULE&&existing!==REVISED_USER_DELETE_RULE)
    throw new Error('Unexpected live user deletion policy; refusing an unsafe rewrite');
  return merged.replace(existing,()=>REVISED_USER_DELETE_RULE);
}
function authorize(config){
  if(config?.project!=='flympus'||config.namespace!=='courseOperations'||config.enabled!==true||config.additiveOnly!==true||config.preserveExistingData!==true||!config.authorization?.instruction||!config.authorization?.referenceCommit)throw new Error('Additive course operations release is not authorized');
}
async function main(){
  const [mode,toolsRoot,directory]=process.argv.slice(2);
  const root=path.resolve(__dirname,'..');
  const config=JSON.parse(fs.readFileSync(path.join(root,'config/course-operations-release.json'),'utf8'));
  authorize(config);
  if(mode==='preflight'){block(fs.readFileSync(path.join(root,'firestore.rules'),'utf8'));console.log('Reviewed courseOperations release and narrowly authorized administrator-only user deletion policy; other rules preserved');return;}
  if(!['backup','deploy','verify'].includes(mode)||!toolsRoot||!directory)throw new Error('Use backup, deploy or verify with Firebase CLI package root and release directory');
  const {GoogleAuth}=require(path.join(path.dirname(toolsRoot),'google-auth-library'));
  const client=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
  const base='https://firebaserules.googleapis.com/v1',releaseName='projects/flympus/releases/cloud.firestore';
  async function request(method,name,body){
    const url=base+'/'+name,headers=new Headers(await client.getRequestHeaders(url));
    headers.set('Content-Type','application/json');
    const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    const payload=await response.json();
    if(!response.ok)throw new Error(`Rules API ${method} returned ${response.status}: ${payload?.error?.message||response.statusText}`);
    return payload;
  }
  const dir=path.resolve(directory),snapshotPath=path.join(dir,'active-rules-backup.json'),candidatePath=path.join(dir,'firestore.rules');
  if(mode==='backup'){
    fs.mkdirSync(dir,{recursive:true});
    const release=await request('GET',releaseName);
    const ruleset=await request('GET',release.rulesetName);
    const files=ruleset.source?.files;
    if(!Array.isArray(files)||files.length!==1||typeof files[0].content!=='string')throw new Error('Expected one active Firestore rules source; production was not changed');
    const original=files[0].content,candidate=merge(original,fs.readFileSync(path.join(root,'firestore.rules'),'utf8'));
    fs.writeFileSync(snapshotPath,JSON.stringify({project:'flympus',commit:process.env.GITHUB_SHA,release,ruleset,originalHash:hash(original),candidateHash:hash(candidate)},null,2)+'\n',{mode:0o600});
    fs.writeFileSync(candidatePath,candidate,{mode:0o600});
    fs.writeFileSync(path.join(dir,'firebase.json'),JSON.stringify({firestore:{rules:candidatePath},emulators:{firestore:{host:'127.0.0.1',port:8080},ui:{enabled:false},singleProjectMode:true}}));
    console.log('Active rules backed up; merged candidate requires permission tests before publication');return;
  }
  const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8')),candidate=fs.readFileSync(candidatePath,'utf8');
  if(snapshot.project!=='flympus'||snapshot.commit!==process.env.GITHUB_SHA||snapshot.candidateHash!==hash(candidate)||snapshot.originalHash!==hash(snapshot.ruleset.source.files[0].content)||candidate!==merge(snapshot.ruleset.source.files[0].content,fs.readFileSync(path.join(root,'firestore.rules'),'utf8')))throw new Error('Rules backup or tested candidate does not match this release');
  if(mode==='deploy'){
    const active=await request('GET',releaseName);
    if(active.rulesetName!==snapshot.release.rulesetName)throw new Error('Active rules changed after backup; publication stopped');
    const source={files:[{name:snapshot.ruleset.source.files[0].name,content:candidate}]};
    const compile=await request('POST','projects/flympus:test',{source});
    if((compile.issues||[]).some(issue=>issue.severity==='ERROR'))throw new Error('Merged production rules failed compilation');
    const ruleset=await request('POST','projects/flympus/rulesets',{source});
    if(!ruleset.name)throw new Error('No candidate ruleset was returned');
    const latest=await request('GET',releaseName);
    if(latest.rulesetName!==snapshot.release.rulesetName)throw new Error('Active rules changed during compilation; publication stopped');
    await request('PATCH',releaseName,{release:{name:releaseName,rulesetName:ruleset.name}});
    fs.writeFileSync(path.join(dir,'published-rules.json'),JSON.stringify({commit:process.env.GITHUB_SHA,rulesetName:ruleset.name,previousRulesetName:snapshot.release.rulesetName,candidateHash:hash(candidate)},null,2)+'\n');
    console.log('Published reviewed courseOperations block and administrator-only user deletion policy: '+ruleset.name);return;
  }
  const published=JSON.parse(fs.readFileSync(path.join(dir,'published-rules.json'),'utf8'));
  const active=await request('GET',releaseName),live=await request('GET',active.rulesetName);
  if(active.rulesetName!==published.rulesetName||live.source?.files?.length!==1||hash(live.source.files[0].content)!==snapshot.candidateHash)throw new Error('Active production rules do not match the tested candidate');
  console.log('Verified courseOperations and administrator-only user deletion permissions; other production rules preserved');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={block,merge,authorize};
