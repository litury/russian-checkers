// Isolated local-only Chromium evidence; run sequentially against vite preview.
const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const out = process.argv[2];
const variant = process.argv[3] || 'normal';
(async () => {
 await fs.mkdir(out, {recursive:true});
 const browser = await chromium.launch({headless:true, executablePath:'/usr/local/bin/google-chrome', args:['--no-sandbox']});
 try {
 const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:process.env.MOTION || 'reduce'});
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== 'http://127.0.0.1:4186') return route.abort();
  if (/\/gate-[^/]+\.webp/.test(url.pathname)) {
   if (variant === 'error') return route.abort();
   if (variant === 'delay') await new Promise(r => setTimeout(r,1500));
   if (variant === 'late') await new Promise(r => setTimeout(r,4000));
  }
  return route.continue();
 });
 await context.routeWebSocket(/.*/, ws => ws.close());
 const page = await context.newPage();
 const cdp = await context.newCDPSession(page);
 let frameIndex = 0;
 const filmstrip = [];
 cdp.on('Page.screencastFrame', async ({data,metadata,sessionId}) => {
  const file = `frame-${String(frameIndex++).padStart(4,'0')}.jpg`;
  filmstrip.push({file,timestamp:metadata.timestamp});
  await fs.writeFile(path.join(out,file),Buffer.from(data,'base64'));
  await cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{});
 });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:390,maxHeight:844,everyNthFrame:1});
 const errors=[]; page.on('pageerror', e=> errors.push(e.message));
 await page.addInitScript(() => {
  window.probe={frames:[],decodes:[],shifts:[]};
  const decode=HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode=function(){ const start=performance.now(); return decode.call(this).then(v=>{window.probe.decodes.push({src:this.currentSrc,start,end:performance.now()});return v;}); };
  new PerformanceObserver(list=>window.probe.shifts.push(...list.getEntries().map(e=>({value:e.value,input:e.hadRecentInput})))).observe({type:'layout-shift',buffered:true});
  const frame=()=>{
   const root=document.getElementById('opening'), button=document.getElementById('opening-play'), gate=document.querySelector('.siege-gate');
   if(root&&button&&gate){const b=getComputedStyle(button),g=getComputedStyle(gate);window.probe.frames.push({at:performance.now(),state:root.dataset.menuState,cta:b.visibility==='visible'&&b.opacity!=='0'&&!root.hidden,gate:g.visibility==='visible'&&g.opacity==='1'&&gate.classList.contains('is-decoded'),hidden:root.hidden});}
   if(performance.now()<15000)requestAnimationFrame(frame);
  }; requestAnimationFrame(frame);
 });
 await page.goto('http://127.0.0.1:4186', {waitUntil:'domcontentloaded'});
 await page.screenshot({path:path.join(out,'initial.png')});
 await page.waitForTimeout(700);
 await page.screenshot({path:path.join(out,'700ms.png')});
 await page.waitForTimeout(4000);
 await page.screenshot({path:path.join(out,'menu.png')});
 await page.locator('#opening-play').click();
 await page.waitForFunction(()=>window.__damkaPerf?.marks['first-move-allowed']!==undefined,{},{timeout:20000});
 await page.screenshot({path:path.join(out,'board.png')});
 const data=await page.evaluate(()=>({probe:window.probe,marks:window.__damkaPerf,menuMarks:performance.getEntriesByType('mark').filter(e=>e.name.startsWith('damka:menu-')).map(e=>({name:e.name,at:e.startTime})),resources:performance.getEntriesByType('resource').filter(e=>/gate-|woff|index-/.test(e.name)).map(e=>({name:e.name,start:e.startTime,end:e.responseEnd,duration:e.duration})),menu:document.getElementById('opening').dataset.menuState}));
 data.errors=errors;
 await cdp.send('Page.stopScreencast');
 data.filmstrip=filmstrip;
 await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(data,null,2));
 console.log(JSON.stringify({variant,firstCTA:data.probe.frames.find(f=>f.cta),firstGate:data.probe.frames.find(f=>f.gate),marks:data.marks,errors},null,2));
 await context.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
