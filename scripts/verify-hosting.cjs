const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const base='https://flympus.firebaseapp.com/';
const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'..','dist','deploy-info.json'),'utf8'));
async function get(filename,attempt=0){
  const url=new URL(filename,base);
  url.searchParams.set('__flympus_verify',expected.commit+'-'+attempt);
  const response=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache, no-store','Pragma':'no-cache'},signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,`${filename} returned ${response.status}`);
  return response;
}
async function deployedInfo(){
  let last=null;
  for(let attempt=0;attempt<8;attempt++){
    const response=await get('deploy-info.json',attempt);
    last=await response.json();
    if(last?.commit===expected.commit)return last;
    await new Promise(resolve=>setTimeout(resolve,1500))
  }
  return last
}
async function main(){
  const html=await (await get('')).text();
  assert.match(html,/FLYMPUS — Train\. Track\. Progress\./,'Production must serve FLYMPUS');
  assert.doesNotMatch(html,/Site Not Found/,'Hosting has not been deployed');
  const deployed=await deployedInfo();
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
