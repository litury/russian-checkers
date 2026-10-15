const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const port = Number(process.env.OPTIONS_TEST_PORT || 5194);
assert(Number.isInteger(port) && port > 0 && port < 65536);
const origin = `http://127.0.0.1:${port}`;
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:'/usr/local/bin/google-chrome', args:['--no-sandbox']});
 const report = {checks:[], errors:[]};
 try {
  for (const [name,width,height,motion] of [['phone',390,844,'no-preference'],['desktop',1440,1000,'reduce']]) {
   const context = await browser.newContext({viewport:{width,height},reducedMotion:motion});
   await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
   await context.routeWebSocket('**/*', ws => ws.close());
   const page = await context.newPage();
   page.on('pageerror', error => report.errors.push(error.message));
   await page.goto(origin);
   await page.locator('#opening-options').click();
   assert.equal(await page.locator('dialog[open]').getAttribute('id'),'opening-settings-dialog');
   assert.equal(await page.locator('#opening-options-dialog,#opening-sound').count(),0);
   const box = await page.locator('#settings-close').boundingBox();
   assert(box.width>=44 && box.height>=44);
   await page.locator('#settings-music').focus(); await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-close');
   assert.equal(await page.locator('#settings-close').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
   await page.screenshot({path:`artifacts/options-after-${name}.png`});
   await page.locator('#settings-music').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
   await page.locator('#settings-effects').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
   await page.locator('#settings-muted').check();
   await page.locator('#settings-vibration').check();
   await page.locator('#settings-auto').uncheck();
   for (const skill of ['easy','normal','hard']) await page.locator('#settings-bot-'+skill).check();
   const state = await page.evaluate(()=>window.checkersSettings.get());
   assert.equal(state.music,.05); assert.equal(state.effects,.1); assert.equal(state.muted,true); assert.equal(state.autoMove,false); assert.equal(state.botSkill,'hard');
   const storage = await page.evaluate(()=>({...localStorage}));
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('dialog[open]').count(),0);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'opening-options');
   await page.reload();
   await page.locator('#opening-options').click();
   assert.deepEqual(await page.evaluate(()=>window.checkersSettings.get()),state);
   await page.waitForFunction(()=>document.getElementById('settings-vibration').checked);
   assert.deepEqual(await page.evaluate(()=>({...localStorage})),storage);
   await page.locator('#settings-muted').uncheck();
   assert.equal(await page.evaluate(()=>window.checkersSettings.get().muted),false);
   for (let i=0;i<3;i++) {
    await page.locator('#settings-close').scrollIntoViewIfNeeded();
    await page.locator('#settings-close').click();
    assert.equal(await page.locator('dialog[open]').count(),0);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'opening-options');
    await page.locator('#opening-options').click();
   }
   await page.locator('#settings-close').scrollIntoViewIfNeeded();
   await page.mouse.click(2,2);
   assert.equal(await page.locator('dialog[open]').count(),1);
   assert.equal(await page.locator('#opening-settings-dialog input[type=email]').count(),0);
   await page.locator('#settings-bot-hard').focus(); await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-close');
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-bot-hard');
   await page.keyboard.press('Escape');
   report.checks.push({name,motion,closeBox:box,state,persistence:true,focus:true,trap:true,outsideTapIgnored:true,repeatedOpen:true});
   await context.close();
  }
  assert.deepEqual(report.errors,[]);
 } finally {
  fs.writeFileSync('artifacts/options-browser-report.json',JSON.stringify(report,null,2));
  await browser.close();
 }
 console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
