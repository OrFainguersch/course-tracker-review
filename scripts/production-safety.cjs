const fs=require('node:fs');
const path=require('node:path');

function inspectSafety(value){
  const reasons=[];
  if(value?.schema!==1||value?.projectId!=='flympus')reasons.push('Invalid project safety record');
  const exception=value?.authorizedHostingOnly;
  if(exception?.enabled===true){
    const required=['approvalReference','sourceBackupReference','previousSourceBackupReference'];
    if(required.some(key=>typeof exception[key]!=='string'||!exception[key].trim()))reasons.push('Hosting-only authorization or source backups are missing');
    if(!/^[a-f0-9]{40}$/.test(exception?.applicationSourceCommit||''))reasons.push('The backed-up application source commit is missing');
    if(!/^[a-f0-9]{64}$/.test(exception?.sourceBackupSha256||''))reasons.push('Source backup checksum is missing');
    if(exception?.scope!=='hosting-only'||exception?.cloudDataWrites!==false||exception?.rulesWrites!==false||exception?.redirectOldOrigin!==false)reasons.push('Authorized exception must preserve cloud data, rules and the old origin');
    if(value?.localData?.oldOriginRetained!==true)reasons.push('The old origin must remain available');
    return {ready:reasons.length===0,mode:'authorized-hosting-only',reasons,limitations:['Cloud-data backup is unverified','Personal-device data has not been migrated','Full Hosting rollback version verification is incomplete']};
  }
  if(value?.cloudBackup?.verified!==true||!value?.cloudBackup?.evidenceReference)
    reasons.push('Restorable production-data backup has not been verified');
  if(value?.localData?.safeguardsVerified!==true||!value?.localData?.evidenceReference)
    reasons.push('Personal-device drafts, schedules and Safety photos still need protection');
  if(value?.localData?.oldOriginRetained!==true)
    reasons.push('The old origin must remain available during the migration');
  if(value?.hostingRollback?.verified!==true||!value?.hostingRollback?.releaseVersion||
     !/^[a-f0-9]{40}$/.test(value?.hostingRollback?.commit||''))
    reasons.push('The exact previous Hosting release and rollback path are not verified');
  return {ready:reasons.length===0,reasons};
}

if(require.main===module){
  const filename=path.join(__dirname,'..','config','production-migration.json');
  let result;
  try{result=inspectSafety(JSON.parse(fs.readFileSync(filename,'utf8')))}
  catch{result={ready:false,reasons:['Missing or unreadable production safety record']}}
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`ready=${result.ready}\n`);
  console.log(result.ready?(result.mode==='authorized-hosting-only'?'User-authorized Hosting-only release; cloud/device backups remain unverified':'Production migration safeguards verified'):`BLOCKED: ${result.reasons.join('; ')}`);
}
module.exports={inspectSafety};
