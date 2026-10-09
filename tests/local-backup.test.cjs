const test=require('node:test');
const assert=require('node:assert/strict');
const backup=require('../scripts/browser-local-backup.js');
const key='flympus:user:alice:ct-review-evals:course-a';
const payload=(local={})=>({format:backup.FORMAT,uid:'alice',origin:'https://orfainguersch.github.io',local,session:{},photos:[]});

test('Backup round-trip verifies checksum and retains exact Unicode values',async()=>{
  const original=payload({[key]:'[{"id":"eval-1","notes":"הערכה ✈️"}]'});
  const encoded=await backup.encode(original);
  assert.deepEqual(await backup.decode(encoded),original);
  await assert.rejects(backup.decode(encoded.replace('eval-1','eval-2')),/checksum/);
});
test('Conflicting Firebase records and other-account namespaces are never proposed as missing',()=>{
  const source=payload({[key]:'old','flympus:user:bob:ct-review-evals':'private','ct-review-roster':'legacy'});
  const target=payload({[key]:'new'}),before=JSON.stringify(target);
  const result=backup.plan(source,target,'alice');
  assert.equal(result.missing.length,0);assert.equal(result.conflicts.length,1);assert.equal(result.archived.length,2);
  assert.equal(JSON.stringify(target),before);
});
test('Comparison identifies absent and identical values without writing storage',()=>{
  const other='flympus:user:alice:ct-review-daily-reports:course-b';
  const result=backup.plan(payload({[key]:'same',[other]:'schedule'}),payload({[key]:'same'}),'alice');
  assert.deepEqual(result.missing.map(x=>x.key),[other]);assert.equal(result.identical.length,1);
});
test('UID mismatch and credentials/authorization data are rejected',()=>{
  assert.throws(()=>backup.plan(payload(),{...payload(),uid:'bob'},'bob'),/same Firebase account/);
  for(const forbidden of ['firebase:authUser:api:[DEFAULT]','flympus-auth-scope-uid','flympus:user:alice:flympus-auth-verified-active-v1']){
    assert.equal(backup.allowedKey(forbidden),false);
    assert.throws(()=>backup.validate(payload({[forbidden]:'credential'})),/unsupported storage/);
  }
});
test('Safety photo bytes, keys and MIME types survive verified backup; invalid photos are rejected',async()=>{
  const original={...payload(),photos:[{key:JSON.stringify(['alice','course-a','photo-123']),type:'image/jpeg',base64:'aGVsbG8='}]};
  assert.deepEqual(await backup.decode(await backup.encode(original)),original);
  for(const photo of [{...original.photos[0],base64:'invalid!!'},{...original.photos[0],key:'other'},{...original.photos[0],type:'text/html'}])
    assert.throws(()=>backup.validate({...original,photos:[photo]}),/Invalid Safety/);
});
test('Missing-only restore refuses concurrent conflicts and rolls back only its own inserts',async()=>{
  const values=new Map([['existing','destination']]);
  const adapter={get:key=>values.has(key)?values.get(key):null,set:(key,value)=>values.set(key,value),remove:key=>values.delete(key)};
  await assert.rejects(backup.applyMissingStorage([{key:'new',value:'source'},{key:'existing',value:'source'}],adapter),/Target changed/);
  assert.deepEqual([...values],[['existing','destination']]);
  await assert.rejects(backup.applyMissingStorage([{key:'new',value:'source'}],adapter,async()=>{
    values.set('new','concurrent destination edit');throw new Error('Photo transaction aborted');
  }),/Photo transaction/);
  assert.equal(values.get('new'),'concurrent destination edit');
});
test('Photo failure or quota failure preserves all pre-existing values',async()=>{
  const values=new Map([['existing','destination']]);
  const adapter={get:key=>values.has(key)?values.get(key):null,set:(key,value)=>{if(key==='quota')throw new Error('Quota');values.set(key,value)},remove:key=>values.delete(key)};
  await assert.rejects(backup.applyMissingStorage([{key:'new',value:'source'},{key:'quota',value:'source'}],adapter),/Quota/);
  assert.deepEqual([...values],[['existing','destination']]);
  await assert.rejects(backup.applyMissingStorage([{key:'new',value:'source'}],adapter,async()=>{throw new Error('Photo transaction aborted')}),/Photo transaction/);
  assert.deepEqual([...values],[['existing','destination']]);
  assert.equal(await backup.applyMissingStorage([{key:'new',value:'source'}],adapter),1);
  assert.equal(values.get('existing'),'destination');assert.equal(values.get('new'),'source');
});
