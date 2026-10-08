const test=require('node:test');
const assert=require('node:assert/strict');
const {deploymentResult}=require('../scripts/deployment-result.cjs');
const {inspectSafety}=require('../scripts/production-safety.cjs');
const commit='a'.repeat(40);
const success={current:'true',configured:'true',safetyReady:'true',intendedCommit:commit,actualCommit:commit,
  steps:Object.fromEntries(['regression','safety_preflight','firebase_cli','cli_compat','google_auth','adc_verify','prepare','hosting_deploy','production_verify'].map(x=>[x,'success']))};

test('Only a verified live exact commit can be DEPLOYED',()=>{
  assert.equal(deploymentResult(success).status,'DEPLOYED');
  for(const actualCommit of ['','b'.repeat(40)])assert.equal(deploymentResult({...success,actualCommit}).status,'FAILED');
  assert.equal(deploymentResult({...success,steps:{...success.steps,production_verify:'failure'}}).status,'FAILED');
  assert.equal(deploymentResult({...success,safetyReady:'false'}).status,'FAILED');
  assert.equal(deploymentResult({...success,steps:{...success.steps,regression:'failure'}}).status,'FAILED');
});
test('Quiet workflow success cannot hide test failure or skipped deployment',()=>{
  const steps={...success.steps,regression:'failure',hosting_deploy:'skipped',production_verify:'skipped'};
  assert.equal(deploymentResult({...success,steps}).status,'BLOCKED');
  assert.equal(deploymentResult({...success,steps:{...success.steps,hosting_deploy:'skipped'}}).status,'BLOCKED');
});
test('Data protection, credentials and fresh main are required before deployment',()=>{
  for(const value of [{safetyReady:'false'},{configured:'false'},{current:'false'}]){
    const input={...success,...value,steps:{...success.steps,hosting_deploy:'skipped'}};
    assert.equal(deploymentResult(input).status,'BLOCKED');
  }
});
test('Failed and cancelled Hosting attempts never claim production is unchanged',()=>{
  for(const hosting_deploy of ['failure','cancelled']){
    const result=deploymentResult({...success,current:'false',steps:{...success.steps,hosting_deploy}});
    assert.equal(result.status,'FAILED');assert.match(result.reason,/inspect the live release/);
  }
});
test('Missing evidence and incomplete recovery verification keep production locked',()=>{
  const record={schema:1,projectId:'flympus',cloudBackup:{verified:true,evidenceReference:'private verified backup'},
    localData:{safeguardsVerified:true,oldOriginRetained:true,evidenceReference:'device inventory and backup checks'},
    hostingRollback:{verified:true,releaseVersion:'sites/flympus/versions/example',commit}};
  assert.equal(inspectSafety(record).ready,true);
  for(const key of ['cloudBackup','localData','hostingRollback'])assert.equal(inspectSafety({...record,[key]:{}}).ready,false);
  assert.equal(inspectSafety({...record,projectId:'another-project'}).ready,false);
  assert.equal(inspectSafety(require('../config/production-migration.json')).ready,false);
});
