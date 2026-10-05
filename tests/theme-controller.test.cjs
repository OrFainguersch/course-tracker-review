const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync(require('node:path').join(__dirname,'..','theme-controller.js'),'utf8');

function boot({prefs={theme:'system'},resolved='',systemDark=false}={}){
  const values=new Map([
    ['flympus-app-preferences',JSON.stringify(prefs)],
    ...(resolved?[['flympus-last-resolved-theme',resolved]]:[])
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
  const document={
    visibilityState:'visible',
    documentElement:{
      style:{},
      setAttribute(name,value){attributes.set(name,String(value))},
      getAttribute(name){return attributes.get(name)||null},
      classList:{toggle(name,on){on?classes.add(name):classes.delete(name)},contains:name=>classes.has(name)}
    },
    querySelector(selector){const match=selector.match(/meta\[name="([^"]+)"\]/);return match?metas[match[1]]||null:null},
    addEventListener(name,fn){documentEvents.set(name,fn)}
  };
  const query={
    matches:systemDark,
    addEventListener(name,fn){mediaEvents.set(name,fn)}
  };
  const window={
    matchMedia(){return query},
    addEventListener(name,fn){windowEvents.set(name,fn)}
  };
  const context={
    window,document,
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))},
    performance:{now:()=>now},Date,Set,JSON,Object,String
  };
  vm.runInNewContext(source,context);
  return {window,document,attributes,values,metas,documentEvents,windowEvents,mediaEvents,setNow:value=>{now=value}};
}

test('system mode keeps the last stable theme through initial paint and resume',()=>{
  const app=boot({prefs:{theme:'system',language:'en'},resolved:'light',systemDark:true});
  assert.equal(app.attributes.get('data-flympus-theme'),'light','first paint must use the stable stored theme, not a transient iOS sample');
  assert.equal(app.metas['color-scheme'].content,'light');

  app.setNow(100);
  app.windowEvents.get('pageshow')();
  app.mediaEvents.get('change')({matches:true});
  assert.equal(app.attributes.get('data-flympus-theme'),'light','transient appearance changes during resume must be ignored');

  app.setNow(1700);
  app.mediaEvents.get('change')({matches:true});
  assert.equal(app.attributes.get('data-flympus-theme'),'dark','a genuine foreground system-theme change must be committed');
  assert.equal(app.values.get('flympus-last-resolved-theme'),'dark');
});

test('explicit theme selections apply synchronously and locale is available before paint',()=>{
  const app=boot({prefs:{theme:'light',language:'he',largerText:true},resolved:'dark',systemDark:true});
  assert.equal(app.attributes.get('data-flympus-theme'),'light');
  assert.equal(app.attributes.get('data-flympus-theme-mode'),'light');
  assert.equal(app.attributes.get('lang'),'he');
  assert.equal(app.attributes.get('dir'),'rtl');

  app.window.FLYMPUS_THEME.applyPreferences({theme:'dark'});
  assert.equal(app.attributes.get('data-flympus-theme'),'dark');
  assert.equal(app.metas['theme-color'].content,'#07131f');
});
