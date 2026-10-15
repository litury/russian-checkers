const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const out='artifacts/side-label';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});const results=[];
 async function client(width,motion){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:motion});
  await context.route('**/*',async r=>{const u=new URL(r.request().url());if(!['http://127.0.0.1:5199','http://127.0.0.1:59999'].includes(u.origin))return r.abort();if(u.pathname==='/src/client/app/main.ts'){const response=await r.fetch();return r.fulfill({response,body:(await response.text()).replace('new Phaser.Game(', 'window.__game = new Phaser.Game(')});}return r.continue();});
  await context.routeWebSocket('**/*',ws=>{if(new URL(ws.url()).origin==='ws://127.0.0.1:59999')ws.connectToServer();else ws.close();});
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5199');await page.waitForFunction(()=>window.__game?.scene.scenes[0]?.playfieldBuilt);return {page,context,errors};
 }
 async function snapshot(c,label){const data=await c.page.evaluate(()=>{const s=window.__game.scene.scenes[0];const texts=[];function walk(go){if(go.type==='Text')texts.push({text:go.text,x:go.x,y:go.y});if(go.list)go.list.forEach(walk);}s.children.list.forEach(walk);return {texts,phase:s.phase,side:s.humanSide,ply:s.lastPly,turn:s.position.turn,counting:s.countingIn,aria:document.querySelector('#game canvas').getAttribute('aria-description')};});assert(!data.texts.some(t=>t.text.includes('ВАША СТОРОНА')));assert(data.texts.some(t=>t.text==='Ты'));assert.match(data.aria,new RegExp(data.side==='white'?'белые':'чёрные'));assert(data.texts.some(t=>t.text===(data.phase==='human'?'Ваш ход':'Ход соперника')));assert.deepEqual(c.errors,[]);await c.page.screenshot({path:`${out}/${label}.png`});results.push({label,...data,errors:c.errors});}
 async function moveWhite(c){const canvas=c.page.locator('#game canvas');await canvas.focus();for(const key of ['Enter','ArrowUp','ArrowRight','Enter'])await c.page.keyboard.press(key);}
 try{
 for(const width of [390,1280])for(const motion of ['reduce','no-preference'])for(const side of ['white','black']){
  const c=await client(width,motion);await c.page.locator(`[data-side=${side}]`).click();
  // Delay only the existing bot timer in this test context, preserving the real initial opponent-turn HUD for capture.
  if(side==='black')await c.page.evaluate(()=>{const s=window.__game.scene.scenes[0];s.playBot=()=>{};});
  await c.page.locator('#opening-play').click();await c.page.waitForFunction(()=>{const s=window.__game.scene.scenes[0];return !s.countingIn&&s.phase!=='title'&&s.hud.isActionsReady();});
  await snapshot(c,`bot-${side}-${width}-${motion}`);if(side==='white'){await moveWhite(c);await c.page.waitForFunction(()=>window.__game.scene.scenes[0].matchPlies.length>=2);await c.page.waitForFunction(()=>!window.__game.scene.scenes[0].moving);assert.equal(await c.page.evaluate(()=>window.__game.scene.scenes[0].phase),'human');}
  await c.context.close();
 }
 const clients=[await client(390,'reduce'),await client(1280,'no-preference')];
 for(const c of clients){await c.page.locator('#opening-online').click();await c.page.locator('#online-hub [data-action=find]').click();}
 for(const c of clients)await c.page.waitForFunction(()=>{const s=window.__game.scene.scenes[0];return s.online&&!s.countingIn&&s.phase!=='title'&&s.phase!=='search';},{},{timeout:30000});
 for(let i=0;i<clients.length;i++)await snapshot(clients[i],`online-start-${i}`);
 const sides=await Promise.all(clients.map(c=>c.page.evaluate(()=>window.__game.scene.scenes[0].humanSide)));assert.deepEqual([...sides].sort(),['black','white']);
 await moveWhite(clients[sides.indexOf('white')]);for(const c of clients)await c.page.waitForFunction(()=>window.__game.scene.scenes[0].lastPly===1&&!window.__game.scene.scenes[0].moving);
 for(let i=0;i<clients.length;i++)await snapshot(clients[i],`online-next-turn-${i}`);
 for(const c of clients)await c.context.close();
 fs.writeFileSync(`${out}/matrix.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
