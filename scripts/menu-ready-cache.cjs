// Real HTTP-cache check: a local allowlist proxy, no Playwright HTTP routes (they disable cache).
const http=require('node:http');
const fs=require('node:fs/promises');
const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const target=process.argv[2]||'candidate';
const origin=target==='baseline'?'http://127.0.0.1:4187':'http://127.0.0.1:4186';
const out=`evidence/menu-ready/cache-${target}.json`;
(async()=>{
 const proxy=http.createServer((req,res)=>{
  let url;try{url=new URL(req.url)}catch{res.writeHead(400).end();return;}
  if(url.origin!==origin){res.writeHead(403).end();return;}
  const upstream=http.request(url,{method:req.method,headers:req.headers},response=>{
   const headers={...response.headers};
   // Reproducible warm-cache policy for hashed production assets; HTML still revalidates.
   if(url.pathname.startsWith('/assets/'))headers['cache-control']='public, max-age=600';
   res.writeHead(response.statusCode,headers);response.pipe(res);
  });
  upstream.on('error',()=>res.writeHead(502).end());req.pipe(upstream);
 });
 proxy.on('connect',(req,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
 proxy.on('upgrade',(req,socket)=>socket.destroy());
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox'],proxy:{server:`http://127.0.0.1:${proxy.address().port}`,bypass:'<-loopback>'}});
 const results=[];
 try{
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.addInitScript(()=>{
   window.timeline={};
   const frame=()=>{
    const b=document.getElementById('opening-play'),g=document.querySelector('.siege-gate'),r=document.getElementById('opening');
    if(b&&g&&r&&!r.hidden){
     if(getComputedStyle(b).visibility==='visible'&&window.timeline.cta===undefined)window.timeline.cta=performance.now();
     if(getComputedStyle(b).visibility==='visible'&&g.classList.contains('is-decoded')&&getComputedStyle(g).opacity==='1'&&getComputedStyle(document.getElementById('opening-title')).opacity==='1'&&window.timeline.whole===undefined)window.timeline.whole=performance.now();
    }if(performance.now()<15000)requestAnimationFrame(frame);
   };requestAnimationFrame(frame);
  });
  const page=await context.newPage();
  for(const cache of ['cold','warm']){
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.timeline.whole!==undefined);
   await page.locator('#opening-play').click();
   await page.waitForFunction(()=>window.__damkaPerf?.marks['first-move-allowed']!==undefined,{},{timeout:20000});
   const data=await page.evaluate(()=>({timeline:window.timeline,perf:window.__damkaPerf,assets:performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/')).map(e=>({name:e.name,bytes:e.transferSize,body:e.decodedBodySize}))}));
   const gate=data.assets.find(e=>/\/gate-.*\.webp/.test(e.name));
   if(cache==='warm')assert.equal(gate.bytes,0,'gate must really come from HTTP cache');
   results.push({viewport,cache,...data});
   console.log(JSON.stringify({target,viewport,cache,timeline:data.timeline,marks:data.perf.marks,gate}));
  }
  await context.close();
 }
 await fs.writeFile(out,JSON.stringify(results,null,2));
 }finally{await browser.close();proxy.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
