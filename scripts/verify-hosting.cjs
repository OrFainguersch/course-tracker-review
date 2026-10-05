const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const base='https://flympus.firebaseapp.com/';
const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'..','dist','deploy-info.json'),'utf8'));
async function get(filename){
  const response=await fetch(new URL(filename,base),{cache:'no-store',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,`${filename} returned ${response.status}`);
  return response;
}
async function main(){
  const html=await (await get('')).text();
  assert.match(html,/FLYMPUS — Train\. Track\. Progress\./,'Production must serve FLYMPUS');
  assert.doesNotMatch(html,/Site Not Found/,'Hosting has not been deployed');
  const deployed=await (await get('deploy-info.json')).json();
  assert.equal(deployed.commit,expected.commit,'Production commit differs from the reviewed bundle');
  for(const [filename,digest] of Object.entries(expected.files)){
    const response=await get(filename);
    const actual=crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    assert.equal(actual,digest,`Production file differs: ${filename}`);
  }
  // Firebase owns these helpers. They must not be rewritten to the app shell.
  for(const filename of ['__/auth/iframe','__/auth/handler']){
    const helper=await (await get(filename)).text();
    assert.doesNotMatch(helper,/id="flympusAuthRoot"|Course Tracker Training Operations/,
      `Firebase reserved helper was replaced by app HTML: ${filename}`);
  }
  console.log(`Production verified: ${base} serves commit ${expected.commit}; assets and Firebase helpers match`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
