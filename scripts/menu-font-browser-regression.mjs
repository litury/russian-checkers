import {chromium,webkit} from '/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright/index.mjs';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','41885','--strictPort'],{cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
await new Promise((r,j)=>{server.stdout.on('data',d=>String(d).includes('41885')&&r());server.on('exit',j);});
const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});const results=[];const base='http://127.0.0.1:41885';
try{
for(const mode of Array.from({length:12},(_,i)=>i%2?'fontblocked':'normal')){
const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:results.length<6?'no-preference':'reduce'});const errors=[];
await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base||(mode==='fontblocked'&&u.pathname.endsWith('.woff2'))||(mode==='atlasblocked'&&/atlas-(DBbtzmbP|B_jcKtdW)/.test(u.pathname)))return r.abort();return r.continue();});await c.routeWebSocket('**/*',w=>w.close());
const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#opening-play:not(:disabled)').waitFor({timeout:30000});await p.waitForTimeout(1500);
const originals=[400,600].map(w=>readFileSync(new URL(`../src/client/fonts/GolosText-${w}-cyrillic.woff2`,import.meta.url)).toString('base64'));
const metrics=await p.evaluate(async(originals)=>{await document.fonts.ready;const ctx=document.createElement('canvas').getContext('2d');const out=[];for(const [font,text] of [['600 42px Literata','РУССКИЕ ШАШКИ'],['600 16px "Golos Text"','С ботом В сети Партии Опции'],['400 16px "Golos Text"','БЕЛЫЕ ЧЁРНЫЕ 0123456789']]){await document.fonts.load(font,text);ctx.font=font;out.push({font,width:ctx.measureText(text).width,loaded:document.fonts.check(font,text)});}const reference=[];for(let i=0;i<2;i++){const w=[400,600][i];const face=new FontFace('OriginalGolos',`url(data:font/woff2;base64,${originals[i]})`,{weight:String(w)});document.fonts.add(await face.load());ctx.font=`${w} 16px OriginalGolos`;reference.push(ctx.measureText(i?'С ботом В сети Партии Опции':'БЕЛЫЕ ЧЁРНЫЕ 0123456789').width);}return {reference,measurements:out,faces:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})),textWidths:['#opening-play','#opening-online','#opening-history','#opening-options'].map(selector=>{const el=document.querySelector(selector);const text=el.querySelector('.opening-cta-label')||el;const range=document.createRange();range.selectNodeContents(text);return {selector,width:range.getBoundingClientRect().width};})};},originals);
assert.ok(metrics.measurements.every(x=>x.loaded));assert.equal(metrics.measurements[1].width,metrics.reference[1]);assert.equal(metrics.measurements[2].width,metrics.reference[0]);
await p.screenshot({path:new URL(`font-swap-${results.length}-${mode}.png`,import.meta.url).pathname});
await p.waitForTimeout(500);
const settledWidths=await p.evaluate(()=>['#opening-play','#opening-online'].map(selector=>{const range=document.createRange();range.selectNodeContents(document.querySelector(selector+' .opening-cta-label'));return {selector,width:range.getBoundingClientRect().width};}));
assert.deepEqual(errors,[]);results.push({mode,metrics,settledWidths,errors});await c.close();
}
await writeFile(new URL('font-swap-regression.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
for (const result of results) { assert.deepEqual(result.metrics.measurements,results[0].metrics.measurements); assert.deepEqual(result.metrics.reference,results[0].metrics.reference); assert.deepEqual(result.metrics.textWidths,results[0].metrics.textWidths); assert.deepEqual(result.settledWidths,results[0].settledWidths); }

try{const w=await webkit.launch({headless:true});await w.close();results.push({webkit:'available'});}catch(e){results.push({webkit:String(e).split('\n')[0]});}
await writeFile(new URL('font-swap-regression.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await b.close();server.kill();}
