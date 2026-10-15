const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/play-menu';const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});const results=[];
 try{
 for(const width of [390,1280]){
  const ctx=await b.newContext({viewport:{width,height:844}});
  await ctx.route('**/*',r=>/^http:\/\/127\.0\.0\.1:5198\//.test(r.request().url())?r.continue():r.abort());
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const cache of ['cold','warm']){
   await p.goto('http://127.0.0.1:5198/');await p.waitForFunction(()=>window.checkersStartup.framePresented);
   const first=await p.locator('#opening-play').innerText();assert.equal(first,'Играть');
   await p.locator('#opening-play').click();
   assert.equal(await p.locator('#opening-play').innerText(),'С ботом');
   assert.equal(await p.evaluate(()=>window.checkersStartup.pendingPlay),false);
   // The same atlas is already mounted; entering modes must not discover a new image family.
   await p.waitForFunction(()=>window.checkersStartup.engineLoaded);
   const atlasBefore=await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name===document.querySelector('link[rel="preload"][as="image"]').href).length);
   await p.locator('#opening-options').click();await p.locator('#opening-play').click();
   const atlasAfter=await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name===document.querySelector('link[rel="preload"][as="image"]').href).length);assert.equal(atlasAfter,atlasBefore);
   await p.locator('#opening-play').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'opening-online');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'opening-options');
   await p.keyboard.press('Enter');assert.equal(await p.locator('#opening-play').innerText(),'Играть');
   await p.locator('#opening-play').dblclick();assert.equal(await p.evaluate(()=>window.checkersStartup.pendingPlay||window.checkersStartup.playCommitted),false);
   results.push({width,cache,first,atlasBefore,atlasAfter,errors});
  }
  await ctx.close();
 }
 }finally{await b.close();}
 fs.writeFileSync(`${out}/cold-warm.json`,JSON.stringify(results,null,2));console.log(results);
})().catch(e=>{console.error(e);process.exitCode=1;});
