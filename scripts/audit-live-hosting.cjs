const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const BASE='https://flympus.firebaseapp.com/';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function sourceBytes(commit,filename,read){
  let value=read(commit,filename);
  if(filename==='index.html')value=Buffer.from(value.toString('utf8').replaceAll('__FLYMPUS_DEPLOY_COMMIT__',commit));
  if(filename==='sw.js')value=Buffer.from(value.toString('utf8').replace(/const FLYMPUS_SW_VERSION='[^']+';/,
    "const FLYMPUS_SW_VERSION='"+commit.slice(0,16)+"';"));
  return value;
}
function validateManifest(value){
  if(!/^[a-f0-9]{40}$/.test(value?.commit||'')||!value?.files||Array.isArray(value.files)||!Object.keys(value.files).length)
    throw new Error('Invalid live deployment manifest');
  for(const [filename,hash] of Object.entries(value.files))
    if(!/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(filename)||filename.split('/').includes('..')||filename.startsWith('__/')||
       !/^[a-f0-9]{64}$/.test(hash))throw new Error('Unsafe or invalid deployment manifest entry');
  return value;
}
async function main(){
  const destination=path.resolve(process.env.FLYMPUS_AUDIT_DIRECTORY||'hosting-audit');
  fs.mkdirSync(destination,{recursive:true});
  async function get(filename){
    const url=new URL(filename,BASE);url.searchParams.set('__flympus_source_audit',process.env.GITHUB_RUN_ID||Date.now());
    const response=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Public Hosting audit: ${filename} returned ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const manifestBytes=await get('deploy-info.json'),manifest=validateManifest(JSON.parse(manifestBytes));
  // Read-only Git fetch: never authenticate to Firebase or change any release.
  execFileSync('git',['fetch','origin',manifest.commit,'--depth=1'],{stdio:'inherit'});
  const read=(commit,filename)=>execFileSync('git',['show',commit+':'+filename],{maxBuffer:20*1024*1024});
  const entries=Object.entries(manifest.files);let checked=0;
  for(let index=0;index<entries.length;index+=4){
    await Promise.all(entries.slice(index,index+4).map(async([filename,hash])=>{
      if(digest(sourceBytes(manifest.commit,filename,read))!==hash)throw new Error('Live manifest differs from Git source: '+filename);
      const actual=await get(filename);
      if(digest(actual)!==hash)throw new Error('Live asset differs from verified manifest: '+filename);
      const output=path.join(destination,'public',filename);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,actual);checked++;
    }));
  }
  for(const filename of ['__/auth/iframe','__/auth/handler']){
    const helper=(await get(filename)).toString('utf8');
    if(/id="flympusAuthRoot"|Course Tracker Training Operations/.test(helper))throw new Error('Reserved Firebase helper was replaced by app HTML');
  }
  const after=validateManifest(JSON.parse(await get('deploy-info.json')));
  if(after.commit!==manifest.commit||JSON.stringify(after.files)!==JSON.stringify(manifest.files))
    throw new Error('Hosting changed during the audit; rerun for one consistent release');
  fs.writeFileSync(path.join(destination,'deploy-info.json'),manifestBytes);
  const html=fs.readFileSync(path.join(destination,'public','index.html'),'utf8');
  const result={status:'VERIFIED_PUBLIC_HOSTING',commit:manifest.commit,publicFilesChecked:checked,
    build:html.match(/FLYMPUS Review · build (\d+)/)?.[1]||null,
    reservedAuthRoutesChecked:true,allManifestFilesMatchGitSource:true,
    cloudDataBackedUp:false,personalDeviceDataChecked:false,hostingRollbackVersionVerified:false};
  fs.writeFileSync(path.join(destination,'audit-result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Read-only live Hosting audit\n\nCommit: ${result.commit}; build: ${result.build}; public files verified: ${checked}.\n\n`+
    'Cloud records, Authentication, Storage objects and personal-device data are not backed up by this audit.\n');
}
if(require.main===module)main().catch(error=>{console.error('BLOCKED: '+error.message);process.exitCode=1});
module.exports={validateManifest,sourceBytes};
