const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=document-user-activation-required']});
 const results=[];
 for(const reducedMotion of ['no-preference','reduce']){
  const context=await browser.newContext({viewport:{width:1365,height:900},reducedMotion});
  await context.route('**/*',route=>/^http:\/\/127\.0\.0\.1:5293\//.test(route.request().url())?route.continue():route.abort());
  await context.routeWebSocket(/.*/,ws=>ws.close());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.audioEvidence=[];const C=window.AudioContext;
   window.AudioContext=class extends C{
    async decodeAudioData(bytes){const b=await super.decodeAudioData(bytes);window.audioEvidence.push({kind:'decode',duration:b.duration,at:performance.now()});return b;}
    createBufferSource(){const s=super.createBufferSource();const start=s.start.bind(s),stop=s.stop.bind(s);s.start=(...args)=>{window.audioEvidence.push({kind:'start',duration:s.buffer?.duration,loop:s.loop,at:performance.now()});return start(...args);};s.stop=(...args)=>{window.audioEvidence.push({kind:'stop',duration:s.buffer?.duration,at:performance.now()});return stop(...args);};return s;}
   };
  });
  await page.goto('http://127.0.0.1:5293');await page.waitForTimeout(3500);
  console.log('buttons',await page.locator('button').allTextContents());
  await page.locator('#opening-options').click();await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  await page.locator('#opening-play').click();
  await page.waitForTimeout(4000);await page.screenshot({path:'artifacts/remaining-sfx/start-debug.png'});
  console.log('start state',await page.locator('body').innerText());
  await page.waitForTimeout(700);
  await page.mouse.click(569,639);await page.waitForTimeout(120);
  await page.mouse.click(645,563);await page.waitForTimeout(2500);
  if(await page.getByRole('button',{name:'Отменить',exact:true}).isVisible()){
   await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.waitForTimeout(1000);
   await page.getByRole('button',{name:'Сдаться',exact:true}).first().click();await page.waitForTimeout(500);
  }
  await page.screenshot({path:`artifacts/remaining-sfx/browser-${reducedMotion}.png`});
  results.push({reducedMotion,errors,audio:await page.evaluate(()=>window.audioEvidence),text:(await page.locator('body').innerText()).slice(-2500)});
  await context.close();
 }
 await browser.close();fs.writeFileSync('artifacts/remaining-sfx/browser-timeline.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
