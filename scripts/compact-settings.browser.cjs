const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});
 const results=[];
 try {
  for(const scenario of ['cold','art-failure','storage-denied','delayed-font-long-label']) {
   const context=await browser.newContext({viewport:{width:320,height:480},reducedMotion:'reduce'});
   const errors=[]; const requests=[];
   await context.route('**/*',async route=>{
    const url=route.request().url();
    if(!url.startsWith('http://127.0.0.1:5204/')) return route.abort();
    if(scenario==='art-failure' && /dialog-neutral|search-button/.test(url)) return route.abort();
    if(scenario==='delayed-font-long-label' && /woff/.test(url)) await new Promise(resolve=>setTimeout(resolve,1200));
    return route.continue();
   });
   await context.routeWebSocket('**/*',ws=>ws.close());
   if(scenario==='storage-denied') await context.addInitScript(()=>{
    for(const method of ['getItem','setItem','removeItem']) Storage.prototype[method]=()=>{throw new DOMException('Denied','SecurityError');};
   });
   const page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(/dialog-neutral|search-button/.test(r.url()))requests.push(r.url());});
   await page.goto('http://127.0.0.1:5204/');
   await page.locator('#opening-options').click();
   await page.locator('#opening-settings-dialog').waitFor({state:'visible'});
   if(scenario==='delayed-font-long-label') {
    await page.locator('label:has(#settings-vibration)').evaluate(el=>el.append(' — тактильный отклик устройства'));
    await page.evaluate(()=>document.fonts.ready);
   }
   for(const id of ['settings-muted','settings-vibration','settings-auto']) {
    const el=page.locator('#'+id); const before=await el.isChecked();
    await el.focus(); await page.keyboard.press('Space'); assert.equal(await el.isChecked(),!before);
    const rect=await el.boundingBox(); assert(rect.width>=44&&rect.height>=44);
   }
   const geometry=await page.locator('#opening-settings-dialog').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,client:el.clientWidth,scroll:el.scrollWidth,font:getComputedStyle(el.querySelector('label')).fontSize}));
   assert(geometry.scroll<=geometry.client); assert.equal(geometry.font,'16px');
   await page.locator('#settings-close').scrollIntoViewIfNeeded();
   await page.screenshot({path:`artifacts/settings-${scenario}-320.png`});
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('dialog[open]').count(),0);
   assert.deepEqual(errors,[]);
   results.push({scenario,geometry,errors,artRequests:[...new Set(requests)]});
   await context.close();
  }
 } finally { await browser.close(); fs.writeFileSync('artifacts/compact-settings-matrix.json',JSON.stringify(results,null,2)); }
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
