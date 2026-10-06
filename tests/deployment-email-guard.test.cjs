const fs=require('fs');
const assert=require('assert');

const workflow=fs.readFileSync('.github/workflows/firebase-hosting.yml','utf8');

assert(workflow.includes('continue-on-error: true'),'Production deploy job must never end as a failed workflow email');
assert(workflow.includes('Production deployment summary'),'Production workflow must report blocked deploys without failing the run');
assert(workflow.includes('steps.production_verify.outcome'),'Final production verification outcome must be surfaced explicitly');
assert(!workflow.includes('exit 1'),'Expected deployment/configuration problems must not deliberately fail the workflow');
assert(workflow.includes('Production was not changed.')&&workflow.includes('Firestore Rules deployment failed. Hosting was not changed.'),
  'Infrastructure failures must block unsafe deployment while remaining email-quiet');

console.log('Deployment failure-email guard checks passed');
