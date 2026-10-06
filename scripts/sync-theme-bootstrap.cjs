const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'theme-controller.js'),'utf8').trim();
const start='<!-- FLYMPUS_THEME_BOOTSTRAP_START -->',end='<!-- FLYMPUS_THEME_BOOTSTRAP_END -->';
const boot=`${start}\n<script id="flympus-theme-bootstrap">\n${source}\n</script>\n<style>html,body{background:var(--flympus-canvas);color:var(--flympus-ink)}html.flympusThemeCommit *,html.flympusThemeCommit *::before,html.flympusThemeCommit *::after{transition:none!important}</style>\n${end}`;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nextHtml=html.includes(start)?html.replace(new RegExp(start+'[\\s\\S]*?'+end),()=>boot):html.replace(/<script src="\.\/theme-controller\.js\?[^\"]+"><\/script>/,()=>boot);
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const nextSw=sw.replace(/\/\* THEME_SOURCE_START \*\/[\s\S]*?\/\* THEME_SOURCE_END \*\//,()=>`/* THEME_SOURCE_START */\nconst THEME_BOOTSTRAP=${JSON.stringify(source)};\n/* THEME_SOURCE_END */`);
if(nextHtml===html&&!html.includes(start))throw new Error('Missing HTML theme bootstrap marker');
if(!sw.includes('/* THEME_SOURCE_START */'))throw new Error('Missing worker theme bootstrap marker');
for(const [file,before,after] of [['index.html',html,nextHtml],['sw.js',sw,nextSw]]){
 if(process.argv.includes('--check')){if(before!==after)throw new Error(`${file}: embedded theme differs from its authoritative source`)}
 else if(before!==after)fs.writeFileSync(path.join(root,file),after)
}
console.log('HTML and emergency worker shell use the identical pre-paint theme authority');
