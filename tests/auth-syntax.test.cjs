const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('auth runtime is syntactically valid JavaScript',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','auth.js'),'utf8');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'auth.js'}));
});
