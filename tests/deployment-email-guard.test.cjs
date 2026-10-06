const fs=require('fs');
const assert=require('assert');

const workflow=fs.readFileSync('.github/workflows/firebase-hosting.yml','utf8');
const reviewWorkflow=fs.readFileSync('.github/workflows/verify.yml','utf8');

assert(workflow.includes('continue-on-error: true'),'Production deploy job must never end as a failed workflow email');
assert(workflow.includes('Production deployment summary'),'Production workflow must report blocked deploys without failing the run');
assert(workflow.includes('steps.production_verify.outcome'),'Final production verification outcome must be surfaced explicitly');
assert(!workflow.includes('exit 1'),'Expected deployment/configuration problems must not deliberately fail the workflow');
assert(workflow.includes('Production was not changed.')&&workflow.includes('Firestore Rules deployment failed. Hosting was not changed.'),
  'Infrastructure failures must block unsafe deployment while remaining email-quiet');

assert(reviewWorkflow.includes('continue-on-error: true'),'Review verification must not conclude as a failed workflow email');
assert(reviewWorkflow.includes('Review verification summary'),'Review verification must surface test problems in an explicit summary');
assert(reviewWorkflow.includes('steps.ui_render.outcome')&&reviewWorkflow.includes('steps.auth_integration.outcome'),
  'Review summary must inspect individual test outcomes');
assert(reviewWorkflow.includes('email-quiet')&&reviewWorkflow.includes('::warning::One or more FLYMPUS review checks did not pass.'),
  'Review failures must stay visible as warnings without failing the workflow');

console.log('Deployment and review failure-email guard checks passed');
