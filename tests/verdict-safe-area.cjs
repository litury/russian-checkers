// Run with STUDIO_PLAYWRIGHT=/path/to/playwright node tests/verdict-safe-area.cjs
// Requires this worktree's Vite on VERDICT_PREVIEW (default localhost:4242).
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.VERDICT_PREVIEW || 'http://127.0.0.1:4242';
const evidence = process.env.VERDICT_EVIDENCE || '.';
const fixture = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#151918}</style><script type="module">import {createResultOverlay} from '/src/client/app/boardVerdict.ts';window.overlay=createResultOverlay({events:{once(){}}},{onPlayAgain(){},onMenu(){window.action='menu'}});window.showVerdict=outcome=>window.overlay.show({winner:outcome==='draw'?'draw':outcome==='win'?'white':'black',humanSide:'white',reason:'Партия завершена',online:false});</script>`;
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});
 const results=[];
 try {
  for(const width of [390,1280]) for(const reducedMotion of ['no-preference','reduce']) {
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion});
   await context.route('**/*',r=>r.request().url().startsWith(origin+'/') ? r.continue() : r.abort());
   // Serve the fixture through Vite, rather than synthetic navigation interception.
   await context.addInitScript(() => { window.__verdictRegression = true; });
   await context.routeWebSocket('**/*', ws=>ws.close());
   const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
   fs.writeFileSync(require('node:path').join(__dirname,'verdict-fixture.html'),fixture);
   await page.goto(origin+'/tests/verdict-fixture.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.showVerdict);
   for(const outcome of ['win','loss','draw']) {
    await page.evaluate(o=>{window.overlay.hide();window.showVerdict(o)},outcome);
    await page.waitForTimeout(350);
    for(const state of ['expanded','collapsed']) {
     if(state==='collapsed')await page.locator('[data-verdict="board"]').click();
     const geometry=await page.evaluate(()=>[...document.querySelectorAll('.board-verdict button')].filter(b=>b.getBoundingClientRect().height).map(b=>{
      const rect=b.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(b);const text=range.getBoundingClientRect();
      return {label:b.textContent,width:rect.width,height:rect.height,x:rect.x,right:rect.right,leftInset:text.left-rect.left,rightInset:rect.right-text.right,overflow:b.scrollWidth>b.clientWidth};
     }));
     for(const b of geometry){assert(b.height>=44,b.label+' target');assert(b.x>=0&&b.right<=width,b.label+' viewport overflow');assert(!b.overflow,b.label+' text overflow');assert(b.leftInset>=23&&b.rightInset>=23,b.label+' decorative safe-area');}
     await page.screenshot({path:`${evidence}/safe-${width}-${reducedMotion}-${outcome}-${state}.png`});
     results.push({width,reducedMotion,outcome,state,geometry});
    }
    await page.locator('[data-verdict="open"]').click();await page.keyboard.press('Tab');
    assert(await page.locator('[data-verdict="again"]').evaluate(b=>b===document.activeElement),'keyboard focus');
    await page.locator('.verdict-panel [data-verdict="menu"]').click();assert.equal(await page.evaluate(()=>window.action),'menu');
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  fs.writeFileSync(`${evidence}/safe-area-results.json`,JSON.stringify(results,null,2));console.log(`PASS ${results.length} real-browser geometry cases; keyboard/reopen/menu; no JS errors`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
