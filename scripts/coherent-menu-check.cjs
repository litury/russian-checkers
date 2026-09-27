// Author check: isolated headless Chrome, sequential contexts, real HTTP cache.
// No external HTTP/WS, no personal profile, no synthetic responses for game assets.
const http = require('node:http');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const {chromium} = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const origin = process.env.ORIGIN || 'http://127.0.0.1:4262';
const out = process.env.OUT || 'evidence/coherent-menu';
const record = process.env.CAPTURE === '1'; // filmstrip has overhead: time separately
(async () => {
 await fs.mkdir(out, {recursive:true});
 let scenario = '', releaseEngine;
 const proxy = http.createServer(async (req,res) => {
  let url; try {url = new URL(req.url);} catch {res.writeHead(400).end(); return;}
  if (url.origin !== origin) {res.writeHead(403).end(); return;}
  if (scenario === 'queued' && /\/main-.*\.js$/.test(url.pathname)) await new Promise(resolve => {releaseEngine = resolve;});
  const upstream = http.request(url, {method:req.method,headers:req.headers}, response => {
   const headers = {...response.headers};
   if(url.pathname.startsWith('/assets/')) headers['cache-control'] = 'public, max-age=600';
   res.writeHead(response.statusCode,headers); response.pipe(res);
  });
  upstream.on('error', () => res.writeHead(502).end()); req.pipe(upstream);
 });
 proxy.on('connect', (req,socket) => socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
 proxy.on('upgrade', (req,socket) => socket.destroy());
 await new Promise(resolve => proxy.listen(0,'127.0.0.1',resolve));
 const browser = await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox'],proxy:{server:`http://127.0.0.1:${proxy.address().port}`,bypass:'<-loopback>'}});
 const results=[];
 try {
  for (const width of [390,1440]) {
   const viewport={width,height:width===390?844:900};
   const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
   await context.addInitScript(() => {
    window.probe={frames:[],clicks:[],shifts:[]};
    const frame=() => {
     const root=document.getElementById('opening'), play=document.getElementById('opening-play');
     if(root&&play&&!root.hidden) {
      const visible=el=>!!el&&getComputedStyle(el).visibility==='visible'&&getComputedStyle(el).opacity==='1';
      const gate=document.querySelector('.siege-gate');
      const critical=[...root.querySelectorAll('.gate-piece,.siege-cartouche')];
      const buttons=['opening-play','opening-online','opening-history','opening-options'].map(id=>document.getElementById(id));
      window.probe.frames.push({at:performance.now(),state:root.dataset.menuState,anyControl:buttons.some(visible),cta:visible(play),whole:buttons.every(visible)&&visible(gate)&&gate.classList.contains('is-decoded')&&visible(document.getElementById('opening-title'))&&critical.every(img=>img.naturalWidth>0&&img.classList.contains('is-decoded')),enabled:!play.disabled,busy:play.getAttribute('aria-busy')});
     }
     if(performance.now()<12000)requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
    new PerformanceObserver(list=>window.probe.shifts.push(...list.getEntries().filter(e=>!e.hadRecentInput).map(e=>({at:e.startTime,value:e.value,sources:e.sources.map(s=>({node:s.node?.id||s.node?.className,old:s.previousRect.toJSON(),next:s.currentRect.toJSON()}))})))).observe({type:'layout-shift',buffered:true});
    document.addEventListener('click',e=>{
     if(!e.target.closest('#opening-play'))return;
     const start=performance.now();
     window.probe.clicks.push({at:e.timeStamp,handledAt:performance.now(),dispatchAt:start,trusted:e.isTrusted,pending:window.checkersStartup.pendingPlay,committed:window.checkersStartup.playCommitted,engine:window.checkersStartup.engineLoaded});
    }); // bubble phase: target's shipping onclick has already accepted the tap
   });
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const cdp=await context.newCDPSession(page);
   await cdp.send('Network.enable');
   for (scenario of ['cold','warm','queued']) {
    const name=`${width}-${scenario}`;
    if(scenario!=='warm')await cdp.send('Network.clearBrowserCache');
    const captures=[],writes=[];
    const capture=event=>{
     if(captures.length<35) {
      const file=`${name}-frame-${String(captures.length).padStart(2,'0')}.jpg`;
      captures.push({file,timestamp:event.metadata.timestamp});
      writes.push(fs.writeFile(`${out}/${file}`,Buffer.from(event.data,'base64')));
     }
     void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId});
    };
    if(record) {
     cdp.on('Page.screencastFrame',capture);
     await cdp.send('Page.startScreencast',{format:'jpeg',quality:70,maxWidth:width,maxHeight:viewport.height,everyNthFrame:1});
    }
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.probe.frames.some(f=>f.whole&&f.enabled));
    if(record) {
     const screenshot=await cdp.send('Page.captureScreenshot',{format:'png'});
     await fs.writeFile(`${out}/${name}-menu.png`,Buffer.from(screenshot.data,'base64'));
    }
    const before=await page.locator('#opening-play').boundingBox();
    await page.touchscreen.tap(before.x+before.width/2,before.y+before.height/2);
    if(scenario==='queued') {
     assert.equal(await page.evaluate(()=>window.checkersStartup.pendingPlay),true);
     assert.equal(await page.evaluate(()=>window.checkersStartup.engineLoaded),false);
     await page.evaluate(()=>document.getElementById('opening-play').click());
     assert.equal(await page.evaluate(()=>window.probe.clicks.length),1,'second native click suppressed');
     assert.equal(typeof releaseEngine,'function');
     releaseEngine();
    }
    await page.waitForFunction(()=>window.__damkaPerf?.marks['first-move-allowed']!==undefined,null,{timeout:25000});
    await page.locator('#opening').waitFor({state:'hidden'});
    if(record) {await cdp.send('Page.stopScreencast');cdp.off('Page.screencastFrame',capture);await Promise.all(writes);}
    const data=await page.evaluate(()=>({probe:window.probe,perf:window.__damkaPerf,marks:performance.getEntriesByType('mark').filter(e=>e.name.startsWith('damka:')).map(e=>({name:e.name,at:e.startTime})),resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/')).map(e=>({name:e.name,bytes:e.transferSize,body:e.decodedBodySize}))}));
    const first=data.probe.frames.find(f=>f.whole), armed=data.probe.frames.find(f=>f.whole&&f.enabled),click=data.probe.clicks[0];
    const gate=data.resources.find(e=>/\/gate-.*\.webp$/.test(e.name));
    await fs.writeFile(`${out}/${name}-raw.json`,JSON.stringify({errors,...data},null,2));
    assert.ok(first&&armed&&click);
    assert.equal(data.probe.frames.some(f=>f.anyControl&&!f.whole),false,'all controls reveal together with the complete menu');
    assert.equal(data.probe.clicks.length,1);
    assert.equal(click.trusted,true);
    assert.equal(data.probe.shifts.length,0);
    assert.deepEqual(errors,[]);
    if(scenario==='warm')assert.equal(gate.bytes,0,'real warm HTTP cache');
    const metrics={firstWhole:first.at,canAcceptAfter:armed.at-first.at,tapAcceptedAfter:click.handledAt-first.at,inputHandling:click.handledAt-click.at,queued:click.pending,engineAtTap:click.engine};
    if(process.env.BUDGET) {
     const budgets=JSON.parse(await fs.readFile(process.env.BUDGET,'utf8'));
     for(const key of ['canAcceptAfter','tapAcceptedAfter','inputHandling'])assert.ok(metrics[key]<=budgets[key],`${key}: ${metrics[key]} > measured budget ${budgets[key]}`);
    }
    await fs.writeFile(`${out}/${name}.json`,JSON.stringify({viewport,scenario,metrics,before,captures,errors,...data},null,2));
    results.push({viewport,scenario,record,metrics,gate,frames:captures.length});console.log(JSON.stringify(results.at(-1)));
   }
   await context.close();
  }
  await fs.writeFile(`${out}/summary.json`,JSON.stringify(results,null,2));
 } finally {releaseEngine?.();await browser.close();proxy.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
