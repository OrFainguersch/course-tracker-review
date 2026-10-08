const fs=require('node:fs');
const path=require('node:path');

function inspectSafety(value){
  const reasons=[];
  if(value?.schema!==1||value?.projectId!=='flympus')reasons.push('Invalid project safety record');
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
  console.log(result.ready?'Production migration safeguards verified':`BLOCKED: ${result.reasons.join('; ')}`);
}
module.exports={inspectSafety};
