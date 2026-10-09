// Isolated, temporary headless Chromium; local Vite serves the real runtime module.
// STUDIO_PLAYWRIGHT=/path/to/playwright VERDICT_PREVIEW=http://127.0.0.1:5197
// VERDICT_EVIDENCE=docs/preview-t_1577b2be/final node tests/verdict-safe-area.cjs
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.VERDICT_PREVIEW || 'http://127.0.0.1:4242';
const evidence = process.env.VERDICT_EVIDENCE || '.';
const fontFaces = fs
	.readFileSync('index.html', 'utf8')
	.match(/@font-face\{[^}]+\}/g)
	.join('\n');
const fixture = `<!doctype html><meta charset="utf-8"><style>${fontFaces}body{margin:0;background:#151918}</style><script type="module">import '/src/client/fonts/fonts.css';import {createResultOverlay} from '/src/client/app/boardVerdict.ts';window.overlay=createResultOverlay({events:{once(){}}},{onPlayAgain(){window.action='again'},onMenu(){window.action='menu'}});window.showVerdict=(outcome,reason='Партия завершена')=>window.overlay.show({winner:outcome==='draw'?'draw':outcome==='win'?'white':'black',humanSide:'white',reason,online:false});</script>`;
(async () => {
	const browser = await chromium.launch({
		headless: true,
		executablePath: '/usr/local/bin/google-chrome',
		args: ['--no-sandbox'],
	});
	const results = [];
	try {
		for (const width of [390, 1280])
			for (const dpr of [2, 3])
				for (const reducedMotion of ['no-preference', 'reduce']) {
					const context = await browser.newContext({
						viewport: { width, height: 844 },
						deviceScaleFactor: dpr,
						reducedMotion,
					});
					await context.route('**/*', (r) =>
						new URL(r.request().url()).origin === origin
							? r.continue()
							: r.abort(),
					);
					await context.route(origin + '/tests/verdict-fixture.html', (r) =>
						r.fulfill({ contentType: 'text/html', body: fixture }),
					);
					await context.routeWebSocket('**/*', (ws) => ws.close());
					const page = await context.newPage();
					const errors = [];
					page.on('pageerror', (e) => errors.push(e.message));
					await page.goto(origin + '/tests/verdict-fixture.html', {
						waitUntil: 'domcontentloaded',
					});
					await page.waitForFunction(() => window.showVerdict);
					await page.evaluate(async () => {
						const faces = await Promise.all(
							[
								'600 25px Literata',
								'400 13px "Golos Text"',
								'600 16px "Golos Text"',
							].map((font) => document.fonts.load(font, 'ПАРТИЯ ПОРАЖЕНИЕ')),
						);
						if (faces.some((group) => group.length === 0))
							throw new Error('Production fonts unavailable');
						await document.fonts.ready;
					});
					for (const outcome of ['win', 'loss', 'draw']) {
						await page.evaluate((o) => {
							window.overlay.hide();
							window.showVerdict(o);
						}, outcome);
						await page.waitForTimeout(350);
						const slots = await page.evaluate(() => {
							const title = document
								.querySelector('.verdict-title')
								.getBoundingClientRect();
							return [
								...document.querySelectorAll(
									'.verdict-eyebrow,#verdict-heading,#verdict-reason',
								),
							].map((e) => {
								const range = document.createRange();
								range.selectNodeContents(e);
								const r = range.getBoundingClientRect(),
									lower = e.id === 'verdict-reason';
								return {
									text: e.textContent,
									contained:
										r.left >= title.left + 84 &&
										r.right <= title.right - 84 &&
										r.top >= title.top + (lower ? 148 : 47) &&
										r.bottom <= title.top + (lower ? 190 : 121),
								};
							});
						});
						assert(
							slots.every((s) => s.contained),
							JSON.stringify(slots),
						);
						const slice = await page
							.locator('[data-verdict="again"]')
							.evaluate((e) => {
								const s = getComputedStyle(e);
								return {
									slice: s.borderImageSlice,
									width: s.borderImageWidth,
									filter: s.filter,
								};
							});
						assert.equal(slice.slice, '30 105 fill');
						assert.equal(slice.width, '10px 35px');
						assert.equal(slice.filter, 'none');
						const sizes = await page
							.locator('.verdict-actions button')
							.evaluateAll((es) =>
								es.map((e) => ({
									width: e.offsetWidth,
									height: e.offsetHeight,
								})),
							);
						assert(
							sizes[0].width === sizes[1].width &&
								sizes[1].width === sizes[2].width &&
								sizes[0].height > sizes[1].height &&
								sizes[1].height > sizes[2].height,
							'action hierarchy',
						);
						for (const state of ['expanded', 'collapsed']) {
							if (state === 'collapsed')
								await page.locator('[data-verdict="board"]').click();
							const geometry = await page.evaluate(() =>
								[...document.querySelectorAll('.board-verdict button')]
									.filter((b) => b.getBoundingClientRect().height)
									.map((b) => {
										const rect = b.getBoundingClientRect();
										const range = document.createRange();
										range.selectNodeContents(b);
										const text = range.getBoundingClientRect();
										return {
											label: b.textContent,
											width: rect.width,
											height: rect.height,
											x: rect.x,
											right: rect.right,
											leftInset: text.left - rect.left,
											rightInset: rect.right - text.right,
											overflow: b.scrollWidth > b.clientWidth,
										};
									}),
							);
							for (const b of geometry) {
								assert(b.height >= 44, b.label + ' target');
								assert(
									b.x >= 0 && b.right <= width,
									b.label + ' viewport overflow',
								);
								assert(!b.overflow, b.label + ' text overflow');
								assert(
									b.leftInset >= 23 && b.rightInset >= 23,
									b.label + ' decorative safe-area',
								);
							}
							await page.screenshot({
								path: `${evidence}/safe-${width}-dpr${dpr}-${reducedMotion}-${outcome}-${state}.png`,
							});
							results.push({
								width,
								dpr,
								reducedMotion,
								outcome,
								state,
								geometry,
								slots,
								sizes,
							});
						}
						await page.locator('[data-verdict="open"]').click();
						await page.keyboard.press('Tab');
						assert(
							await page
								.locator('[data-verdict="again"]')
								.evaluate((b) => b === document.activeElement),
							'keyboard focus',
						);
						await page.locator('.verdict-panel [data-verdict="menu"]').click();
						assert.equal(await page.evaluate(() => window.action), 'menu');
					}
					// Exercise all distinct CSS states using real pointer input and native disabled state.
					await page.evaluate(() => window.showVerdict('win'));
					for (const [action, tier] of [
						['again', 'primary'],
						['board', 'secondary'],
						['menu', 'quiet'],
					]) {
						const b = page.locator(`.verdict-panel [data-verdict="${action}"]`);
						for (const state of ['rest', 'hover', 'pressed', 'disabled']) {
							await page.mouse.move(0, 0);
							await b.evaluate((e) => (e.disabled = false));
							if (state === 'hover' || state === 'pressed') await b.hover();
							if (state === 'pressed') await page.mouse.down();
							if (state === 'disabled')
								await b.evaluate((e) => (e.disabled = true));
							assert(
								(
									await b.evaluate((e) => getComputedStyle(e).borderImageSource)
								).includes(`${tier}-${state}.webp`),
							);
							if (state === 'pressed') {
								await b.evaluate((e) => (e.disabled = true));
								await page.mouse.up();
							}
						}
						await b.evaluate((e) => (e.disabled = false));
					}
					// Every shipped reason must fit the lower recess; no truncation or text rewrite.
					for (const reason of [
						'Игроки не вернулись в партию',
						'Соперник не вернулся в партию',
						'Вы не вернулись в партию',
						'Соперник сдался',
						'Вы сдались',
						'У соперника закончилось время',
						'У вас закончилось время',
						'Партия завершена',
						'Позиция повторилась трижды',
						'Ничья по правилам',
						'У соперника не осталось ходов',
						'У вас не осталось ходов',
						'У соперника не осталось шашек',
						'У вас не осталось шашек',
					]) {
						await page.evaluate((reason) => {
							window.overlay.hide();
							window.showVerdict('loss', reason);
						}, reason);
						await page.waitForTimeout(280);
						assert(
							await page.locator('#verdict-reason').evaluate((e) => {
								const r = e.getBoundingClientRect(),
									t = document.createRange();
								t.selectNodeContents(e);
								const b = t.getBoundingClientRect();
								return (
									b.x >= r.x &&
									b.right <= r.right &&
									b.y >= r.y &&
									b.bottom <= r.bottom &&
									e.scrollHeight <= e.clientHeight
								);
							}),
							reason,
						);
					}
					assert.deepEqual(errors, []);
					await context.close();
				}
		fs.writeFileSync(
			`${evidence}/safe-area-results.json`,
			JSON.stringify(results, null, 2),
		);
		console.log(
			`Verified ${results.length} real-browser geometry cases; twelve states, all fourteen reasons, keyboard/reopen/menu; no JS errors`,
		);
	} finally {
		await browser.close();
	}
})().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
