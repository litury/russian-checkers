import {chromium} from '/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:19452', api='http://127.0.0.1:19453';
const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=document-user-activation-required']});
const results=[],clients=[];const out='artifacts/browser';
async function client(label,{muted=false,slow=false,reduced=false,mobile=false}={}){
 const guest=await (await fetch(api+'/players/guest',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json();
 assert.ok(guest.id);
 const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:900},reducedMotion:reduced?'reduce':'no-preference'});
 const blocked=[],errors=[],net=[];
 const allowed=url=>{const u=new URL(url);return u.hostname==='127.0.0.1'&&['19452','19453'].includes(u.port);};
 await c.route('**/*',async r=>{if(!allowed(r.request().url())){blocked.push({kind:'http',url:r.request().url()});return r.abort();}if(slow&&/\/play-b\.ogg(?:\?|$)/.test(r.request().url()))await new Promise(r=>setTimeout(r,900));return r.continue();});
 // Route every non-loopback socket to rejection; allowed sockets stay native.
 await c.routeWebSocket(url=>!allowed(url.toString()),ws=>{blocked.push({kind:'ws',url:ws.url()});ws.close();});
 await c.addInitScript(({guest,muted})=>{
  localStorage.setItem('checkers.playerId',guest.id);localStorage.setItem('checkers.playerToken',guest.token);localStorage.setItem('checkers.autoMove','0');localStorage.setItem('checkers.sfxMuted',String(muted));
  window.trace=[];window.sdkCallbacks={};window.YaGames={init:async()=>({on:(name,fn)=>window.sdkCallbacks[name]=fn,features:{LoadingAPI:{ready(){}}}})};
  const log=(type,data={})=>window.trace.push({type,t:performance.now(),...data});
  const timeout=window.setTimeout.bind(window);window.setTimeout=(fn,delay,...args)=>{if(delay!==1500||typeof fn!=='function')return timeout(fn,delay,...args);const at=performance.now();log('connect-budget-scheduled',{at});return timeout((...values)=>{log('connect-budget-fired',{at,elapsed:performance.now()-at});return fn(...values);},delay,...args);};
  const bytes=new WeakMap(), names=new WeakMap(),gains=new WeakMap();let serial=0;
  const ab=Response.prototype.arrayBuffer;Response.prototype.arrayBuffer=async function(){const b=await ab.call(this);bytes.set(b,this.url.split('/').at(-1).split('?')[0].replace(/\.[^.]+$/,''));return b;};
  const slice=ArrayBuffer.prototype.slice;ArrayBuffer.prototype.slice=function(...args){const b=slice.apply(this,args);if(bytes.has(this))bytes.set(b,bytes.get(this));return b;};
  const proto=AudioContext.prototype,decode=proto.decodeAudioData;
  proto.decodeAudioData=async function(b,...args){const name=bytes.get(b)||'unknown';const decoded=await decode.call(this,b,...args);names.set(decoded,name);log('decode',{name,duration:decoded.duration});return decoded;};
  const gain=proto.createGain;proto.createGain=function(){const g=gain.call(this),id=++serial;gains.set(g,id);for(const method of ['setTargetAtTime','cancelScheduledValues','setValueAtTime','linearRampToValueAtTime']){const original=g.gain[method].bind(g.gain);g.gain[method]=(...args)=>{log('gain',{id,method,args});return original(...args);};}return g;};
  const source=proto.createBufferSource;proto.createBufferSource=function(){const s=source.call(this),id=++serial;let gainId;const connect=s.connect.bind(s);s.connect=(node,...args)=>{gainId=gains.get(node);return connect(node,...args);};const start=s.start.bind(s),stop=s.stop.bind(s);s.start=(...args)=>{log('start',{id,name:names.get(s.buffer),loop:s.loop,gainId,ctx:this.currentTime});return start(...args);};s.stop=(...args)=>{log('stop',{id,name:names.get(s.buffer),args});return stop(...args);};s.addEventListener('ended',()=>log('ended',{id,name:names.get(s.buffer)}));return s;};
 },{guest,muted});
 const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)net.push({url:r.url(),status:r.status()});});
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('websocket',ws=>{const id=net.length;net.push({socket:id,url:ws.url(),at:Date.now()});ws.on('framesent',e=>{try{const m=JSON.parse(String(e.payload));net.push({socket:id,at:Date.now(),wsSent:m.type});}catch{}});ws.on('framereceived',e=>{try{const m=JSON.parse(String(e.payload));net.push({socket:id,at:Date.now(),wsType:m.type,ply:m.ply,error:m.error,begun:m.begun});}catch{}});ws.on('close',()=>net.push({socket:id,at:Date.now(),closed:true}));ws.on('socketerror',()=>net.push({socket:id,at:Date.now(),wsError:true}));});
 const record={label,page,c,blocked,errors,net};clients.push(record);
 await page.goto(origin);await page.evaluate(async()=>{await fetch('https://audio-sentinel.invalid/probe').catch(()=>{});await new Promise(resolve=>{const w=new WebSocket('wss://audio-sentinel.invalid/probe');w.onerror=resolve;w.onclose=resolve;setTimeout(resolve,1000);});});
 assert.ok(blocked.some(x=>x.kind==='http'));assert.ok(blocked.some(x=>x.kind==='ws'));
 await page.waitForFunction(()=>window.__checkersScene?.title,null,{timeout:90000});console.log('loaded',label);
 return page;
}
const trace=p=>p.evaluate(()=>window.trace);
const count=(t,n)=>t.filter(x=>x.type==='start'&&x.name===n).length;
async function warm(p){await p.click('#opening-options');await p.waitForFunction(()=>window.trace.filter(x=>x.type==='decode').length>=70,null,{timeout:60000});await p.keyboard.press('Escape');console.log('warm');}
async function start(p){await p.click('#opening-play');await p.waitForFunction(()=>{const s=window.__checkersScene;return s?.phase==='human'&&!s.countingIn&&s.actionsEntered;},null,{timeout:60000});console.log('started');}
async function square(p,name){const xy=await p.evaluate(name=>{const s=window.__checkersScene;const cells=s.children.list.filter(o=>o.type==='Rectangle'&&o.depth===2);const cell=cells[(+name[1]-1)*8+name.charCodeAt(0)-97],r=s.game.canvas.getBoundingClientRect();return {x:r.left+cell.x,y:r.top+cell.y};},name);await p.mouse.click(xy.x,xy.y);}
async function save(label,p){await p.screenshot({path:`${out}/${label}.png`});}
try{
 if(!process.env.ONLINE_ONLY){
 const p=await client('warm');assert.equal((await trace(p)).filter(x=>x.type==='start').length,0);await warm(p);await save('menu',p);await start(p);await save('board',p);
 let t=await trace(p);assert.equal(count(t,'gate_stop'),1);assert.equal(count(t,'panel-ready'),1);
 await square(p,'c3');await square(p,'c3');await square(p,'c3');assert.equal(count(await trace(p),'select-b'),1);
 await square(p,'d4');await p.waitForFunction(()=>window.__checkersScene.phase==='human'&&!window.__checkersScene.moving&&!document.querySelector('#match-undo').disabled,{timeout:15000});
 await p.click('#match-undo');assert.equal(count(await trace(p),'undo-applied'),1);assert.equal(count(await trace(p),'panel-ready'),1);
 await p.click('#match-resign');await p.locator('#resign-confirmation[open]').waitFor();await save('resign-modal',p);await p.click('#resign-continue');await p.waitForTimeout(350);
 t=await trace(p);assert.equal(count(t,'ui-close'),2);assert.equal(count(t,'panel-ready'),1);
 // Preserve cfeb6a5 interrupted-exit composition while testing semantic Escape.
 for(const phase of [0,50,140]){
  await p.click('#match-resign');
  const before=await p.evaluate(async phase=>{const d=document.querySelector('#resign-confirmation');for(const a of document.getAnimations().filter(a=>a.effect?.target===d)){a.pause();a.currentTime=phase;}await new Promise(r=>requestAnimationFrame(r));return getComputedStyle(d).transform;},phase);
  const closes=count(await trace(p),'ui-close');await p.keyboard.press('Escape');
  assert.equal(await p.locator('#resign-confirmation').evaluate(d=>d.style.getPropertyValue('--resign-exit-transform')),before);
  assert.equal(count(await trace(p),'ui-close'),closes+1);await p.waitForTimeout(350);
  assert.equal(await p.locator('#resign-confirmation').evaluate(d=>d.open),false);
 }
 // Real native gain traces, with direct scene speech calls explicitly labelled as injected stimuli.
 await p.evaluate(()=>{window.__checkersScene.title.speakOrcTurn('time-low','black');window.__checkersScene.title.speakOrcTurn('victory','black');window.checkersSettings.set({music:.5});});
 await p.waitForTimeout(160);t=await trace(p);const bed=t.find(x=>x.type==='start'&&x.name==='match-b-90s');const gainTargets=t.filter(x=>x.type==='gain'&&x.id===bed.gainId&&x.method==='setTargetAtTime');assert.ok(gainTargets.at(-1).args[0]<.01);
 await p.evaluate(()=>window.sdkCallbacks.game_api_pause());const paused=(await trace(p)).filter(x=>x.type==='start').length;
 await p.evaluate(()=>{window.__checkersScene.title.hintWave();window.__checkersScene.title.speakOrcTurn('time-low','black');});await p.waitForTimeout(150);assert.equal((await trace(p)).filter(x=>x.type==='start').length,paused);
 await p.evaluate(()=>window.sdkCallbacks.game_api_resume());await p.waitForTimeout(150);assert.deepEqual((await trace(p)).filter(x=>x.type==='start').slice(paused).map(x=>x.name),['match-b-90s']);
 await p.evaluate(()=>window.checkersSettings.set({muted:true}));const mutedStarts=(await trace(p)).filter(x=>x.type==='start').length;await p.evaluate(()=>window.__checkersScene.title.hintWave());await p.evaluate(()=>window.checkersSettings.set({muted:false}));assert.deepEqual((await trace(p)).filter(x=>x.type==='start').slice(mutedStarts).map(x=>x.name),['match-b-90s']);
 await p.click('#match-resign');await p.locator('#resign-confirmation[open]').waitFor();await p.click('#resign-confirm');await p.locator('.board-verdict:not([hidden])').waitFor();await save('result',p);
 const before=count(await trace(p),'draw-result');await p.click('[data-verdict=board]');await p.click('[data-verdict=open]');assert.equal(count(await trace(p),'draw-result'),before);
 await p.click('.verdict-panel [data-verdict=menu]');await p.waitForTimeout(500);await start(p);
 // Draw injected through actual endMatch/presentResult owner; not a played rules draw.
 await p.evaluate(()=>{window.__checkersScene.endMatch('draw');window.__checkersScene.presentResult();});await p.locator('.board-verdict:not([hidden])').waitFor();assert.equal(count(await trace(p),'draw-result'),1);await p.click('[data-verdict=board]');await p.click('[data-verdict=open]');assert.equal(count(await trace(p),'draw-result'),1);await save('draw',p);
 results.push({case:'warm bot click path, selection dedup, rail, undo, modal, result, injected duck/pause/draw',passed:true});await fs.writeFile(`${out}/warm-trace.json`,JSON.stringify(await trace(p),null,2));await clients[0].c.close();
 for(const [label,opts] of [['cold',{}],['slow',{slow:true}],['muted',{muted:true}],['reduced-mobile',{reduced:true,mobile:true}]]){
  const q=await client(label,opts);assert.equal((await trace(q)).filter(x=>x.type==='start').length,0);await start(q);await q.waitForTimeout(1400);const tr=await trace(q);if(opts.muted)assert.equal(tr.filter(x=>x.type==='start').length,0);if(opts.slow)assert.equal(count(tr,'play-b'),0);if(opts.reduced)for(const cue of ['gate_stop','gate_motion','timer-slide','timer-lock'])assert.equal(count(tr,cue),0);await save(label,q);results.push({case:label,passed:true});await fs.writeFile(`${out}/${label}-trace.json`,JSON.stringify(tr,null,2));await clients.at(-1).c.close();
 }
 }
 const onlineOptions={mobile:!process.env.ONLINE_DESKTOP};
 const a=await client('online-a',onlineOptions);await warm(a);const b=await client('online-b',onlineOptions);await warm(b);
 await a.click('#opening-online');await a.locator('#online-hub[open]').waitFor();await a.click('#online-hub [data-action=create]');await a.waitForFunction(()=>/\d{6}/.test(document.querySelector('#opening-search-copy').textContent));
 const code=(await a.locator('#opening-search-copy').textContent()).match(/\d{6}/)[0];await b.click('#opening-online');await b.locator('#online-hub[open]').waitFor();await b.click('#online-hub [data-action=enter]');await b.fill('#opening-friend-code',code);await b.click('#opening-search-go');
 for(const q of [a,b])await q.waitForFunction(()=>window.__checkersScene.onlineBegun&&window.__checkersScene.actionsEntered,null,{timeout:60000});
 const white=(await a.evaluate(()=>window.__checkersScene.humanSide))==='white'?a:b;await square(white,'c3');await square(white,'d4');
 for(const q of [a,b])await q.waitForFunction(()=>window.__checkersScene.lastPly===1&&!window.__checkersScene.moving,{timeout:15000});
 const positions=await Promise.all([a,b].map(q=>q.evaluate(()=>window.__checkersScene.position)));assert.deepEqual(positions[0],positions[1]);
 for(const [i,q]of [a,b].entries()){const tr=await trace(q);assert.equal(count(tr,'gate_stop'),1);assert.equal(count(tr,'panel-ready'),1);await save(`online-${i}`,q);}
 await a.click('#match-resign');await a.locator('#resign-confirmation[open]').waitFor();await a.click('#resign-continue');await a.waitForTimeout(350);await a.click('#match-resign');await a.locator('#resign-confirmation[open]').waitFor();await a.click('#resign-confirm');for(const q of [a,b])await q.locator('.board-verdict:not([hidden])').waitFor();results.push({case:'two real clients host/join/begin, converged ply, gate and rail once, resign cancel/outcome',passed:true});
}catch(e){results.push({failure:e.stack});process.exitCode=1;}
finally{
 for(const c of clients){let tr=[],state;try{tr=await trace(c.page);state=await c.page.evaluate(()=>({phase:window.__checkersScene?.phase,search:window.__checkersScene?.searchPhase,copy:document.querySelector('#opening-search-copy')?.textContent,hub:document.querySelector('#online-hub')?.open}));await c.page.screenshot({path:`${out}/${c.label}-final.png`});}catch{}if(tr.length)await fs.writeFile(`${out}/${c.label}-trace.json`,JSON.stringify(tr,null,2));results.push({client:c.label,state,blocked:c.blocked,errors:c.errors,network:c.net});}
 await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
}
