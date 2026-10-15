const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const results=[];fs.mkdirSync('artifacts/board-controls-responsive',{recursive:true});
 try {
  for (const outcome of ['loss','win','draw']) for (const viewport of [{width:390,height:667},{width:844,height:390},{width:390,height:844},{width:1280,height:900}]) {
   const context=await browser.newContext({viewport,reducedMotion:outcome==='loss'?'reduce':'no-preference'});
   await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:5215\//.test(r.request().url())?r.continue():r.abort());
   await context.routeWebSocket(/.*/,w=>w.close());
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:5215/?resultReview');
   await page.locator('#opening-play').click();
   await page.waitForFunction(()=>window.__checkersScene?.phase==='human'&&window.__checkersScene?.hud.isActionsReady(),{},{timeout:60000});
   await page.evaluate(outcome=>outcome==='loss'?window.__checkersScene.resignMatch():window.dispatchEvent(new CustomEvent('result-review',{detail:outcome})),outcome);
   await page.getByRole('button',{name:'Посмотреть доску',exact:true}).click();
   async function measure(label) {
    await page.waitForTimeout(150);
    const value=await page.evaluate(()=>({layout:document.querySelector('.board-verdict').dataset.controlsLayout,scrollY,phase:window.__checkersScene.phase,buttons:[...document.querySelectorAll('.verdict-status button')].map(e=>{const r=document.createRange();r.selectNodeContents(e);const b=e.getBoundingClientRect();return {text:e.textContent,x:b.x,y:b.y,w:b.width,h:b.height,textWidth:r.getBoundingClientRect().width};})}));
    for(const b of value.buttons){assert(b.w>=44&&b.h>=44);assert(b.w-b.textWidth>=16);assert(b.y>=0&&b.y+b.h<=page.viewportSize().height);}
    results.push({outcome,viewport:page.viewportSize(),label,...value});
    await page.screenshot({path:`artifacts/board-controls-responsive/${outcome}-${viewport.width}x${viewport.height}-${label}.png`,fullPage:true});
   }
   await measure('initial');
   if(await page.locator('.board-verdict').getAttribute('data-controls-layout')==='dock') {
    assert.equal(await page.locator('#game canvas').evaluate(e=>getComputedStyle(e).touchAction),'pan-y');
    await page.mouse.move(180,250);await page.mouse.wheel(0,-200);await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>scrollY),0);
    await page.mouse.wheel(0,200);await page.waitForTimeout(150);
    assert((await page.evaluate(()=>scrollY))>0);
   }
   await page.locator('.verdict-status [data-verdict="open"]').click();
   await page.getByRole('button',{name:'Посмотреть доску',exact:true}).click();
   await measure('reopen');
   await page.setViewportSize({width:390,height:844});await measure('tall');
   await page.setViewportSize({width:844,height:390});await measure('landscape');
   await page.setViewportSize({width:390,height:667});await measure('short');
   await page.locator('.verdict-status [data-verdict="menu"]').click();
   assert(await page.locator('.board-verdict').isHidden());
   assert.equal(await page.evaluate(()=>scrollY),0);
   await context.close();
  }
 } finally {await browser.close(); fs.writeFileSync('artifacts/board-controls-responsive/measurements.json',JSON.stringify(results,null,2));}
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
