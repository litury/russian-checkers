const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox']});
 const results=[];
 try {
  for(const kind of ['visibility','page','mixed']) {
   const context=await browser.newContext({viewport:{width:390,height:844}});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5193');
   await page.waitForFunction(()=>/Онлайн: \d/.test(document.querySelector('#opening-menu-online-count')?.textContent));
   const before=(await (await page.request.get('http://127.0.0.1:8793/stats/presence')).json()).live;
   let release,hit;const held=new Promise(resolve=>hit=resolve);let ons=0;
   await page.route('**/stats/presence',async route=>{
    if(route.request().method()==='POST') {
     const {on}=JSON.parse(route.request().postData());
     if(on===false) await new Promise(resolve=>{release=resolve;hit();});
     else ons++;
    }
    await route.continue();
   });
   await page.evaluate(kind=>{
    if(kind!=='page'){Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));}
    if(kind==='page')window.dispatchEvent(new Event('pagehide'));
   },kind);
   await Promise.race([held,new Promise((_,reject)=>setTimeout(()=>reject(Error('leave missing')),5000))]);
   await page.evaluate(kind=>{
    Object.defineProperty(document,'hidden',{value:false,configurable:true});
    if(kind!=='page')document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
   },kind);
   await page.waitForTimeout(600);
   assert.equal(ons,0,'return must wait for the held leave, not overtake it');
   release();
   await page.waitForResponse(r=>r.url().endsWith('/stats/presence')&&r.request().method()==='POST'&&JSON.parse(r.request().postData()).on===true);
   const api=await (await page.request.get('http://127.0.0.1:8793/stats/presence')).json();
   assert.equal(api.live,before);assert.equal(ons,1);assert.deepEqual(errors,[]);
   results.push({kind,before,live:api.live,returnBeats:ons,errors});
   await page.unroute('**/stats/presence');
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
   await page.waitForTimeout(200);await context.close();
  }
 } finally {await browser.close();}
 fs.writeFileSync('artifacts/online-runtime/presence-order.json',JSON.stringify(results,null,2));console.log(results);
})().catch(e=>{console.error(e);process.exitCode=1});
