// Author verification: isolated Chromium, real board input, navigator.vibrate spy only.
import { chromium } from '/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin = process.env.HAPTICS_PREVIEW ?? 'http://127.0.0.1:4230';
const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const results = [];
const errors = [];
const out = 'docs/haptics-evidence';
await fs.mkdir(out, { recursive: true });
async function client(saved = null, api = 'spy') {
 // One disposable guest per context prevents startup's parallel guest probes from
 // exhausting the unchanged server rate limit during repeated author checks.
 const response = await fetch('http://127.0.0.1:4229/players/guest', {method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 assert.equal(response.status,201,'isolated test guest creation');
 const guest = await response.json();
 const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (!['127.0.0.1'].includes(url.hostname) || ![new URL(origin).port, '4229'].includes(url.port)) return route.abort();
  if (url.pathname === '/src/client/app/main.ts') {
   // Capture an existing Game instance only; no changes to rules, inputs or haptics.
   const response = await route.fetch();
   const text = await response.text(); assert.ok(text.includes('new Phaser.Game('));
   return route.fulfill({ response, body: text.replace('new Phaser.Game(', 'window.testGame = new Phaser.Game(') });
  }
  return route.continue();
 });
 await context.addInitScript(({ saved, api, guest }) => {
  localStorage.setItem('checkers.playerId',guest.id);
  localStorage.setItem('checkers.playerToken',guest.token);
  localStorage.setItem('checkers.autoMove', '0');
  if (saved !== null && localStorage.getItem('checkers.menuVibration') === null) localStorage.setItem('checkers.menuVibration', saved);
  window.hapticCalls = [];
  Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: api === 'missing' ? undefined : pattern => {
   window.hapticCalls.push(pattern);
   if (api === 'throw') throw Error('device denied');
   return api !== 'false';
  } });
 }, { saved, api, guest });
 const page = await context.newPage();
 const network = [];
 page.on('websocket', socket => {
  socket.on('framereceived', ({payload}) => { try {const data=JSON.parse(String(payload));network.push({type:data.type,error:data.error});}catch{} });
  socket.on('socketerror', error => network.push({socketError:error}));
 });
 page.on('response', response => { if(response.status()>=400) network.push({path:new URL(response.url()).pathname,status:response.status()}); });
 page.hapticNetwork = network;
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(origin);
 await page.waitForFunction(() => !document.querySelector('#opening-play').disabled);
 return { context, page };
}
const calls = page => page.evaluate(() => window.hapticCalls);
const clear = page => page.evaluate(() => { window.hapticCalls = []; });
async function expectCalls(page, expected, label) {
 assert.deepEqual(await calls(page), expected, label); results.push({ label, calls: expected });
}
async function start(page) {
 await page.click('#opening-play');
 await page.waitForFunction(() => window.testGame?.scene.getScene('GameScene')?.phase === 'human' && !window.testGame.scene.getScene('GameScene').countingIn);
 await page.waitForTimeout(600);
}
async function center(page, name) {
 return page.evaluate(name => {
  const s = window.testGame.scene.getScene('GameScene');
  const row = +name[1] - 1, col = name.charCodeAt(0) - 97;
  const cells = s.children.list.filter(o => o.type === 'Rectangle' && o.depth === 2);
  const cell = cells[row * 8 + col];
  const rect = s.game.canvas.getBoundingClientRect();
  return { x: rect.left + cell.x, y: rect.top + cell.y };
 }, name);
}
async function clickSquare(page, name) {
 const p = await center(page, name); await page.mouse.click(p.x, p.y, { delay: 75 });
 await page.waitForTimeout(50);
 await page.waitForFunction(() => !window.testGame.scene.getScene('GameScene').moving);
}
async function fixture(page, pieces) {
 await page.evaluate(pieces => {
  const s = window.testGame.scene.getScene('GameScene');
  s.botTimer?.remove(false); s.board.reset(); s.botUndoGen++; s.resultGen++;
  s.position = { turn: 'white', squares: Array.from({ length: 8 }, () => Array(8).fill(null)) };
  for (const [name, piece] of Object.entries(pieces)) s.position.squares[+name[1]-1][name.charCodeAt(0)-97] = { side: piece[0] === 'w' ? 'white' : 'black', kind: piece[1] === 'k' ? 'king' : 'man' };
  s.selected = null; s.humanChain = null; s.moving = false; s.flagLock = false; s.phase = 'human'; s.acceptedResult = null;
  s.clocks = { white: 60000, black: 60000 }; s.clockStartedAt = s.time.now; s.refresh();
  window.hapticCalls = [];
 }, pieces);
}
try {
 const { page } = await client();
 await page.click('#opening-options'); await page.click('#opening-settings');
 await expectCalls(page, [], 'default off');
 await page.check('#settings-vibration'); await expectCalls(page, [10], 'enable preview');
 await page.check('#settings-muted'); await expectCalls(page, [10,10], 'independent mute toggle');
 await page.getByRole('button', { name: 'Готово', exact: true }).click();
 await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
 await clear(page);
 await page.click('.gate-piece-slot[data-side="black"]');
 await expectCalls(page, [10], 'side button exactly once');
 await page.click('.gate-piece-slot[data-side="white"]');
 await clear(page);
 await page.evaluate(() => { document.querySelector('#opening-play').disabled = true; });
 const disabledButton = await page.locator('#opening-play').boundingBox();
 await page.mouse.click(disabledButton.x + disabledButton.width/2,disabledButton.y + disabledButton.height/2);
 await expectCalls(page,[],'disabled control silent');
 await page.evaluate(() => { document.querySelector('#opening-play').disabled = false; });
 await start(page); await clear(page);
 const a = await center(page, 'a3');
 await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.waitForTimeout(100);
 await expectCalls(page, [], 'board pointerdown is silent');
 await page.mouse.move(1,1); await page.mouse.up();
 await expectCalls(page, [], 'cancel outside is silent');
 await page.mouse.move(a.x,a.y); await page.mouse.down();
 await page.evaluate(() => window.testGame.canvas.dispatchEvent(new PointerEvent('pointercancel', {bubbles:true,pointerId:1})));
 await page.mouse.up(); await expectCalls(page,[],'pointercancel is silent');
 await clickSquare(page,'a3'); await expectCalls(page,[10],'own selectable piece');
 await clickSquare(page,'a3'); await expectCalls(page,[10],'same selection does not repeat');
 await clickSquare(page,'b4'); await expectCalls(page,[10,15],'quiet landing');
 await page.waitForTimeout(900); await expectCalls(page,[10,15],'bot and clock silent');
 await fixture(page,{ c3:'w', d4:'b', f6:'b', h8:'b', a1:'w' });
 await clickSquare(page,'b2'); await expectCalls(page,[],'empty square silent');
 await clickSquare(page,'a1'); await expectCalls(page,[],'own blocked piece silent');
 await clickSquare(page,'c3'); await clickSquare(page,'e5'); await clickSquare(page,'g7');
 await expectCalls(page,[10,23,23],'one impulse per capture jump');
 await fixture(page,{ b6:'w', c7:'b', f6:'b', h2:'b', a1:'w' });
 await clickSquare(page,'b6'); await clickSquare(page,'d8');
 await expectCalls(page,[10,[12,45,12]],'promotion replaces capture');
 await page.screenshot({ path: `${out}/promotion.png` });
 await clickSquare(page,'g5'); await expectCalls(page,[10,[12,45,12],23],'capture after mid-chain promotion');
 await fixture(page,{ a3:'w', h8:'b' });
 await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
 await expectCalls(page,[0],'background hook cancels pattern');
 await clickSquare(page,'a3'); await expectCalls(page,[0],'hidden page feedback suppressed');
 await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
 await expectCalls(page,[0],'visibility restore never replays feedback');
 await page.reload();
 await page.waitForFunction(() => !document.querySelector('#opening-play').disabled);
 await page.click('#opening-options'); await page.click('#opening-settings');
 assert.equal(await page.isChecked('#settings-vibration'),true);
 await clear(page); await page.uncheck('#settings-vibration'); await expectCalls(page,[0],'disable cancels');
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 await expectCalls(page,[0],'controls silent after disable');
 for (const api of ['missing','throw','false']) {
  const c = await client('true',api); await start(c.page); await clear(c.page);
  await clickSquare(c.page,'a3'); await clickSquare(c.page,'b4');

  assert.equal(await c.page.evaluate(() => window.testGame.scene.getScene('GameScene').position.squares[3][1]?.side),'white');
  results.push({ label: `API ${api}: real move remains playable` }); await c.context.close();
 }
 // Real server + disposable PostgreSQL, two independent guest identities.
 const one = await client('true'), two = await client('true');
 await one.page.click('#opening-online'); await two.page.click('#opening-online');
 await one.page.click('#online-hub [data-action="find"]'); await two.page.click('#online-hub [data-action="find"]');
 for (const p of [one.page,two.page]) {
  try { await p.waitForFunction(() => window.testGame?.scene.getScene('GameScene')?.onlineBegun && !window.testGame.scene.getScene('GameScene').countingIn,{},{timeout:30000}); }
  catch (error) { console.log('online diagnostic', p.hapticNetwork, await p.evaluate(() => ({text:document.body.innerText,phase:window.testGame?.scene.getScene('GameScene')?.phase,search:window.testGame?.scene.getScene('GameScene')?.searchPhase}))); throw error; }
 }
 const white = await one.page.evaluate(() => window.testGame.scene.getScene('GameScene').humanSide) === 'white' ? one.page : two.page;
 const black = white === one.page ? two.page : one.page;
 await clear(white); await clear(black);
 await clickSquare(white,'a3'); await clickSquare(white,'b4');
 await white.waitForFunction(() => window.testGame.scene.getScene('GameScene').lastPly === 1);
 await black.waitForFunction(() => window.testGame.scene.getScene('GameScene').lastPly === 1);
 await expectCalls(white,[10,15],'online own confirmed move'); await expectCalls(black,[],'online opponent silent');
 const move = await black.evaluate(() => ({ from:{row:5,col:7}, path:[{row:4,col:6}], side:'black',ply:2,turn:'white' }));
 await clickSquare(black,'h6'); await clickSquare(black,'g5');
 for (const p of [white,black]) await p.waitForFunction(() => window.testGame.scene.getScene('GameScene').lastPly === 2);
 await expectCalls(black,[10,15],'second independent client own move'); await expectCalls(white,[10,15],'remote reply silent');
 await white.evaluate(move => { const s = window.testGame.scene.getScene('GameScene'); s.inboundNet.push(move,move); s.drainInbound(); s.refresh(); },move);
 await expectCalls(white,[10,15],'duplicate network plies and rerender silent');
 assert.deepEqual(await white.evaluate(() => window.testGame.scene.getScene('GameScene').position),await black.evaluate(() => window.testGame.scene.getScene('GameScene').position));
 await white.screenshot({path:`${out}/online-white.png`}); await black.screenshot({path:`${out}/online-black.png`});
 assert.deepEqual(errors,[],'no uncaught browser errors');
 await fs.writeFile(`${out}/browser-results.json`,JSON.stringify({origin, browser:browser.version(),results,errors,physicalVibrationTested:false},null,2));
 console.log(JSON.stringify({results,errors},null,2));
} finally { await browser.close(); }
