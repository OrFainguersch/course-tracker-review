const fs=require('node:fs');

function deploymentResult({steps={},current,configured,safetyReady,intendedCommit,actualCommit,courseOperationsRequired=false}){
  const approvalGates=['permission_tests','rules_backup','rules_backup_artifact','live_permission_tests','rules_deploy','rules_verify'];
  const result=(status,reason)=>({status,reason,intendedCommit,actualCommit:actualCommit||'UNKNOWN'});
  // Any attempted write takes precedence over preflight failures/cancellation.
  if(steps.hosting_deploy==='failure'||steps.hosting_deploy==='cancelled')
    return result('FAILED','Hosting deployment did not complete; inspect the live release before rollback');
  if(steps.hosting_deploy==='success'){
    const gates=['regression','safety_preflight','firebase_cli','cli_compat','google_auth','adc_verify','prepare'];
    if(courseOperationsRequired)gates.push(...approvalGates);
    if(current!=='true'||configured!=='true'||safetyReady!=='true'||gates.some(name=>steps[name]!=='success'))
      return result('FAILED','Hosting changed without every required release gate passing');
    if(steps.production_verify!=='success'||!actualCommit||actualCommit!==intendedCommit)
      return result('FAILED','Hosting changed, but exact production commit/assets verification is incomplete');
    return result('DEPLOYED','Production commit, every bundled asset and reserved auth helpers were verified');
  }
  if(current!=='true')return result('BLOCKED','Obsolete or unverified main revision');
  if(steps.regression!=='success')return result('BLOCKED','The complete regression suite did not pass');
  if(steps.safety_preflight!=='success'||safetyReady!=='true')
    return result('BLOCKED','Production-data backup, local-device safeguards or Hosting rollback are unverified');
  if(configured!=='true')return result('BLOCKED','Deployment authorization is not configured');
  for(const name of ['firebase_cli','cli_compat','google_auth','adc_verify','prepare']){
    if(steps[name]!=='success')return result('FAILED',`Infrastructure/build step did not pass: ${name}; Hosting was not attempted`);
  }
  if(courseOperationsRequired){
    for(const name of approvalGates)if(steps[name]!=='success')return result('BLOCKED',`Course operations release did not pass: ${name}; no application release is claimed`);
  }
  return result('BLOCKED','Hosting deployment was skipped; no release success is claimed');
}

async function report(){
  let actualCommit='';
  try{
    const url=new URL('https://flympus.firebaseapp.com/deploy-info.json');
    url.searchParams.set('__flympus_observe',process.env.GITHUB_RUN_ID||Date.now());
    const response=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if(response.ok){const info=await response.json();if(/^[a-f0-9]{40}$/.test(info?.commit||''))actualCommit=info.commit}
  }catch{}
  let steps={};
  try{steps=JSON.parse(process.env.FLYMPUS_RELEASE_STEPS||'{}')}catch{}
  const result=deploymentResult({steps,current:process.env.FLYMPUS_CURRENT,configured:process.env.FLYMPUS_CONFIGURED,
    safetyReady:process.env.FLYMPUS_SAFETY_READY,intendedCommit:process.env.GITHUB_SHA,actualCommit,courseOperationsRequired:process.env.FLYMPUS_COURSE_OPERATIONS_REQUIRED==='true'});
  fs.writeFileSync('deployment-result.json',JSON.stringify({...result,steps},null,2)+'\n');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`status=${result.status}\nactual_commit=${result.actualCommit}\n`);
  const summary=`### Firebase production: ${result.status}\n\n${result.reason}\n\n`+
    `| Revision | SHA |\n| --- | --- |\n| Intended revision | ${result.intendedCommit||'UNKNOWN'} |\n| Observed production | ${result.actualCommit} |\n\n`+
    '| Step | Actual outcome |\n| --- | --- |\n'+Object.entries(steps).map(([key,value])=>`| ${key} | ${value||'skipped'} |`).join('\n')+'\n';
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  console.log(`::${result.status==='DEPLOYED'?'notice':'warning'}::${result.status}: ${result.reason}`);
  console.log(`Intended commit: ${result.intendedCommit}; observed production: ${result.actualCommit}`);
}
if(require.main===module)report().catch(error=>{console.error('FAILED: Release reporting failed:',error.message);process.exitCode=1});
module.exports={deploymentResult};
