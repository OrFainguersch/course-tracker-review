const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {buildFromWorkflowRun,stampReleaseHtml}=require('../scripts/release-build.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const commit='a'.repeat(40);
test('Firebase workflow automatically increments the Build',()=>{
 assert.equal(buildFromWorkflowRun(353),'0804');
 assert.equal(buildFromWorkflowRun('354'),'0805');
 assert.equal(buildFromWorkflowRun('355'),'0806');
 for(const bad of [undefined,0,352,'nope','353.5'])assert.throws(()=>buildFromWorkflowRun(bad));
});
test('Hosting signs exact Build and Git SHA, rather than the former fixed text',()=>{
 const sample='<meta content="__FLYMPUS_DEPLOY_COMMIT__"><meta content="__FLYMPUS_DEPLOY_BUILD__">';
 const stamped=stampReleaseHtml(sample,commit,'0805');
 assert.ok(stamped.includes('content="'+commit+'"'));
 assert.ok(stamped.includes('content="0805"'));
 assert.doesNotMatch(stamped,/__FLYMPUS_DEPLOY_(?:BUILD|COMMIT)__/);
 assert.throws(()=>stampReleaseHtml(sample,commit,'garbage'));
 assert.throws(()=>stampReleaseHtml('<meta content="__FLYMPUS_DEPLOY_COMMIT__">',commit,'0805'));
 assert.doesNotMatch(html,/FLYMPUS Review · build 0800/);
 assert.match(html,/meta name="flympus-deploy-build" content="__FLYMPUS_DEPLOY_BUILD__"/);
 assert.match(html,/const build=flympusBuildLabel\(\)/);
 assert.match(html,/if\(versionBanner\)versionBanner.textContent=flympusBuildLabel\(\)/);
 assert.match(html,/dir="auto" data-i18n-skip/);
});
test('English and Hebrew RTL About screens display the loaded offline Build',()=>{
 const start=html.indexOf('function flympusBuildLabel(){');
 const end=html.indexOf('function appPreferencesScreen(){',start);
 assert.ok(start>0&&end>start);
 const source=html.slice(start,end)+'\nflympusBuildLabel()';
 function label(build,sha,language){
  return vm.runInNewContext(source,{
    getFlympusAppPreferences:()=>({language}),
    document:{querySelector:sel=>({getAttribute:()=>sel.includes('deploy-build')?build:sha})}
  });
 }
 assert.equal(label('0805',commit,'en'),'FLYMPUS · Build 0805 · aaaaaaaa');
 assert.equal(label('0805',commit,'he'),'FLYMPUS · גרסה 0805 · aaaaaaaa');
 assert.equal(label('__FLYMPUS_DEPLOY_BUILD__',commit,'en'),'FLYMPUS · Build unavailable');
 assert.equal(label('',commit,'he'),'FLYMPUS · גרסה לא זמינה');
 assert.equal(label('0805','bad-sha','en'),'FLYMPUS · Build unavailable');
 assert.match(html,/class="card appSettingsCard appSettingsAboutCard"/);
});
