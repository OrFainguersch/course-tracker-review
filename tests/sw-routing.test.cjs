const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
function worker(){
  const handlers=new Map();
  const context={URL,Response,Uint8Array,
    self:{location:{origin:'https://flympus.firebaseapp.com'},registration:{scope:'https://flympus.firebaseapp.com/'},
      addEventListener:(name,handler)=>handlers.set(name,handler)},
    caches:{open(){throw new Error('Reserved auth routes must not access app caches')}},
    fetch(){throw new Error('Reserved auth routes must be handled by the browser, not the app worker')}
  };
  vm.runInNewContext(source,context);
  return handlers.get('fetch');
}
test('Firebase reserved navigation and iframe helpers bypass all worker handling',()=>{
  const onFetch=worker();
  for(const filename of ['__/auth/handler?apiKey=public-config','__/auth/iframe','__/firebase/init.json']){
    for(const mode of ['navigate','cors','no-cors']){
      let intercepted=false;
      onFetch({request:{method:'GET',url:new URL(filename,'https://flympus.firebaseapp.com/').href,mode},
        respondWith(){intercepted=true},waitUntil(){intercepted=true}});
      assert.equal(intercepted,false,`${filename} (${mode}) must bypass the app shell`);
    }
  }
});

test('Explicit FLYMPUS refresh navigations bypass the cached page shell',()=>{
  assert.match(source,/url\.searchParams\.has\('flympusFresh'\)/);
  assert.match(source,/const latest=await updateNavigationCache\(request\)/);
  assert.match(source,/return latest\|\|cached\|\|offlineShell\(\)/);
});
test('Safety dependencies are versioned as part of installed application shell',()=>{
  for(const file of ['safety-ui.js','safety-global-inbox.js','safety-workflow.js','app-update-notice.js'])
    assert.ok(source.includes('assets/'+file),file+' should update with the PWA');
});

test('Home Safety metric is centered and the current automatic Safety panel is bundled',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const safety=fs.readFileSync(path.join(__dirname,'..','assets/safety-ui.js'),'utf8');
  assert.doesNotMatch(html,/data-go="safety" style="text-align:start/);
  assert.match(html,/\.homePulseCard\[data-go="safety"\]\{[^}]*text-align:center/);
  assert.match(html,/assets\/safety-ui\.js\?v=20261008-safety02/);
  assert.match(safety,/Automatic Safety/);
  assert.doesNotMatch(safety,/Device-only Safety/);
  assert.match(html,/flympus-deploy-commit" content="__FLYMPUS_DEPLOY_COMMIT__"/);
});
test('Firebase Hosting generates a unique worker version for each commit',()=>{
  const prepare=fs.readFileSync(path.join(__dirname,'..','scripts/prepare-hosting.cjs'),'utf8');
  assert.match(prepare,/commit\.slice\(0,16\)/);
  assert.match(prepare,/workerSource\.replace\(workerPattern/);
  assert.match(prepare,/htmlSource\.replaceAll\(deployToken,commit\)/);
});
