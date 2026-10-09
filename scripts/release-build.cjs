'use strict';
// Firebase workflow run 353 deployed Build 0804; subsequent runs automatically
// allocate a new numeric build without changing UI code or manual constants.
const BASE_RUN=353,BASE_BUILD=804;
function buildFromWorkflowRun(value){
 if(!/^[0-9]+$/.test(String(value??'')))throw new Error('A numeric GITHUB_RUN_NUMBER is required to build FLYMPUS');
 const run=Number(value);
 if(!Number.isSafeInteger(run)||run<BASE_RUN)throw new Error('Invalid FLYMPUS deployment run number');
 return String(BASE_BUILD+(run-BASE_RUN)).padStart(4,'0');
}
function stampReleaseHtml(source,commit,build){
 if(!/^[a-f0-9]{40}$/.test(commit)||typeof build!=='string'||!/^\d{4,}$/.test(build))
  throw new Error('Invalid FLYMPUS release identity');
 if(!source.includes('__FLYMPUS_DEPLOY_COMMIT__')||!source.includes('__FLYMPUS_DEPLOY_BUILD__'))
  throw new Error('Missing required HTML release identity tokens');
 return source.replaceAll('__FLYMPUS_DEPLOY_COMMIT__',commit).replaceAll('__FLYMPUS_DEPLOY_BUILD__',build);
}
module.exports={buildFromWorkflowRun,stampReleaseHtml};
