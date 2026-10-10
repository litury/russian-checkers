// Component regression: real Chrome, actual overlay, no synthetic DOM click.
const { chromium } = require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const origin = process.env.VERDICT_PREVIEW || 'http://127.0.0.1:5196';
  await page.route('**/*', r => r.request().url() === origin+'/regression' ? r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#777">Component regression</body>'}) : r.request().url().startsWith(origin+'/') ? r.continue() : r.abort());
  await page.goto(origin+'/regression');
  await page.evaluate(async()=>{
   await import('/src/client/fonts/fonts.css');
   const {createResultOverlay}=await import('/src/client/app/boardVerdict.ts');
   window.calls={menu:0,again:0};
   window.v=createResultOverlay({events:{once(){}}},{onMenu(){window.calls.menu++},onPlayAgain(){window.calls.again++}});
   await document.fonts.ready;
  });
  const rows=[];
  for (const motion of ['no-preference','reduce']) {
   await page.emulateMedia({reducedMotion:motion});
   for (const winner of ['white','black','draw']) for (const time of [0,50,140,280]) {
    for (const action of ['again','board','menu']) {
     await page.evaluate(({winner,time})=>{
      window.v.hide(); window.v.show({winner,humanSide:'white',reason:'Партия завершена',online:false});
      document.querySelector('.verdict-panel').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=time});
     },{winner,time});
     const info=await page.evaluate(action=>{
      const buttons=[...document.querySelectorAll('.verdict-actions button')].filter(e=>!e.hidden);
      const e=action==='board'?buttons[1]:document.querySelector(`[data-verdict="${action}"]`);
      const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      return {x,y,top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(x,y)),before:{...window.calls},animations:document.querySelector('.verdict-panel').getAnimations({subtree:true}).length};
     },action);
     assert(info.top>=0 && info.bottom<=844 && info.hit,JSON.stringify({motion,winner,time,action,info}));
     if(motion==='reduce') assert.equal(info.animations,0);
     await page.mouse.move(info.x,info.y); await page.mouse.down();
     const pressed=await page.evaluate(({x,y})=>getComputedStyle(document.elementFromPoint(x,y)).borderImageSource,{x:info.x,y:info.y});
     assert(pressed.includes('-pressed'),pressed);
     if(time===50 && winner==='black' && action==='menu' && motion==='no-preference') await page.screenshot({path:process.env.VERDICT_SCREENSHOT || '/home/hermes/.hermes/kanban/boards/russian-checkers/workspaces/t_be172616/evidence/early-menu-pressed.png'});
     await page.mouse.up();
     const state=await page.evaluate(()=>({calls:window.calls,collapsed:!document.querySelector('.board-verdict').classList.contains('expanded')}));
     if(action==='board') assert(state.collapsed); else assert.equal(state.calls[action],info.before[action]+1);
     rows.push({motion,winner,time,action,...info});
    }
   }
  }
  fs.writeFileSync(process.env.VERDICT_REPORT || '/home/hermes/.hermes/kanban/boards/russian-checkers/workspaces/t_be172616/evidence/early-pointer.json',JSON.stringify(rows,null,2));
  console.log(`${rows.length} real pointer cases passed (three outcomes, four early frames, three actions, normal/reduced motion)`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
