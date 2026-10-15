const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const port = process.env.PROFILE_TEST_PORT || '5211';
 const browser = await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 fs.mkdirSync('profile-evidence',{recursive:true});
 const results = [];
 try {
 for (const viewport of [{width:390,height:844},{width:1365,height:900}]) {
  const context = await browser.newContext({viewport,reducedMotion:'reduce'});
  let mode = 'list', statsMode = 'ok', binding = 'dev', historyRequests = 0, starts = 0, confirms = 0, statsRequests = 0;
  await context.route('**/*', async route => {
   const u = new URL(route.request().url());
   if (!['localhost','127.0.0.1'].includes(u.hostname)) return route.abort();
   if (u.pathname === '/players/guest') return route.fulfill({json:{id:'fixture-player',token:'fixture-token'}});
   if (u.pathname.endsWith('/stats')) {
    statsRequests++;
    if (statsMode === 'loading') await new Promise(r=>setTimeout(r,400));
    return statsMode === 'error' ? route.fulfill({status:503,json:{}}) : route.fulfill({json:{games:12,white_wins:4,black_wins:3}});
   }
   if (u.pathname === '/auth/email/start' || u.pathname === '/auth/email/confirm') {
    const confirm = u.pathname.endsWith('confirm');
    if(confirm) confirms++; else starts++;
    assert.equal(route.request().headers().authorization,'Bearer fixture-token');
    assert.equal(route.request().postDataJSON().email,'fixture@example.test');
    if (binding === 'loading') await new Promise(r=>setTimeout(r,400));
    if (binding === 'network') return route.abort();
    const errors = {conflict:'link_conflict',invalid:'bad_code',rate:'rate'};
    return errors[binding] ? route.fulfill({status:400,json:{error:errors[binding]}}) : route.fulfill({json:{ok:true,dev:!confirm}});
   }
   if (u.pathname === '/matches') {
    historyRequests++;
    if(mode==='loading') await new Promise(r=>setTimeout(r,400));
    return mode==='error' ? route.fulfill({status:503,json:{}}) : route.fulfill({json:{matches:mode==='empty'?[]:[{id:'fixture-match',mode:'bot',winner:'white',startedAt:'2026-10-01T12:00:00Z',color:'white',plies:2}]}});
   }
   if (u.pathname === '/matches/fixture-match') return route.fulfill({json:{id:'fixture-match',mode:'bot',winner:'white',startedAt:'2026-10-01T12:00:00Z',color:'white',plies:2,pliesList:[{side:'white',from:'a3',path:['b4']},{side:'black',from:'b6',path:['a5']}]}});
   if (u.port !== port) return route.fulfill({json:{live:1,white:0,black:0,games:0}});
   return route.continue();
  });
  await context.routeWebSocket('**/*',ws=>ws.close());
  const page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(()=>document.querySelector('#match-history')?.dataset.bound==='true');
  const back=page.locator('#match-history-back'), entry=page.locator('#opening-history');
  const expectText = async (id,text)=>{await page.waitForFunction(({id,text})=>document.getElementById(id).textContent.includes(text),{id,text});};
  const root = async ()=>{await entry.click();await expectText('profile-stats','Партий: 12');};
  const goRoot = async ()=>{await back.click();await page.locator('#match-history-profile').waitFor({state:'visible'});};
  await root();
  assert.equal(historyRequests,0);
  assert.equal(await page.locator('#profile-email').isVisible(),false);
  await page.screenshot({path:`profile-evidence/overview-${viewport.width}.png`});
  await page.locator('#profile-rules').click();await page.locator('#opening-help-dialog').waitFor({state:'visible'});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'profile-rules');
  await page.locator('#profile-rules').click();await page.getByRole('button',{name:'Понятно',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'profile-rules');
  await page.locator('#profile-account').click();
  await expectText('profile-account-status','неизвестен');
  await page.locator('#profile-email').fill('fixture@example.test');
  const send=page.locator('#profile-email-form button'), confirm=page.locator('#profile-code-form button');
  binding='loading';await send.click();await expectText('profile-account-status','Загрузка');assert(await send.isDisabled());
  await expectText('profile-account-status','логе сервера');assert.equal(starts,1);
  await page.locator('#profile-email-code').fill('123456');
  for(const [state,text] of [['invalid','не подошёл'],['conflict','другого игрока'],['rate','много запросов'],['network','Нет соединения'],['ok','Почта привязана']]) {
   binding=state;await confirm.click();await expectText('profile-account-status',text);
  }
  assert.equal(confirms,5);
  await page.screenshot({path:`profile-evidence/account-${viewport.width}.png`});
  await confirm.focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'match-history-back');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BUTTON');
  await goRoot();assert.equal(await page.evaluate(()=>document.activeElement.id),'profile-account');
  await page.goForward();await page.locator('#profile-account-pane').waitFor({state:'visible'});
  assert.equal(await page.locator('#match-history-title').textContent(),'Аккаунт');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'match-history-title');
  assert.equal(await page.evaluate(()=>history.state.pane),'account');
  await goRoot();
  await page.locator('#profile-history').click();await page.getByRole('button',{name:/Смотреть:/}).click();
  await page.locator('#match-history-board').waitFor({state:'visible'});
  await page.locator('#mh-next').click();await expectText('match-history-ply','1 из 2');
  await back.click();await page.getByRole('button',{name:/Смотреть:/}).waitFor();
  assert.equal(await page.locator('#match-history-title').textContent(),'История партий');
  assert.match(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),/Смотреть:/);
  await goRoot();assert.equal(await page.evaluate(()=>document.activeElement.id),'profile-history');
  for(const state of ['empty','loading','error']) {
   mode=state;await page.locator('#profile-history').click();
   if(state==='loading') await expectText('match-history-state-title','Загрузка');
   if(state==='error'){await expectText('match-history-state-title','Не удалось'); mode='list';await page.locator('#match-history-retry').click();await page.getByRole('button',{name:/Смотреть:/}).waitFor();}
   else if(state==='empty') await expectText('match-history-state-title','Пока нет');
   else await page.getByRole('button',{name:/Смотреть:/}).waitFor();
   await goRoot();
  }
  await back.click();await page.locator('#match-history').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'opening-history');
  statsMode='error';await entry.click();await expectText('profile-stats','недоступна');
  statsMode='loading';await page.locator('#profile-stats-retry').click();await expectText('profile-stats','Загрузка');await expectText('profile-stats','Партий: 12');
  await page.keyboard.press('Escape');await page.locator('#match-history').waitFor({state:'hidden'});
  statsMode='ok';
  for(let i=0;i<3;i++){await root();await back.click();await page.locator('#match-history').waitFor({state:'hidden'});}
  await page.locator('#opening-options').click();
  assert.equal(await page.locator('#opening-settings-dialog input[type=email]').count(),0);
  await page.locator('#settings-auto').uncheck();await page.keyboard.press('Escape');
  await page.locator('#opening-options').click();assert.equal(await page.locator('#settings-auto').isChecked(),false);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'opening-options');
  assert.equal(await page.evaluate(()=>localStorage.getItem('checkers.autoMove')),'0');
  const duplicates=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);});
  assert.deepEqual(duplicates,[]);assert.deepEqual(errors,[]);
  assert.equal(historyRequests,5);assert.equal(statsRequests,6);
  results.push({viewport,historyRequests,statsRequests,starts,confirms,errors,duplicates,api:'controlled fixtures; no real emails or backend writes'});
  await context.close();
 }
 fs.writeFileSync('profile-evidence/structure-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
