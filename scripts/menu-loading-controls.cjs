const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
 const out = 'evidence/menu-loading-controls';
 await fs.mkdir(out, {recursive:true});
 const browser = await chromium.launch({headless:true, executablePath:'/usr/local/bin/google-chrome', args:['--no-sandbox']});
 const results = [];
 try {
  for (const terminal of ['ready', 'fallback']) for (const child of ['help', 'settings']) {
   const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'});
   let release;
   const gate = new Promise(resolve => { release = resolve; });
   await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4186') return route.abort();
    if (/\/gate-[^/]+\.webp/.test(url.pathname)) await gate;
    return route.continue();
   });
   await context.routeWebSocket(/.*/, socket => socket.close());
   const page = await context.newPage();
   const errors = [];
   page.on('pageerror', e => errors.push(e.message));
   await page.goto('http://127.0.0.1:4186', {waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#opening').getAttribute('data-menu-state'), 'loading');
   assert.equal(await page.locator('#opening-play').isVisible(), false);
   assert.equal(await page.locator('#opening-online').isVisible(), false);
   assert.equal(await page.locator('.gate-piece-slot').first().isVisible(), false);
   await page.screenshot({path:`${out}/${terminal}-${child}-loading.png`});
   if (child === 'help') {
    await page.locator('#opening-options').click();
    await page.locator('#opening-help').click();
   } else {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'opening-options');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'opening-settings');
    await page.keyboard.press('Enter');
   }
   assert.equal(await page.locator('#opening').getAttribute('data-menu-state'), 'loading');
   const dialog = page.locator(`#opening-${child}-dialog`);
   assert.equal(await dialog.evaluate(el => el.open), true);
   if (terminal === 'ready') release();
   await page.waitForFunction(state => document.querySelector('#opening').dataset.menuState === state, terminal);
   assert.equal(await dialog.evaluate(el => el.open), true);
   assert.equal(await dialog.isVisible(), true);
   await page.screenshot({path:`${out}/${terminal}-${child}-dialog.png`});
   await page.keyboard.press('Escape');
   await page.waitForFunction(() => document.querySelector('#opening-options-dialog').open);
   assert.equal(await page.evaluate(() => document.activeElement.id), `opening-${child}`);
   await page.keyboard.press('Escape');
   await page.waitForFunction(() => document.activeElement.id === 'opening-options');
   release();
   assert.deepEqual(errors, []);
   results.push({terminal,child,input:child === 'help' ? 'pointer' : 'keyboard',dialogSurvivesSettle:true,focusRestored:true,errors});
   await context.close();
  }
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
