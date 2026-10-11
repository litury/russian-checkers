import { chromium } from '/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox'],headless:true});
await mkdir('evidence',{recursive:true});
const results=[];
try {
for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:844}});
 await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:5196\//.test(r.request().url())?r.continue():r.abort());
 await context.routeWebSocket('**/*',ws=>ws.close());
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:5196');
 await page.locator('#opening-play').click({timeout:60000});
 await page.locator('#match-resign').waitFor({state:'visible',timeout:60000});
 await page.waitForTimeout(2000);
 await page.locator('#match-resign').click();await page.locator('#resign-continue').click();await page.waitForTimeout(320);
 for(const action of ['cancel','escape']) for(const phase of [0,50,150,300]){
  const sample=await page.evaluate(async ({action,phase})=>{
   const d=document.querySelector('#resign-confirmation');
   document.querySelector('#match-resign').click();
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   for(const a of document.getAnimations().filter(a=>a.effect?.target===d)){a.pause();a.currentTime=phase;}
   await new Promise(r=>requestAnimationFrame(r));
   const read=()=>{const s=getComputedStyle(d,'::before');return {y:new DOMMatrix(s.transform).m42,opacity:Number(s.opacity),backdrop:getComputedStyle(d,'::backdrop').backgroundColor};};
   const before=read();
   if(action==='cancel')document.querySelector('#resign-continue').click();
   else d.dispatchEvent(new Event('cancel',{cancelable:true}));
   const after=read();
   for(const a of document.getAnimations().filter(a=>a.effect?.target===d)){a.pause();a.currentTime=140;}
   const middle=read();
   return {before,after,middle};
  },{action,phase});
  if(Math.abs(sample.before.y-sample.after.y)>.01||Math.abs(sample.before.opacity-sample.after.opacity)>.001||sample.before.backdrop!==sample.after.backdrop)throw Error(`discontinuity ${width}/${action}/${phase}: ${JSON.stringify(sample)}`);
  if(sample.middle.y<sample.after.y-.01)throw Error('exit moved upward');
  results.push({width,action,phase,...sample});
  await page.waitForTimeout(320);
  if(!await page.locator('#match-resign').evaluate(b=>document.activeElement===b))throw Error('early focus');
 }
 for(const delay of [50,300]){
  const sample=await page.evaluate(async delay=>{
   document.querySelector('#match-resign').click();
   const started=performance.now();
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   for(const animation of document.getAnimations()){
    if(animation.effect?.target===document.querySelector('#resign-confirmation')){animation.pause();animation.currentTime=delay;}
   }
   await new Promise(r=>requestAnimationFrame(r));
   const d=document.querySelector('#resign-confirmation'),b=document.querySelector('#resign-continue');
   const rect=b.getBoundingClientRect(); const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
   const style=getComputedStyle(d,'::before');
   const other=document.querySelector('#resign-confirm'),otherRect=other.getBoundingClientRect(),otherHit=document.elementFromPoint(otherRect.x+otherRect.width/2,otherRect.y+otherRect.height/2);
   return {animationTime:delay,confirmHit:other===otherHit||other.contains(otherHit),elapsed:performance.now()-started,hit:b===hit||b.contains(hit),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},dialog:{x:d.getBoundingClientRect().x,y:d.getBoundingClientRect().y,width:d.getBoundingClientRect().width,height:d.getBoundingClientRect().height},duration:style.animationDuration,transform:style.transform,backdrop:getComputedStyle(d,'::backdrop').backgroundColor};
  },delay);
  if(!sample.hit||!sample.confirmHit)throw Error('button miss');
  if(delay===300)await page.screenshot({path:`evidence/resign-${width}.png`});
  await page.evaluate(()=>{const b=document.querySelector('#resign-continue'); b.addEventListener('click',()=>{queueMicrotask(()=>{window.exitState={open:document.querySelector('#resign-confirmation').open,closing:document.querySelector('#resign-confirmation').hasAttribute('data-closing')};});},{once:true});});
  await page.mouse.click(sample.rect.x+sample.rect.width/2,sample.rect.y+sample.rect.height/2);
  if(!await page.evaluate(()=>window.exitState.open&&window.exitState.closing))throw Error('exit not retained');
  await page.waitForTimeout(320);
  if(!await page.locator('#match-resign').evaluate(b=>document.activeElement===b))throw Error('focus not restored');
  results.push({width,delay,...sample});
 }
 await page.locator('#match-resign').click();await page.keyboard.press('Escape');await page.waitForTimeout(320);
 if(await page.locator('#resign-confirmation').evaluate(d=>d.open))throw Error('escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('#match-resign').click();
 if(await page.locator('#resign-confirmation').evaluate(d=>getComputedStyle(d,'::before').animationName)!=='none')throw Error('reduced motion');
 await page.locator('#resign-continue').click();
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('#match-resign').click();await page.locator('#resign-confirm').click();
 await page.waitForTimeout(1500);await page.screenshot({path:`evidence/verdict-${width}.png`});
 await context.close();
}
await writeFile('evidence/browser.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
