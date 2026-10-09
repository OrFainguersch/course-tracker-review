const fs=require('fs');
const assert=require('assert');

const workflow=fs.readFileSync('.github/workflows/firebase-hosting.yml','utf8');
const reviewWorkflow=fs.readFileSync('.github/workflows/verify.yml','utf8');

assert(workflow.includes('continue-on-error: true'),'Production deploy job must never end as a failed workflow email');
assert(workflow.includes('Production deployment summary'),'Production workflow must report blocked deploys without failing the run');
assert(workflow.includes('steps.production_verify.outcome')&&workflow.includes('scripts/deployment-result.cjs'),'Actual final verification must feed the explicit release report');
assert(!workflow.includes('exit 1'),'Expected deployment/configuration problems must not deliberately fail the workflow');
assert(workflow.includes('Production was not changed.')&&workflow.includes('scripts/production-safety.cjs'),
  'Missing authorization and unverified backups must block unsafe deployment while remaining email-quiet');
assert(!workflow.includes('node scripts/deploy-firestore-rules.cjs')&&workflow.includes('deploy --only hosting '),
  'Hosting uses its own target and never calls the wholesale rules publisher');
assert(workflow.includes('steps.regression.outcome')&&workflow.includes('node --test tests/*.test.cjs'),
  'The real outcome of the complete regression suite must gate production');
assert(workflow.includes('cancel-in-progress: false')&&workflow.includes('Recheck main immediately before production write'),
  'Do not cancel an in-flight production write or publish a revision that became obsolete during tests');

assert(reviewWorkflow.includes('continue-on-error: true'),'Review verification must not conclude as a failed workflow email');
assert(reviewWorkflow.includes('Review verification summary'),'Review verification must surface test problems in an explicit summary');
assert(reviewWorkflow.includes('steps.regression.outcome')&&reviewWorkflow.includes('node --test tests/*.test.cjs'),
  'Review summary must inspect the actual complete-suite outcome');
assert(reviewWorkflow.includes('email-quiet')&&reviewWorkflow.includes('::warning::One or more FLYMPUS review checks did not pass.'),
  'Review failures must stay visible as warnings without failing the workflow');

assert(workflow.includes('rules_backup_artifact')&&workflow.includes('live_permission_tests')&&workflow.includes("steps.rules_verify.outcome == 'success'"),'New course approvals require backed-up, tested and verified additive rules before Hosting');

console.log('Deployment and review failure-email guard checks passed');
