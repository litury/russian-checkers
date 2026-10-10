const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {parseArgs} from 'node:util';
import {cpus,totalmem} from 'node:os';
const {values:args}=parseArgs({options:{baseline:{type:'string'},candidate:{type:'string'},output:{type:'string'},latency:{type:'string'},throughput:{type:'string'},cpu:{type:'string'},pairs:{type:'string'},scenario:{type:'string',default:'settled'},smoke:{type:'boolean',default:false},cache:{type:'string',default:'both'}}});
for(const k of ['baseline','candidate','output','latency','throughput','cpu'])if(!args[k])throw Error('Missing --'+k);
const pairs=Number(args.pairs);if(!Number.isInteger(pairs)||pairs<2||pairs>20)throw Error('--pairs must be 2..20');if(!['early','settled'].includes(args.scenario))throw Error('Invalid scenario');
const latency=Number(args.latency),throughput=Number(args.throughput),cpu=Number(args.cpu);
if(!Number.isFinite(latency)||latency<0||!Number.isFinite(throughput)||throughput<=0||!Number.isFinite(cpu)||cpu<1)throw Error('Invalid throttle');
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
async function hashes(root){const result=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile())result.push({file:p.slice(root.length+1),sha256:createHash('sha256').update(await readFile(p)).digest('hex')});}}await walk(root);return result.sort((a,b)=>a.file.localeCompare(b.file));}
import {gzipSync} from 'node:zlib';
const widths=args.smoke?[390]:[390,1280],dprs=args.smoke?[2]:[2,3],motions=args.smoke?['reduce']:['reduce','no-preference'],caches=args.cache==='both'?['cold','warm']:[args.cache];
if(!caches.every(x=>['cold','warm'].includes(x)))throw Error('Invalid cache');
const out=resolve(args.output);await mkdir(out,{recursive:true});
let variant='baseline';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{const root=resolve(args[variant]);const path=new URL(req.url,'http://localhost').pathname;const p=resolve(root,'.'+(path==='/'?'/index.html':path));if(!p.startsWith(root+'/'))throw Error('path');let b=await readFile(p);const headers={'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'public, max-age=3600'};if(/\.(html|js|css)$/.test(p)){b=gzipSync(b);headers['Content-Encoding']='gzip';}res.writeHead(200,headers);res.end(b);}catch{res.writeHead(404);res.end();}});

const results=[];let browser;
try{await readFile(resolve(out,'raw.json'));throw Error('Existing raw output: refusing a rerun');}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(resolve(out,'manifest.json'),JSON.stringify({plan:{pairs,widths,motions,cache:caches,order:'alternating AB/BA',dprs,smoke:args.smoke,observations:pairs*2*widths.length*dprs.length*motions.length*caches.length},throttling:{latency,throughput,cpu},hardware:{cpus:cpus().length,totalmem:totalmem()},args,baselineBuild:await hashes(resolve(args.baseline)),candidateBuild:await hashes(resolve(args.candidate)),instrumentSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')},null,2));
try{await new Promise(r=>server.listen(4319,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:process.env.CHROME_PATH?['--no-sandbox']:[]});
for(const cache of caches)for(const width of widths)for(const dpr of dprs)for(const motion of motions)for(let pair=0;pair<pairs;pair++)for(const v of (pair%2?['candidate','baseline']:['baseline','candidate'])){

 variant=v;const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:dpr,reducedMotion:motion});
 await context.routeWebSocket('**/*',w=>w.close());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cachedResponses=[],network=new Map();let clockOffset=0;
 const cdp=await context.newCDPSession(page);cdp.on('Network.requestWillBeSent',e=>{clockOffset=e.wallTime*1000-e.timestamp*1000;network.set(e.requestId,{url:e.request.url,method:e.request.method,start:e.timestamp*1000+clockOffset});});cdp.on('Network.loadingFinished',e=>{const r=network.get(e.requestId);if(r)Object.assign(r,{end:e.timestamp*1000+clockOffset,wireBytes:e.encodedDataLength});});cdp.on('Network.loadingFailed',e=>{const r=network.get(e.requestId);if(r)r.error=e.errorText;});cdp.on('Network.responseReceived',e=>{if(e.response.fromDiskCache||e.response.fromPrefetchCache)cachedResponses.push(e.response.url);});cdp.on('Network.requestServedFromCache',e=>cachedResponses.push(e.requestId));await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});cdp.on('Fetch.requestPaused',async e=>{await cdp.send(/^http:\/\/127\.0\.0\.1:4319\//.test(e.request.url)?'Fetch.continueRequest':'Fetch.failRequest',/^http:\/\/127\.0\.0\.1:4319\//.test(e.request.url)?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:cache==='cold'});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency,downloadThroughput:throughput,uploadThroughput:throughput});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
 if(cache==='warm'){await page.goto('http://127.0.0.1:4319/');await page.waitForFunction(()=>!document.querySelector('#opening-play').disabled);await page.locator('#opening-play').click();await page.waitForFunction(()=>performance.getEntriesByName('damka:board-first-frame').length,null,{timeout:60000});await page.waitForLoadState('networkidle');if(errors.length)throw Error('Warmup pageerror');cachedResponses.length=0;network.clear();}
 await page.addInitScript(()=>{window.__lcp=[];window.__long=[];new PerformanceObserver(l=>window.__lcp.push(...l.getEntries().map(e=>({time:e.startTime,size:e.size,url:e.url})))).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>window.__long.push(...l.getEntries().map(e=>({time:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
 await page.goto('http://127.0.0.1:4319/');await page.waitForFunction(()=>!document.querySelector('#opening-play').disabled);if(args.scenario==='settled'){await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');await page.waitForTimeout(1000);}
 await page.locator('#opening-play').click();
 try {await page.waitForFunction(()=>performance.getEntriesByName('damka:board-first-frame').length,null,{timeout:60000});} catch(e){await writeFile(resolve(out,'failure.json'),JSON.stringify({variant:v,errors,body:await page.locator('body').innerText(),marks:await page.evaluate(()=>performance.getEntriesByType('mark').map(e=>e.toJSON()))},null,2));throw e;}await page.waitForTimeout(100);
 const data=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),marks:performance.getEntriesByType('mark').map(e=>({name:e.name,time:e.startTime})),lcp:window.__lcp,longTasks:window.__long,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,start:e.startTime,end:e.responseEnd}))}));
 results.push({network:[...network.values()].map(r=>({...r,start:r.start-data.timeOrigin,end:r.end===undefined?null:r.end-data.timeOrigin})),cachedResponses,cache,width,dpr,motion,pair,variant:v,errors,...data});await writeFile(resolve(out,'raw.json'),JSON.stringify(results,null,2));
 if(pair===0)await page.screenshot({path:resolve(out,`${v}-${cache}-${width}-${dpr}-${motion}.png`)});
 console.log(v,cache,width,motion,pair,JSON.stringify(data.marks.filter(e=>/intent|first-frame|engine-ready|menu-presented/.test(e.name))),errors);
 await context.close();
}
 await writeFile(resolve(out,'browser.json'),JSON.stringify({version:browser.version()},null,2));
}finally{await browser?.close();await new Promise(r=>server.listening?server.close(r):r());}
