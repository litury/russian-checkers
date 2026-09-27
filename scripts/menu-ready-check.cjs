// Sequential local-only browser author checks. Shared Playwright, disposable contexts.
const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const path=require('node:path');
const out=process.argv[2]||'evidence/menu-ready/check';
const target=process.argv[3]||'candidate';
const origin=target==='baseline'?'http://127.0.0.1:4187':'http://127.0.0.1:4186';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});
 const results=[];
 try {
 for(const size of ['mobile','desktop']) {
 const viewport=size==='mobile'?{width:390,height:844}:{width:1440,height:900};
 const context=await browser.newContext({viewport,reducedMotion:'reduce'});
 let variant='normal';
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin)return route.abort();
  if(variant==='slow')await new Promise(r=>setTimeout(r,200));
  if(/\/gate-[^/]+\.webp/.test(url.pathname)) {
   if(variant==='gate-error')return route.abort();
   if(variant==='late')await new Promise(r=>setTimeout(r,4000));
   if(variant==='delay')await new Promise(r=>setTimeout(r,1200));
  }
  if(variant==='piece-error'&&/white-55-.*\.webp/.test(url.pathname))return route.abort();
  if(variant==='engine-error'&&/\/main-[^/]+\.js/.test(url.pathname))return route.abort();
  if(variant==='font-error'&&/\.woff2$/.test(url.pathname))return route.abort();
  if(variant==='audio-error'&&/\.(mp3|ogg|wav)$/.test(url.pathname))return route.abort();
  return route.continue();
 });
 await context.routeWebSocket(/.*/,ws=>ws.close());
 await context.addInitScript(()=>{
  window.check={frames:[],shifts:[],clicks:[],errors:[]};
  const tick=()=>{
   const root=document.getElementById('opening'),cta=document.getElementById('opening-play'),gate=document.querySelector('.siege-gate'),title=document.getElementById('opening-title');
   if(root&&cta&&gate){
    const css=getComputedStyle(cta),g=getComputedStyle(gate),t=getComputedStyle(title);
    window.check.frames.push({at:performance.now(),state:root.dataset.menuState,cta:!root.hidden&&css.visibility==='visible',gate:!root.hidden&&g.visibility==='visible'&&g.opacity==='1'&&gate.classList.contains('is-decoded'),title:!root.hidden&&t.visibility==='visible'&&t.opacity==='1'});
   }
   if(performance.now()<20000)requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
  new PerformanceObserver(list=>window.check.shifts.push(...list.getEntries().map(e=>({at:e.startTime,value:e.value,input:e.hadRecentInput,sources:e.sources.map(s=>({node:s.node?.id||s.node?.className,old:s.previousRect.toJSON(),next:s.currentRect.toJSON()}))})))).observe({type:'layout-shift',buffered:true});
  document.addEventListener('click',e=>{if(e.target.closest('#opening-play'))window.check.clicks.push(performance.now())},true);
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 const scenarios=target==='baseline'?['cold','warm']:(size==='mobile'?['cold','warm','delay','gate-error','piece-error','font-error','audio-error','late','slow','rotate','engine-error']:['cold','warm']);
 for(const scenario of scenarios.filter(s=>!process.env.SCENARIO||s===process.env.SCENARIO)){
  variant=scenario;
  await page.setViewportSize(viewport);
  // Fresh navigations except warm. CDP overrides Playwright route's cache default;
  // actual transfer sizes below distinguish cache/validation from cold fetches.
  if(scenario!=='warm')await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:scenario!=='warm'});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  if(target!=='baseline')await page.waitForFunction(()=>document.getElementById('opening').dataset.menuState!=='loading');
  if(scenario==='rotate')await page.setViewportSize({width:844,height:390});
  if(scenario==='late'){
   await page.screenshot({path:path.join(out,size+'-late-before.png')});
   const before=await page.locator('#opening-play').boundingBox();
   await page.waitForTimeout(2500);
   assert.deepEqual(await page.locator('#opening-play').boundingBox(),before);
   assert.equal(await page.locator('#opening').getAttribute('data-menu-state'),'fallback');
   await page.screenshot({path:path.join(out,size+'-late-after.png')});
  }
  if(scenario==='engine-error') {
   await page.locator('#opening-retry').waitFor({state:'visible'});
   assert.match(await page.locator('#opening-error').textContent(),/Не удалось/);
  }else{
   await page.locator('#opening-play').click();
   // A rapid second native activation is suppressed by disabled/in-flight state.
   await page.evaluate(()=>document.getElementById('opening-play').click());
   await page.waitForFunction(()=>window.__damkaPerf?.marks['first-move-allowed']!==undefined,{},{timeout:25000});
   await page.locator('#opening').waitFor({state:'hidden'});
   if(size==='mobile'&&['cold','font-error','audio-error'].includes(scenario)){
    await page.mouse.click(38,439);await page.mouse.click(83,395);
    await page.waitForFunction(()=>window.__damkaPerf?.marks['first-move-played']!==undefined);
    await page.screenshot({path:path.join(out,`mobile-${scenario}-first-move.png`)});
   }
  }
  const data=await page.evaluate(()=>({check:window.check,perf:window.__damkaPerf,marks:performance.getEntriesByType('mark').filter(e=>e.name.startsWith('damka:')).map(e=>({name:e.name,at:e.startTime})),state:document.getElementById('opening').dataset.menuState,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,end:e.responseEnd,bytes:e.transferSize}))}));
  const firstCTA=data.check.frames.find(f=>f.cta),firstWhole=data.check.frames.find(f=>f.cta&&f.gate&&f.title);
  const summary={size,scenario,state:data.state,firstCTA,firstWhole,marks:data.perf?.marks,menuMarks:data.marks.filter(m=>m.name.includes('menu-')),shifts:data.check.shifts,errors:[...errors]};
  await fs.writeFile(path.join(out,`${size}-${scenario}.json`),JSON.stringify({...data,errors:[...errors]},null,2));
  console.log(JSON.stringify(summary));
  if(target!=='baseline'){
   assert.equal(data.check.frames.some(f=>f.cta&&f.state!=='fallback'&&!f.gate),false,'no isolated CTA before gate');
   if(['cold','warm','delay','slow','rotate','audio-error'].includes(scenario))assert.equal(data.state,'ready');
   if(['gate-error','piece-error','font-error','late'].includes(scenario))assert.equal(data.state,'fallback');
   assert.equal(errors.length,0,'no uncaught errors');
   assert.equal(data.check.shifts.some(s=>!s.input),false,'no unprompted layout shifts');
  }
  results.push(summary);
 }
 await context.close();
 }
 // No JavaScript still has explicit visible instructions.
 if(target!=='baseline'){
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage();await page.goto(origin);
 assert.equal(await page.locator('noscript').isVisible(),true);
 await page.screenshot({path:path.join(out,'no-js.png')});await context.close();
 }
 await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(results,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
