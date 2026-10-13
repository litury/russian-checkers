const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=document-user-activation-required']});
 try {
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:5295\//.test(r.request().url())?r.continue():r.abort());
  await context.routeWebSocket(/.*/,w=>w.close());
  const page=await context.newPage(),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('checkers.autoMove','0');
   window.trace=[];
   const bytesToUrl=new WeakMap(),bufferToUrl=new WeakMap(),fetchOriginal=window.fetch;
   const sliceOriginal=ArrayBuffer.prototype.slice;
   ArrayBuffer.prototype.slice=function(...args){const copy=sliceOriginal.apply(this,args);bytesToUrl.set(copy,bytesToUrl.get(this));return copy;};
   window.fetch=async(...args)=>{
    const response=await fetchOriginal(...args),original=response.arrayBuffer.bind(response);
    response.arrayBuffer=async()=>{const bytes=await original();bytesToUrl.set(bytes,response.url);return bytes;};
    return response;
   };
   const Base=AudioContext;
   window.AudioContext=class extends Base {
    async decodeAudioData(bytes){const buffer=await super.decodeAudioData(bytes);bufferToUrl.set(buffer,bytesToUrl.get(bytes));return buffer;}
    createBufferSource(){
     const source=super.createBufferSource(),start=source.start.bind(source);
     source.start=(...args)=>{window.trace.push({url:bufferToUrl.get(source.buffer),duration:source.buffer?.duration,t:performance.now()});return start(...args);};
     return source;
    }
   };
  });
  await page.goto('http://127.0.0.1:5295');
  await page.waitForFunction(()=>window.__checkersScene?.title);
  await page.locator('#opening-options').click();await page.waitForTimeout(1500);await page.keyboard.press('Escape');
  for(const side of ['white','black','draw']){
   await page.locator('#opening-play').click();
   await page.waitForFunction(()=>{const s=window.__checkersScene;return s?.actionsEntered&&!s.countingIn;});
   await page.waitForTimeout(500);await page.evaluate(()=>window.trace=[]);
   await page.evaluate(side=>{const s=window.__checkersScene;s.endMatch(side);s.presentResult();},side);
   await page.waitForTimeout(6500);
   const trace=await page.evaluate(()=>window.trace),text=await page.locator('body').innerText();
   results.push({side,text,trace});
   await page.screenshot({path:`artifacts/remaining-sfx/rework-result-${side}.png`});
   assert.equal(trace.length,1);
   assert(trace.every(t=>t.url),'all native buffers identified through real fetch/decode');
   assert(!trace.some(t=>/result-(ascension|disposal)/.test(t.url)));
   const expected=side==='draw'?/\/draw-result\.wav/:side==='white'?/\/elf-victory\.mp3/:/\/orc-taunt-[123]\.mp3/;
   assert(expected.test(trace[0].url),JSON.stringify(trace));
   await page.locator('.verdict-panel [data-verdict=menu]').click();await page.waitForTimeout(700);
  }
  assert.equal(errors.length,0);
  fs.writeFileSync('artifacts/remaining-sfx/rework-results-v2.json',JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors},null,2));await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
