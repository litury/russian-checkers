// Unmodified production bundle; only the device API is replaced with a spy.
import { chromium } from '/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
 const context = await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route => /^http:\/\/127\.0\.0\.1:4231\//.test(route.request().url()) ? route.continue() : route.abort());
 await context.addInitScript(() => {
  localStorage.setItem('checkers.menuVibration','true'); localStorage.setItem('checkers.autoMove','0');
  window.hapticCalls=[];
  Object.defineProperty(navigator,'vibrate',{configurable:true,writable:true,value:pattern=>{window.hapticCalls.push(pattern);return true;}});
 });
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4231/');
 await page.click('#opening-play');
 await page.waitForFunction(()=>document.querySelector('#game canvas')?.tabIndex===0 && document.querySelector('#opening').hidden);
 await page.waitForTimeout(600);
 await page.evaluate(()=>{window.hapticCalls=[];});
 await page.locator('#game canvas').focus();
 await page.keyboard.press('Enter');
 assert.deepEqual(await page.evaluate(()=>window.hapticCalls),[10]);
 await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
 await page.waitForTimeout(300);
 assert.deepEqual(await page.evaluate(()=>window.hapticCalls),[10,15]);
 assert.deepEqual(errors,[]);
 const result={productionBundleUnmodified:true,calls:await page.evaluate(()=>window.hapticCalls),label:await page.locator('#game canvas').getAttribute('aria-label'),errors,physicalVibrationTested:false};
 await fs.writeFile('docs/haptics-evidence/production-results.json',JSON.stringify(result,null,2));
 await page.screenshot({path:'docs/haptics-evidence/production-move.png'});
 console.log(result);
}finally{await browser.close();}
