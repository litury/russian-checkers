const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const out='artifacts/play-menu'; fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const results=[];
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  const context=await browser.newContext({viewport,recordVideo:{dir:out,size:viewport}});
  await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:(5198|8798)\//.test(r.request().url())?r.continue():r.abort());
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5198/');
  await page.locator('#opening-play').waitFor({state:'visible'});
  await page.waitForFunction(()=>window.checkersStartup.engineLoaded);
  await page.screenshot({path:`${out}/${viewport.width}-main.png`});
  await page.locator('#opening-play').click();
  await page.screenshot({path:`${out}/${viewport.width}-modes.png`});
  const text=await page.locator('#opening .opening-actions').innerText();
  const boxes=await page.locator('#opening-online').boundingBox();
  await page.locator('#opening-options').click();
  const back=await page.locator('#opening-play').innerText();
  await page.screenshot({path:`${out}/${viewport.width}-back.png`});
  results.push({viewport,text,boxes,back,errors});
  const video=page.video();await context.close();await video.saveAs(`${out}/${viewport.width}-navigation.webm`);
 }
 await browser.close(); fs.writeFileSync(`${out}/preview.json`,JSON.stringify(results,null,2)); console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1});
