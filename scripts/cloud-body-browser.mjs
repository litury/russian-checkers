// Isolated, real HTTP body timeout regression; no production API/database used.
import { createServer as httpServer } from 'node:http';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright/index.mjs';

let mode = 'slow';
let headersSent = 0;
const api = httpServer((req, res) => {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
 if (req.method === 'OPTIONS') { res.end(); return; }
 res.setHeader('Content-Type', 'application/json');
 if (req.url === '/health') { res.end('{"ok":true}'); return; }
 res.flushHeaders(); headersSent++;
 if (mode === 'slow') {
  // Send partial body now, never finish it: only the client's native budget aborts.
  res.write('{');
  return;
 }
 const body = req.url === '/players/guest'
  ? { id: 'browser-test-player', token: 'browser-test-only-token' }
  : req.url?.endsWith('/stats')
   ? { games: 7, white_wins: 3, black_wins: 2 }
   : { live: 1, white: 1, black: 1, games: 2 };
 res.end(JSON.stringify(body));
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
process.env.VITE_API_URL = `http://127.0.0.1:${api.address().port}`;
const vite = await createServer({
 server: { host: '127.0.0.1', port: 0 },
 plugins: [{ name: 'cloud-test-page', configureServer(server) {
  server.middlewares.use('/cloud-test', (_req, res) => {
   res.setHeader('Content-Type', 'text/html');
   res.end('<button id="probe">responsive</button><script>probe.onclick=()=>probe.textContent="clicked"</script>');
  });
 } }],
});
await vite.listen();
const origin = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
 const clients = [];
 for (let i = 0; i < 2; i++) {
  const context = await browser.newContext();
  await context.route('**/*', route => {
   const url = new URL(route.request().url());
   return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', req => console.log('requestfailed', req.url(), req.failure()));
  page.on('console', msg => { if (msg.type() === 'error') console.log('console', msg.text()); });
  // Blank local document avoids unrelated game's automatic presence traffic.
  await page.goto(`${origin}cloud-test`);
  clients.push(page);
 }
 const results = [];
 for (const page of clients) {
  const before = headersSent;
  const pending = page.evaluate(async () => {
   const cloud = await import('/src/online/cloud.ts');
   const start = performance.now();
   const results = await Promise.all([cloud.ensureGuest(), cloud.beatPresence(), cloud.recordBotMatch({humanSide:'white',winner:'draw',plies:[]})]);
   return { results, elapsed: performance.now() - start, stored: localStorage.length };
  });
  await page.locator('#probe').click();
  assert.equal(await page.locator('#probe').textContent(), 'clicked');
  const result = await pending;
  assert.deepEqual(result.results, [null, null, undefined]);
  assert.equal(result.stored, 0);
  assert.equal(headersSent - before, 3);
  assert.ok(result.elapsed >= 1400);
  mode = 'ok';
  assert.equal(await page.evaluate(async () => !!(await (await import('/src/online/cloud.ts')).ensureGuest())), true);
  mode = 'slow';
  assert.equal(await page.evaluate(async () => (await import('/src/online/cloud.ts')).loadStats()), null);
  mode = 'ok';
  assert.deepEqual(await page.evaluate(async () => (await import('/src/online/cloud.ts')).loadStats()), { games:7,white_wins:3,black_wins:2 });
  results.push(result);
  mode = 'slow';
 }
 // Exercise the real opening UI while automatic presence receives partial bodies.
 const game = clients[0];
 await game.evaluate(() => localStorage.clear());
 await game.goto(origin);
 await game.locator('#opening-options').click();
 await game.locator('#opening-settings').click();
 assert.equal(await game.locator('#opening-settings-dialog').evaluate(el => el.open), true);
 await game.waitForTimeout(2200);
 assert.equal(await game.locator('#opening-play').isEnabled(), true);
 await game.screenshot({ path: 'cloud-body-ui.png' });
 assert.deepEqual(errors, []);
 console.log(JSON.stringify({ scenario:'real headers + partial body + native 1500ms abort; retry; two independent contexts; clickable during pending HTTP', results, errors }, null, 2));
} finally {
 await browser.close();
 await vite.close();
 api.closeAllConnections();
 await new Promise(resolve => api.close(resolve));
}
