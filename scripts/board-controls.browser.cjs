const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const out='artifacts/board-controls-runtime';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox']});const report=[];
try{for(const viewport of [{width:390,height:844},{width:1280,height:900}])for(const reducedMotion of ['no-preference','reduce']){
const context=await browser.newContext({viewport,reducedMotion});
await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:5201\//.test(r.request().url())?r.continue():r.abort());await context.routeWebSocket(/.*/,ws=>ws.close());
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5201/?resultReview');await page.locator('#opening-play').click({timeout:60000});
await page.waitForFunction(()=>window.__checkersScene?.phase==='human'&&window.__checkersScene?.hud?.isActionsReady(),{},{timeout:60000});
for(const outcome of ['loss','win','draw']){
if(outcome==='loss')await page.evaluate(()=>window.__checkersScene.resignMatch());else await page.evaluate(o=>window.dispatchEvent(new CustomEvent('result-review',{detail:o})),outcome);
await page.locator('.verdict-panel').waitFor({state:'visible'});await page.waitForTimeout(400);await page.evaluate(()=>document.fonts.ready);
const id=`${viewport.width}-${reducedMotion}-${outcome}`;
await page.screenshot({path:`${out}/${id}-dialog.png`});
await page.getByRole('button',{name:'Посмотреть доску',exact:true}).click();
assert.equal(await page.evaluate(()=>window.__checkersScene.phase),'over');
const frozen=await page.evaluate(()=>({position:JSON.stringify(window.__checkersScene.position),clocks:JSON.stringify(window.__checkersScene.clocks)}));
await page.evaluate(()=>{const s=window.__checkersScene;window.__resultReplayCount=0;s.title.resultSting=()=>window.__resultReplayCount++;});
const canvas=page.locator('canvas[aria-description]');const box=await canvas.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
const metrics=await page.evaluate(async()=>{const {matchLayout}=await import('/src/client/config/matchLayout.ts');const l=matchLayout(innerWidth,innerHeight);return {layout:l,buttons:[...document.querySelectorAll('.verdict-status button')].map(e=>{const b=e.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(e);const t=r.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,x:b.x,y:b.y,width:b.width,height:b.height,textWidth:t.width,font:s.font,fontLoaded:document.fonts.check(s.font),underline:s.textDecorationLine};})};});
for(const b of metrics.buttons){assert(b.height>=44);assert(b.width-b.textWidth>=16);assert(b.fontLoaded);assert.equal(b.underline,'none');}
assert(metrics.buttons[0].x+192<=metrics.layout.you.x+223*metrics.layout.panelScale);
await page.screenshot({path:`${out}/${id}-board.png`});
await page.screenshot({path:`${out}/${id}-crop.png`,clip:{x:metrics.layout.you.x,y:metrics.layout.you.y,width:374*metrics.layout.panelScale,height:128*metrics.layout.panelScale}});
await page.waitForTimeout(1100);assert.deepEqual(await page.evaluate(()=>({position:JSON.stringify(window.__checkersScene.position),clocks:JSON.stringify(window.__checkersScene.clocks)})),frozen);
for(let i=0;i<2;i++){await page.keyboard.press('Escape');await page.locator('.verdict-panel').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('.verdict-status').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.activeElement?.dataset.verdict),'open');}
await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.verdict),'menu');
assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineWidth),'3px');
await page.locator('.verdict-status [data-verdict="open"]').hover();
assert.equal(await page.locator('.verdict-status [data-verdict="open"]').evaluate(e=>getComputedStyle(e).outlineWidth),'1px');
assert.equal(await page.evaluate(()=>window.__resultReplayCount),0);
assert.deepEqual(await page.evaluate(()=>({position:JSON.stringify(window.__checkersScene.position),clocks:JSON.stringify(window.__checkersScene.clocks)})),frozen);
await page.screenshot({path:`${out}/${id}-focus.png`});
report.push({id,metrics,errors});
if(outcome!=='draw'){await page.getByRole('button',{name:/Итог партии:/}).click();await page.locator('[data-verdict="again"]').click();await page.waitForFunction(()=>window.__checkersScene?.phase==='human'&&window.__checkersScene.hud.isActionsReady(),{},{timeout:60000});}
else{await page.locator('.verdict-status [data-verdict="menu"]').click();assert.equal(await page.evaluate(()=>window.__checkersScene.phase),'title');}
}await context.close();}
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log('PASS',report.length,'real outcome/lifecycle cases');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
