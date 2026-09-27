// Local-only, sequential diagnostics. No routing: retain the real HTTP cache policy.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const target = process.argv[2] || 'candidate';
const out = process.argv[3] || `evidence/menu-network/${target}`;
const repeats = Number(process.env.REPEATS || 3);
const origin = target === 'baseline' ? 'http://127.0.0.1:4187' : 'http://127.0.0.1:4186';
(async () => {
 await fs.mkdir(out, {recursive:true});
 const proxy = http.createServer((req,res) => {
  let url; try { url = new URL(req.url); } catch { res.writeHead(400).end(); return; }
  if (url.origin !== origin) { res.writeHead(403).end(); return; }
  const upstream = http.request(url,{method:req.method,headers:req.headers},response => {
   res.writeHead(response.statusCode,response.headers); response.pipe(res);
  });
  upstream.on('error',() => res.writeHead(502).end()); req.pipe(upstream);
 });
 proxy.on('connect',(_,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
 proxy.on('upgrade',(_,socket)=>socket.destroy());
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 const browser = await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox'],proxy:{server:`http://127.0.0.1:${proxy.address().port}`,bypass:'<-loopback>'}});
 const summaries=[];
 try {
  for (const viewport of [{width:390,height:844},{width:1440,height:900}].filter(v=>!process.env.WIDTH||v.width===Number(process.env.WIDTH))) for(let repeat=0;repeat<repeats;repeat++) {
   const context=await browser.newContext({viewport,deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block'});
   await context.addInitScript(()=>{
    window.diag={frames:[],decodes:[],longTasks:[],shifts:[],click:null};
    const original=HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode=function(){
     const start=performance.now(); const src=this.currentSrc||this.src;
     return original.call(this).then(result=>{window.diag.decodes.push({src,start,end:performance.now(),ok:true});return result;},error=>{window.diag.decodes.push({src,start,end:performance.now(),ok:false});throw error;});
    };
    new PerformanceObserver(list=>window.diag.longTasks.push(...list.getEntries().map(e=>e.toJSON()))).observe({type:'longtask',buffered:true});
    new PerformanceObserver(list=>window.diag.shifts.push(...list.getEntries().map(e=>({at:e.startTime,value:e.value,input:e.hadRecentInput})))).observe({type:'layout-shift',buffered:true});
    document.addEventListener('click',e=>{if(e.target.closest('#opening-play')&&window.diag.click===null)window.diag.click=performance.now();},true);
    const frame=()=>{
     const root=document.getElementById('opening'),cta=document.getElementById('opening-play'),gate=document.querySelector('.siege-gate'),title=document.getElementById('opening-title');
     if(root&&cta&&gate&&title&&!root.hidden){
      const visible=getComputedStyle(cta).visibility==='visible';
      const whole=visible&&gate.classList.contains('is-decoded')&&getComputedStyle(gate).opacity==='1'&&getComputedStyle(title).opacity==='1';
      window.diag.frames.push({at:performance.now(),visible,whole,state:root.dataset.menuState||null});
     }
     if(performance.now()<20000)requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
   });
   const page=await context.newPage(); const cdp=await context.newCDPSession(page);
   await cdp.send('Network.enable'); await cdp.send('Performance.enable');
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:1250000,uploadThroughput:625000,connectionType:'wifi'});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
   let requests=[],errors=[];
   const cleanURL = value => { const u=new URL(value); return /^https?:$/.test(u.protocol) ? u.origin+u.pathname : u.protocol; };
   cdp.on('Network.requestWillBeSent',e=>requests.push({id:e.requestId,url:cleanURL(e.request.url),type:e.type,at:e.timestamp,wallTime:e.wallTime,initiator:e.initiator,priority:e.request.initialPriority,redirect:e.redirectResponse?{status:e.redirectResponse.status,url:cleanURL(e.redirectResponse.url)}:null}));
   cdp.on('Network.responseReceived',e=>{const r=requests.findLast(r=>r.id===e.requestId);if(r)Object.assign(r,{responseAt:e.timestamp,status:e.response.status,mime:e.response.mimeType,headers:Object.fromEntries(Object.entries(e.response.headers).filter(([k])=>/^(cache-control|content-encoding|content-length|etag|last-modified|vary)$/i.test(k))),timing:e.response.timing??null,fromDiskCache:e.response.fromDiskCache,fromServiceWorker:e.response.fromServiceWorker,protocol:e.response.protocol});});
   cdp.on('Network.loadingFinished',e=>{const r=requests.findLast(r=>r.id===e.requestId);if(r)Object.assign(r,{end:e.timestamp,encodedDataLength:e.encodedDataLength});});
   cdp.on('Network.loadingFailed',e=>{const r=requests.findLast(r=>r.id===e.requestId);if(r)Object.assign(r,{end:e.timestamp,error:e.errorText});});
   cdp.on('Network.resourceChangedPriority',e=>{const r=requests.findLast(r=>r.id===e.requestId);if(r)(r.priorityChanges??=[]).push({at:e.timestamp,priority:e.newPriority});});
   page.on('pageerror',e=>errors.push(e.message));
   for(const cache of ['cold','warm']) {
    if(cache==='cold')await cdp.send('Network.clearBrowserCache');
    requests=[];errors=[];
    const label=`${viewport.width}-${repeat}-${cache}`;
    // Diagnostic traces/screenshots are separate from repeatable timings: both
    // impose CPU/paint overhead and screenshots used to delay the Play click.
    const trace=process.env.TRACE==='1'&&repeat===0&&cache==='cold';
    const traceEvents=[];
    if(trace){cdp.on('Tracing.dataCollected',e=>traceEvents.push(...e.value));await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing',options:'record-as-much-as-possible'});}
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.diag.frames.some(f=>f.whole||f.state==='fallback'),null,{timeout:15000});
    if(trace)await page.screenshot({path:path.join(out,`${label}-menu.png`)});
    await page.locator('#opening-play').click();
    await page.waitForFunction(()=>window.__damkaPerf?.marks['first-move-allowed']!==undefined,null,{timeout:30000});
    await page.locator('#opening').waitFor({state:'hidden'});
    // Actual a3-b4; shipping matchLayout with the visible 68px rail + 12px bottom.
    const points=viewport.width===390?[[38.5684,439.3421],[83.2632,394.6474]]:[[454.875,523.625],[530.625,447.875]];
    for(const [x,y] of points)await page.mouse.click(x,y);
    try { await page.waitForFunction(()=>window.__damkaPerf?.marks['first-move-played']!==undefined,null,{timeout:15000}); }
    catch(error){await page.screenshot({path:path.join(out,`${label}-move-failed.png`)});console.log(await page.evaluate(()=>({canvas:document.querySelector('#game canvas')?.getBoundingClientRect().toJSON(),perf:window.__damkaPerf})));throw error;}
    const data=await page.evaluate(()=>({diag:window.diag,perf:window.__damkaPerf,resources:[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].map(e=>e.toJSON()),paint:performance.getEntriesByType('paint').map(e=>e.toJSON()),marks:performance.getEntriesByType('mark').map(e=>e.toJSON()),state:document.getElementById('opening').dataset.menuState,swControlled:!!navigator.serviceWorker?.controller}));
    const metrics=await cdp.send('Performance.getMetrics');
    if(trace){const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');await done;cdp.removeAllListeners('Tracing.dataCollected');await fs.writeFile(path.join(out,`${label}-trace.json`),JSON.stringify({traceEvents}));}
    const firstWhole=data.diag.frames.find(f=>f.whole||f.state==='fallback')?.at;
    const summary={target,viewport,repeat,cache,trace,state:data.state,firstPaint:data.paint.find(e=>e.name==='first-paint')?.startTime,firstCTA:data.diag.frames.find(f=>f.visible)?.at,firstWhole,click:data.diag.click,allowed:data.perf?.marks['first-move-allowed'],played:data.perf?.marks['first-move-played'],longTasks:data.diag.longTasks.length,longTaskMs:data.diag.longTasks.reduce((s,t)=>s+t.duration,0),gate:data.resources.find(e=>/\/gate-.*\.webp/.test(e.name)),errors};
    summaries.push(summary);
    await fs.writeFile(path.join(out,`${label}.json`),JSON.stringify({summary,environment:{browser:browser.version(),node:process.version,date:new Date().toISOString(),network:{latency:40,downloadBytesPerSecond:1250000,uploadBytesPerSecond:625000},cpuRate:1,dpr:2,cachePolicy:'unchanged upstream Vite headers; cold clear; warm same context navigation',serviceWorkers:'blocked',external:'HTTP allowlist proxy; HTTPS CONNECT and WebSocket denied'},...data,requests,metrics},null,2));
    console.log(JSON.stringify({...summary,gate:summary.gate&&{start:summary.gate.startTime,end:summary.gate.responseEnd,bytes:summary.gate.transferSize,decoded:summary.gate.decodedBodySize}}));
    assert.equal(errors.length,0);
   }
   await context.close();
  }
  await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summaries,null,2));
 } finally {await browser.close();proxy.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
