const test=require('node:test');
const assert=require('node:assert/strict');
const {validateManifest,sourceBytes}=require('../scripts/audit-live-hosting.cjs');
const commit='a'.repeat(40),hash='b'.repeat(64);
test('Public manifest cannot direct requests or files outside the selected origin/directory',()=>{
  assert.doesNotThrow(()=>validateManifest({commit,files:{'assets/fleet-model.js':hash}}));
  for(const key of ['../secret','assets/../secret','//another.example/file','https://another.example/file','__/auth/handler'])
    assert.throws(()=>validateManifest({commit,files:{[key]:hash}}));
  assert.throws(()=>validateManifest({commit:'main',files:{'index.html':hash}}));
});
test('Source comparison reproduces Hosting stamps without changing other public bytes',()=>{
  const read=(_,name)=>Buffer.from(name==='index.html'?'release=__FLYMPUS_DEPLOY_COMMIT__':name==='sw.js'?"const FLYMPUS_SW_VERSION='old';\nfetch();":'exact bytes');
  assert.equal(sourceBytes(commit,'index.html',read).toString(),'release='+commit);
  assert.equal(sourceBytes(commit,'sw.js',read).toString(),"const FLYMPUS_SW_VERSION='"+commit.slice(0,16)+"';\nfetch();");
  assert.equal(sourceBytes(commit,'assets/example.js',read).toString(),'exact bytes');
});
