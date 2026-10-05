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
