import { chromium } from '/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const out=process.env.EVIDENCE || 'evidence/resign-composition-before';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox']});
const results=[];
try {
for(const url of (process.env.URLS || 'http://127.0.0.1:5217,https://damka.fun').split(',')) for(const width of (process.env.WIDTHS || '390,1280').split(',').map(Number)) {
 const context=await browser.newContext({viewport:{width,height:844}});
 const page=await context.newPage();
 await page.goto(url);
 await page.locator('#opening-play').click({timeout:60000});
 await page.locator('#match-resign').waitFor({state:'visible',timeout:60000});
 await page.waitForTimeout(2000);
 for(const pass of ['cold','warm']) {
 await page.locator('#match-resign').evaluate(b=>b.click());
 await page.waitForFunction(()=>document.querySelector('#resign-confirmation').open);
 const frames=await page.evaluate(async()=>{
 const d=document.querySelector('#resign-confirmation');
 const read=(el,pseudo)=>{const s=getComputedStyle(el,pseudo),r=el.getBoundingClientRect();return {visibility:s.visibility,opacity:s.opacity,transform:s.transform,animation:s.animationName,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};};
 const rows=[];
 for(const time of [0,50,140,280]) {
 for(const a of document.getAnimations().filter(a=>a.effect?.target===d)){a.pause();a.currentTime=time;}
 await new Promise(r=>requestAnimationFrame(r));
 rows.push({time,sheet:read(d),background:read(d,'::before'),text:read(d.querySelector('h2')),actions:read(d.querySelector('.resign-choices'))});
 }
 return rows;
 });
 results.push({url,width,pass,frames});
 if(process.env.VERIFY) for(const f of frames){
 if(f.background.animation!=='none'||Math.abs(f.text.rect.y-f.sheet.rect.y-38)>.02||Math.abs(f.actions.rect.y-f.sheet.rect.y-126.796875)>.02)throw Error('composition split');
 }
 console.log(JSON.stringify({url,width,pass,frames}));
 await writeFile(`${out}/timeline.json`,JSON.stringify(results,null,2));
 for(const time of (process.env.VERIFY ? [] : [0,50,140,280])) {
 await page.evaluate(time=>{const d=document.querySelector('#resign-confirmation');for(const a of document.getAnimations().filter(a=>a.effect?.target===d))a.currentTime=time;},time);
 await page.screenshot({path:`${out}/${url.startsWith('https')?'live':'local'}-${width}-${pass}-${time}.png`,timeout:5000}).catch(e=>console.log('Screenshot failed: '+e.message));
 await page.screenshot({path:`${out}/${url.startsWith('https')?'live':'local'}-${width}-${pass}-${time}-crop.png`,timeout:5000,clip:{x:width===390?0:440,y:width===390?500:290,width:width===390?390:400,height:width===390?344:270}}).catch(e=>console.log('Crop failed: '+e.message));
 }
 await page.locator('#resign-continue').evaluate(b=>b.click());await page.waitForTimeout(320);
 }
 if(process.env.VERIFY){
 for(const phase of [0,50,140]){
 const continuity=await page.evaluate(async phase=>{
 const d=document.querySelector('#resign-confirmation');document.querySelector('#match-resign').click();
 await new Promise(r=>requestAnimationFrame(r));
 for(const a of document.getAnimations().filter(a=>a.effect?.target===d)){a.pause();a.currentTime=phase;}
 const before=getComputedStyle(d).transform;
 d.dispatchEvent(new Event('cancel',{cancelable:true}));
 return {before,after:getComputedStyle(d).transform};
 },phase);
 if(continuity.before!==continuity.after)throw Error('interrupted exit jump');
 await page.waitForTimeout(320);
 if(await page.locator('#resign-confirmation').evaluate(d=>d.open))throw Error('exit timer');
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('#match-resign').click();
 if(await page.locator('#resign-confirmation').evaluate(d=>getComputedStyle(d).animationName)!=='none')throw Error('reduced motion');
 await page.locator('#resign-continue').click();
 await page.locator('#match-resign').click();
 await page.locator('#resign-confirm').click();
 if(await page.locator('#resign-confirmation').evaluate(d=>d.open))throw Error('confirm close');
 console.log(`Lifecycle verified ${width}`);
 }
 await context.close();
}
await writeFile(`${out}/timeline.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
} finally {await browser.close();}
