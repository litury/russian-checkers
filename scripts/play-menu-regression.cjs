const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs'); const assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/play-menu'; fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});
 const clients=[],results=[];
 const deadline=setTimeout(()=>{console.error('browser regression deadline');b.close();},90000);
 try {
 async function client(width,reduced=false,offline=false){
  const context=await b.newContext({viewport:{width,height:844},reducedMotion:reduced?'reduce':'no-preference'});
  await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:(5198|8798)\//.test(r.request().url())&&!(offline&&r.request().url().includes(':8798/'))?r.continue():r.abort());
  const p=await context.newPage();let beats=0,ws=0;const errors=[];const images=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('websocket',()=>ws++);
  p.on('request',r=>{if(r.url().endsWith('/stats/presence')&&r.method()==='POST')beats++;if(r.resourceType()==='image')images.push(r.url());});
  await p.goto('http://127.0.0.1:5198');await p.waitForFunction(()=>window.checkersStartup.engineLoaded);
  const c={context,p,stats:()=>({beats,ws,errors}),images};clients.push(c);return c;
 }
 async function main(p){if(await p.locator('#opening').getAttribute('data-menu-page')==='modes')await p.locator('#opening-options').click();assert.equal(await p.locator('#opening-play').innerText(),'Играть');}
 async function modes(p){await main(p);await p.locator('#opening-play').click();assert.equal(await p.locator('#opening-play').innerText(),'С ботом');assert.equal(await p.locator('#opening-history').isVisible(),false);assert.equal(await p.locator('#opening-options').innerText(),'Назад');}
 const a=await client(390); await a.p.waitForFunction(()=>document.querySelector('#opening-menu-online-count')?.textContent===' · 1');
 assert.equal(await a.p.locator('#opening-online').isVisible(),false);
 await a.p.screenshot({path:`${out}/390-main-live.png`});
 const c=await client(1280);await c.p.waitForFunction(()=>document.querySelector('#opening-menu-online-count')?.textContent===' · 2');
 await a.p.waitForFunction(()=>document.querySelector('#opening-menu-online-count')?.textContent===' · 2',null,{timeout:12000});
 for(const who of [a,c]){
  const p=who.p;const oldWs=who.stats().ws;
  await modes(p);const box=await p.locator('#opening-online').boundingBox();assert(box.height>=44);
  const badge=await p.locator('#opening-menu-online-count').boundingBox();assert(badge.x>=box.x&&badge.x+badge.width<=box.x+box.width&&badge.y>=box.y&&badge.y+badge.height<=box.y+box.height);
  await p.screenshot({path:`${out}/${who===a?390:1280}-modes-live.png`});
  await p.keyboard.press('Escape');assert.equal(await p.locator('#opening-play').innerText(),'Играть');assert.equal(await p.evaluate(()=>document.activeElement.id),'opening-play');
  await p.locator('#opening-options').click();await p.locator('#opening-settings-dialog').waitFor({state:'visible'});await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'opening-options');
  await p.locator('#opening-history').click();await p.locator('#match-history').waitFor({state:'visible'});await p.keyboard.press('Escape');
  for(let i=0;i<3;i++){
   await modes(p);await p.locator('#opening-online').click();await p.locator('#online-hub').waitFor({state:'visible'});
   assert.equal(await p.locator('#online-hub-title').textContent(),'Онлайн: 2');
   assert.equal((await fetch('http://127.0.0.1:8798/health').then(r=>r.json())).queue,0);
   await p.locator('#online-hub [data-action=cancel]').click();
  }
  assert.equal(who.stats().ws,oldWs);results.push({scenario:'main/modes/Escape/settings/profile/3 hub cycles, no autoqueue or added WS',width:who===a?390:1280,box,badge,stats:who.stats()});
 }
 await modes(c.p);const before=await c.p.locator('#opening-online').boundingBox();
 await c.p.route('**/stats/presence',r=>r.abort());
 await c.p.waitForFunction(()=>document.querySelector('#opening-menu-online-count').hidden,null,{timeout:12000,polling:100});
 assert.equal((await c.p.locator('#opening-online').innerText()).trim(),'Онлайн');assert.deepEqual(await c.p.locator('#opening-online').boundingBox(),before);
 await c.p.unroute('**/stats/presence');await c.p.waitForFunction(()=>document.querySelector('#opening-menu-online-count').textContent===' · 2',null,{timeout:12000,polling:100});
 for(const who of [a,c])assert.deepEqual(who.stats().errors,[]);
 const off=await client(390,true,true);await modes(off.p);await off.p.locator('#opening-play').dblclick();
 await off.p.waitForFunction(()=>document.querySelector('#opening').hidden,null,{timeout:20000});
 await off.p.locator('#match-resign').waitFor({state:'visible'});assert.deepEqual(off.stats().errors,[]);
 await off.p.waitForFunction(()=>window.__damkaPerf?.marks['first-move-allowed']!==undefined);
 await off.p.mouse.click(38.5684,439.3421);await off.p.mouse.click(83.2632,394.6474);
 await off.p.waitForFunction(()=>window.__damkaPerf?.marks['first-move-played']!==undefined);
 await off.p.waitForFunction(()=>!document.querySelector('#match-undo').disabled);
 await off.p.screenshot({path:`${out}/390-offline-bot.png`});results.push({scenario:'API unavailable, reduced motion, bot double-click opens single game',stats:off.stats()});
 await off.p.locator('#match-resign').click();await off.p.locator('#resign-confirm').click();
 await off.p.locator('[data-verdict="menu"]:visible').click();
 await off.p.locator('#opening').waitFor({state:'visible'});assert.equal(await off.p.locator('#opening-play').innerText(),'Играть');
 results.push({scenario:'actual a3-b4, bot reply/Undo enabled, resign→menu restores Играть',errors:off.stats().errors});
 for(const who of clients)await who.context.close();
 fs.writeFileSync(`${out}/regression.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 } finally {clearTimeout(deadline);await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
