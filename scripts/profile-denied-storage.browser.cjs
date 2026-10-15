const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const port = process.env.PROFILE_TEST_PORT || '5211';
 const browser = await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results = [];
 try {
  for (const viewport of [{width:390,height:844},{width:1365,height:900}]) {
   const context = await browser.newContext({viewport,reducedMotion:'reduce'});
   await context.addInitScript(() => {
    for (const method of ['getItem','setItem']) Storage.prototype[method] = () => { throw new DOMException('Denied by test','SecurityError'); };
   });
   let guests = 0;
   const statsIds = [], bindingIds = [], errors = [];
   await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (!['localhost','127.0.0.1'].includes(u.hostname)) return route.abort();
    if (u.pathname === '/players/guest') { const id = ++guests; return route.fulfill({json:{id:`player-${id}`,token:`test-${id}`}}); }
    const match = u.pathname.match(/^\/players\/(player-\d+)\/stats$/);
    if (match) { statsIds.push(match[1]); return route.fulfill({json:{games:12,white_wins:4,black_wins:3}}); }
    if (u.pathname === '/auth/email/start') {
     bindingIds.push(route.request().headers().authorization.replace('Bearer test-', 'player-'));
     return route.fulfill({json:{ok:true,dev:true}});
    }
    if (u.port !== port) return route.fulfill({json:{live:1,white:0,black:0,games:0}});
    return route.continue();
   });
   await context.routeWebSocket('**/*', ws => ws.close());
   const page = await context.newPage();
   page.on('pageerror', e => errors.push(e.message));
   await page.goto(`http://127.0.0.1:${port}/`);
   await page.waitForFunction(() => document.querySelector('#match-history')?.dataset.bound === 'true');
   let identity;
   for (let i = 0; i < 2; i++) {
    await page.locator('#opening-history').click();
    await page.waitForFunction(() => document.querySelector('#profile-stats').textContent.includes('Партий: 12'));
    const current = (await page.locator('#profile-identity').textContent()).split(' · ')[1];
    identity ??= current;
    assert.equal(current,identity);
    assert.equal(statsIds.at(-1),identity);
    await page.locator('#profile-account').click();
    await page.locator('#profile-email').fill('fixture@example.test');
    await page.locator('#profile-email-form button').click();
    await page.waitForFunction(() => document.querySelector('#profile-account-status').textContent.includes('логе сервера'));
    assert.equal(bindingIds.at(-1),identity);
    await page.locator('#match-history-back').click();
    await page.locator('#match-history-profile').waitFor({state:'visible'});
    await page.locator('#match-history-back').click();
    await page.locator('#match-history').waitFor({state:'hidden'});
   }
   assert.equal(statsIds.length,2); assert.equal(bindingIds.length,2); assert.deepEqual(errors,[]);
   results.push({viewport,identity,statsIds,bindingIds,guests,errors});
   await context.close();
  }
  fs.mkdirSync('profile-evidence',{recursive:true});
  fs.writeFileSync('profile-evidence/denied-storage-results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
