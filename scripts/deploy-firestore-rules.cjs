const fs=require('node:fs');
const path=require('node:path');

async function main(){
  const firebaseToolsRoot=process.argv[2];
  if(!firebaseToolsRoot)throw new Error('firebase-tools package root is required');
  const firebaseNodeModules=path.dirname(firebaseToolsRoot);
  const {GoogleAuth}=require(path.join(firebaseNodeModules,'google-auth-library'));
  const project=String(process.env.GOOGLE_CLOUD_PROJECT||process.env.GCLOUD_PROJECT||'flympus').trim();
  const rulesPath=path.resolve(__dirname,'..','firestore.rules');
  const source={files:[{name:'firestore.rules',content:fs.readFileSync(rulesPath,'utf8')}]};
  const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
  const client=await auth.getClient();
  const base='https://firebaserules.googleapis.com/v1';

  async function request(method,url,body){
    const headers=await client.getRequestHeaders(url);
    headers['Content-Type']='application/json';
    const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    let payload={};try{payload=await response.json()}catch{}
    if(!response.ok){
      const detail=payload?.error?.message||payload?.message||response.statusText;
      const error=new Error(`${method} ${url} returned ${response.status}: ${detail}`);
      error.status=response.status;throw error
    }
    return payload
  }

  const compile=await request('POST',`${base}/projects/${encodeURIComponent(project)}:test`,{source});
  const errors=(compile.issues||[]).filter(issue=>String(issue.severity||'').toUpperCase()==='ERROR');
  if(errors.length){
    throw new Error('Firestore rules compilation failed:\n'+errors.map(issue=>`${issue.sourcePosition?.line||'?'}:${issue.sourcePosition?.column||'?'} ${issue.description||'Rule error'}`).join('\n'))
  }

  const ruleset=await request('POST',`${base}/projects/${encodeURIComponent(project)}/rulesets`,{source});
  if(!ruleset.name)throw new Error('Firebase Rules API did not return a ruleset name');

  const releaseName=`projects/${project}/releases/cloud.firestore`;
  try{
    await request('PATCH',`${base}/${releaseName}`,{release:{name:releaseName,rulesetName:ruleset.name}})
  }catch(error){
    if(error.status!==404)throw error;
    await request('POST',`${base}/projects/${encodeURIComponent(project)}/releases`,{name:releaseName,rulesetName:ruleset.name})
  }
  console.log(`Firestore rules released to cloud.firestore: ${ruleset.name}`);
}
main().catch(error=>{console.error(error?.stack||error);process.exitCode=1});
