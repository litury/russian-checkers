const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[]; fs.mkdirSync('profile-evidence',{recursive:true});
 try {
 for(const viewport of [{width:390,height:844},{width:1365,height:900}]) {
 const context=await browser.newContext({viewport,reducedMotion:'reduce'});
 let mode='empty', requests=0;
 await context.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(!['127.0.0.1','localhost'].includes(u.hostname)) return route.abort();
 if(u.pathname==='/players/guest')return route.fulfill({json:{id:'fixture-player',token:'fixture-token'}});
 if(u.pathname==='/matches') {requests++; if(mode==='loading')await new Promise(r=>setTimeout(r,600));return mode==='error'?route.fulfill({status:503,body:'unavailable'}):route.fulfill({json:{matches:mode==='list'?[{id:'fixture-match',mode:'bot',winner:'white',startedAt:'2026-10-01T12:00:00Z',color:'white',plies:2}]:[]}});}
 if(u.pathname==='/matches/fixture-match')return route.fulfill({json:{id:'fixture-match',mode:'bot',winner:'white',startedAt:'2026-10-01T12:00:00Z',color:'white',plies:2,pliesList:[{side:'white',from:'a3',path:['b4']},{side:'black',from:'b6',path:['a5']}]}});
 if(u.port!=='5196')return route.fulfill({json:{live:1,white:0,black:0,games:0}});
 return route.continue();
 });
 await context.routeWebSocket('**/*',ws=>ws.close());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/');
 await page.waitForFunction(()=>document.querySelector('#match-history')?.dataset.bound==='true');
 const entry=page.getByRole('button',{name:'Профиль',exact:true});
 await entry.click();await page.getByText('Пока нет партий',{exact:true}).waitFor();
 assert.equal(await page.locator('#match-history-title').textContent(),'Профиль');
 await page.locator('#match-history-back').focus(); await page.keyboard.press('Shift+Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'profile-rules');
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'match-history-back');
 await page.screenshot({path:`profile-evidence/profile-empty-${viewport.width}.png`});
 await page.locator('#profile-rules').click();await page.locator('#opening-help-dialog').waitFor({state:'visible'});
 await page.keyboard.press('Escape');assert(await page.locator('#match-history').isVisible());
 assert.equal(await page.evaluate(()=>document.activeElement.id),'profile-rules');
 await page.locator('#match-history-back').click();await page.locator('#match-history').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement.id),'opening-history');
 mode='loading';await entry.click();await page.getByText('Загрузка…',{exact:true}).waitFor();await page.getByText('Пока нет партий',{exact:true}).waitFor();
 await page.locator('#match-history-back').click();await page.locator('#match-history').waitFor({state:'hidden'});
 mode='error';await entry.click();await page.getByText('Не удалось загрузить партии',{exact:true}).waitFor();
 mode='list';await page.locator('#match-history-retry').click();await page.getByRole('button',{name:/Смотреть:/}).waitFor();
 await page.screenshot({path:`profile-evidence/profile-list-${viewport.width}.png`});
 await page.getByRole('button',{name:/Смотреть:/}).click();await page.locator('#match-history-board').waitFor({state:'visible'});
 await page.locator('#mh-next').click();assert.match(await page.locator('#match-history-ply').textContent(),/1 из 2/);
 await page.locator('#match-history-back').click();await page.getByRole('button',{name:/Смотреть:/}).waitFor();
 assert.equal(await page.locator('#match-history-title').textContent(),'Профиль');
 await page.locator('#match-history-back').click();await page.locator('#match-history').waitFor({state:'hidden'});
 for(let i=0;i<3;i++){await entry.click();await page.getByRole('button',{name:/Смотреть:/}).waitFor();await page.keyboard.press('Escape');await page.locator('#match-history').waitFor({state:'hidden'});}
 // One fetch per opening (empty, loading, error, three repeats) plus one explicit retry.
 assert.equal(requests,7);assert.deepEqual(errors,[]);
 results.push({viewport,requests,errors,checks:['entry','empty','loading','error/retry','rules/Escape/focus','replay/next/back','repeat open','menu focus'],api:'controlled fixtures; not live DB'});
 await context.close();
 }
 fs.writeFileSync('profile-evidence/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
