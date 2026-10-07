const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync(require('node:path').join(__dirname,'..','theme-controller.js'),'utf8');

function boot({prefs={theme:'system'},resolved='',systemResolved='',systemDark=false}={}){
  const values=new Map([
    ['flympus-app-preferences',JSON.stringify(prefs)],
    ...(resolved?[['flympus-last-resolved-theme',resolved]]:[]),
    ...(systemResolved?[['flympus-system-resolved-theme',systemResolved]]:[])
  ]);
  const attributes=new Map();
  const classes=new Set();
  const documentEvents=new Map();
  const windowEvents=new Map();
  const mediaEvents=new Map();
  const metas={
    'theme-color':{content:'#07294c',setAttribute(name,value){this[name]=value}},
    'color-scheme':{content:'light',setAttribute(name,value){this[name]=value}}
  };
  let now=0;
  let unavailable=false;
  let samples=0;
  const document={
    visibilityState:'visible',
    documentElement:{
      style:{setProperty(name,value){this[name]=value}},
      setAttribute(name,value){attributes.set(name,String(value))},
      getAttribute(name){return attributes.get(name)||null},
      classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),toggle(name,on){on?classes.add(name):classes.delete(name)},contains:name=>classes.has(name)}
    },
    querySelector(selector){const match=selector.match(/meta\[name="([^"]+)"\]/);return match?metas[match[1]]||null:null},
    addEventListener(name,fn){documentEvents.set(name,fn)}
  };
  const query={
    matches:systemDark,
    addEventListener(name,fn){mediaEvents.set(name,fn)}
  };
  const window={
    matchMedia(){samples++;return query},
    addEventListener(name,fn){windowEvents.set(name,fn)}
  };
  const context={
    window,document,
    localStorage:{getItem:key=>{if(unavailable)throw Error('Storage unavailable');return values.get(key)||null},setItem:(key,value)=>{if(unavailable)throw Error('Storage unavailable');values.set(key,String(value))}},
    performance:{now:()=>now},Date,Set,JSON,Object,String
  };
  vm.runInNewContext(source,context);
  return {window,document,attributes,values,metas,documentEvents,windowEvents,mediaEvents,setNow:value=>{now=value},setUnavailable:value=>{unavailable=value},samples:()=>samples,query};
}

test('System result cannot be changed by delayed iOS media events or resume storage errors',()=>{
  const app=boot({prefs:{theme:'system'},resolved:'light',systemDark:true});
  assert.equal(app.attributes.get('data-flympus-theme'),'light');
  assert.equal(app.mediaEvents.size,0,'No timing threshold can distinguish an iOS transient media event reliably');
  assert.equal(app.samples(),0,'Stored System resolution must bypass startup sampling');
  for(const time of [100,1700,30000]){
    app.setNow(time);app.query.matches=true;app.setUnavailable(true);
    app.windowEvents.get('pageshow')();
    app.document.visibilityState='visible';app.documentEvents.get('visibilitychange')();
    assert.equal(app.attributes.get('data-flympus-theme'),'light');
    assert.equal(app.metas['color-scheme'].content,'light');
    assert.equal(app.samples(),0);
  }
});

test('explicit theme selections apply synchronously and locale is available before paint',()=>{
  const app=boot({prefs:{theme:'light',language:'he',largerText:true},resolved:'dark',systemDark:true});
  assert.equal(app.attributes.get('data-flympus-theme'),'light');
  assert.equal(app.attributes.get('data-flympus-theme-mode'),'light');
  assert.equal(app.attributes.get('lang'),'he');
  assert.equal(app.attributes.get('dir'),'rtl');
  assert.equal(app.metas['theme-color'].content,'#0b3157');

  app.window.FLYMPUS_THEME.applyPreferences({theme:'dark'},{selectionChanged:true});
  assert.equal(app.attributes.get('data-flympus-theme'),'dark');
  assert.equal(app.metas['theme-color'].content,'#0d1e2f');
});

for(const mode of ['light','dark'])test(`${mode} wins over opposite persisted/System values on every lifecycle`,()=>{
  const opposite=mode==='light'?'dark':'light';
  const app=boot({prefs:{theme:mode},resolved:opposite,systemDark:opposite==='dark'});
  for(let i=0;i<10;i++){
    app.setUnavailable(true);app.windowEvents.get('pageshow')();
    app.documentEvents.get('visibilitychange')();
    assert.equal(app.attributes.get('data-flympus-theme'),mode);
    assert.equal(app.attributes.get('data-flympus-theme-mode'),mode);
    assert.equal(app.document.documentElement.style.colorScheme,mode);
    assert.equal(app.document.documentElement.style.backgroundColor,mode==='dark'?'#07131f':'#f4f8fc');
  }
});

test('recording: Light → System light → App Switcher → cold reopen with OS dark stays light',()=>{
  const app=boot({prefs:{theme:'system'},resolved:'dark',systemDark:true});
  app.window.FLYMPUS_THEME.applyPreferences({theme:'light'},{selectionChanged:true});
  app.query.matches=false;
  app.values.set('flympus-app-preferences',JSON.stringify({theme:'system'}));
  app.window.FLYMPUS_THEME.applyPreferences({theme:'system'},{selectionChanged:true,sampleSystemNow:true});
  assert.equal(app.values.get('flympus-system-resolved-theme'),'light');
  app.query.matches=true;app.setNow(10000);app.windowEvents.get('pageshow')();
  assert.equal(app.attributes.get('data-flympus-theme'),'light');
  const cold=boot({prefs:{theme:'system'},resolved:app.values.get('flympus-last-resolved-theme'),systemDark:true});
  assert.equal(cold.attributes.get('data-flympus-theme'),'light');
  assert.equal(cold.samples(),0);
});

test('embedded HTML and emergency worker source are identical and need no network theme script',()=>{
  require('node:child_process').execFileSync(process.execPath,['scripts/sync-theme-bootstrap.cjs','--check']);
  const html=fs.readFileSync('index.html','utf8');
  assert(!html.includes('<script src="./theme-controller.js'));
  assert(html.indexOf('id="flympus-theme-bootstrap"')<html.indexOf('<link'));
  assert(!source.includes('setTimeout')&&!source.includes('performance.now'));
});

test('late hydration with missing/default preferences cannot replace first-paint selection',()=>{
 const app=boot({prefs:{theme:'dark'}});
 app.setUnavailable(true);
 app.window.FLYMPUS_THEME.applyPreferences({theme:'system'});
 assert.equal(app.attributes.get('data-flympus-theme'),'dark');
 assert.equal(app.samples(),0);
});

test('explicit Light cannot overwrite the System decision used on a later cold launch',()=>{
 const app=boot({prefs:{theme:'light'},resolved:'light',systemResolved:'dark',systemDark:false});
 assert.equal(app.attributes.get('data-flympus-theme'),'light');
 assert.equal(app.values.get('flympus-system-resolved-theme'),'dark');
 const cold=boot({prefs:{theme:'system'},resolved:'light',systemResolved:'dark',systemDark:false});
 assert.equal(cold.attributes.get('data-flympus-theme'),'dark');
 assert.equal(cold.samples(),0);
});
