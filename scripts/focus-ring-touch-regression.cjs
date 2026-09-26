/**
 * Browser regression for the touch focus ring (kanban t_f1bdde92).
 *
 * Real CDP touch plus a real keyboard in headless Chrome at 390x844, without
 * `CSS.forcePseudoState` and without synthetic `focusin`: every step drives the
 * page the way a finger or a keyboard actually does. The
 * `focus({focusVisible:true})` steps are the documented script /
 * assistive-technology path — Chrome fires no focusin when the element is
 * already active, which is exactly the case that used to stay suppressed.
 *
 * Usage: node scripts/focus-ring-touch-regression.cjs [baseURL] [screenshotDir]
 *   baseURL        default http://127.0.0.1:5188/ (a dev preview of the candidate)
 *   screenshotDir  default ./focus-ring-shots
 *   PLAYWRIGHT_MODULE / CHROME_BIN override the lookup below.
 * Exit 0 = every expectation held, 1 = a check failed, 2 = no browser module.
 */
const fs = require('node:fs');

const BASE = process.argv[2] || 'http://127.0.0.1:5188/';
const OUT = process.argv[3] || `${process.cwd()}/focus-ring-shots`;

let chromium = null;
let loadError = null;
for (const spec of [
	process.env.PLAYWRIGHT_MODULE,
	'/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright',
	'playwright',
].filter(Boolean)) {
	try {
		({ chromium } = require(spec));
		break;
	} catch (error) {
		loadError = error;
	}
}
if (!chromium) {
	console.error('playwright not found; set PLAYWRIGHT_MODULE —', loadError);
	process.exit(2);
}

const chrome = process.env.CHROME_BIN || '/usr/local/bin/google-chrome';
const launch = {
	headless: true,
	args: ['--no-sandbox'],
	...(fs.existsSync(chrome) ? { executablePath: chrome } : {}),
};

const RING = /rgb\((190, 217, 236|239, 207, 127|237, 196, 118)\)/;

const results = [];
const check = (name, ok, detail) => {
	results.push({ name, ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
};

const styleOf = (locator) =>
	locator.evaluate((el) => ({
		active: document.activeElement === el,
		marked: el.hasAttribute('data-pointer-focus'),
		fv: el.matches(':focus-visible'),
		outline: getComputedStyle(el).outline,
	}));

const hasRing = (s) => s.fv && RING.test(s.outline);
const noRing = (s) => !RING.test(s.outline);

/**
 * The computed tap highlight of an element. A tap must flash nothing at all,
 * so every interactive surface has to resolve to fully transparent; a value
 * such as the engine default `rgba(51, 181, 229, 0.4)` or a hand-picked
 * `rgba(0, 0, 0, .3)` is still a visible plaque and fails.
 */
const highlightOf = (locator) =>
	locator.evaluate((el) =>
		getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color').trim(),
	);
const transparentHighlight = (value) =>
	value === 'transparent' ||
	/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(value);

/** Style of whatever holds focus right now, or null for the body. */
const focusedStyle = (page) =>
	page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body || el === document.documentElement)
			return null;
		return {
			who: el.id || `${el.tagName}.${el.className}`,
			active: true,
			marked: el.hasAttribute('data-pointer-focus'),
			fv: el.matches(':focus-visible'),
			outline: getComputedStyle(el).outline,
		};
	});

/**
 * Tab (up to `presses` times) until something outside the body holds focus,
 * then report that element: where a single Tab lands depends on DOM order.
 */
const tabUntilFocused = async (page, presses = 5) => {
	for (let i = 0; i < presses; i += 1) {
		await page.keyboard.press('Tab');
		const focused = await focusedStyle(page);
		if (focused) return focused;
	}
	return focusedStyle(page);
};

/** A real finger on whatever currently holds focus (the dialog's close button). */
const tapFocused = async (page) => {
	const box = await page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) return null;
		const r = el.getBoundingClientRect();
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	});
	if (!box) throw new Error('nothing focusable to tap');
	await page.touchscreen.tap(box.x, box.y);
};

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const browser = await chromium.launch(launch);
	try {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
		});
		// Hermetic run: this origin only, no websockets, no API writes.
		await context.route('**/*', (route) =>
			/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(
				route.request().url(),
			)
				? route.continue()
				: route.abort(),
		);
		await context.routeWebSocket('**/*', (ws) => ws.close());
		const page = await context.newPage();
		await page.goto(BASE);
		await page.locator('#opening-play').waitFor();
		await page.waitForFunction(
			() => !document.querySelector('#opening-play').disabled,
		);

		const slot = page.locator('#opening .gate-piece-slot[data-side="black"]');

		// K. No tap highlight anywhere: every menu control must resolve to a
		// fully transparent highlight, not the engine's default blue plaque.
		{
			const surfaces = {
				'#opening-play': page.locator('#opening-play'),
				'colour slot': slot,
				'#opening-options': page.locator('#opening-options'),
				'#opening-settings': page.locator('#opening-settings'),
				'#opening-history': page.locator('#opening-history'),
			};
			const values = {};
			let allClear = true;
			for (const [name, locator] of Object.entries(surfaces)) {
				const value = await highlightOf(locator);
				values[name] = value;
				if (!transparentHighlight(value)) allClear = false;
			}
			check(
				'K menu controls flash no tap highlight',
				allClear,
				JSON.stringify(values),
			);
		}

		// A. finger on the colour sample: no ring under the finger.
		await slot.tap();
		const tapped = await styleOf(slot);
		check(
			'A tap keeps no ring',
			tapped.marked && noRing(tapped),
			JSON.stringify(tapped),
		);

		// B. physical key without Tab: the keyboard ring is back.
		await page.keyboard.press('a');
		const keyed = await styleOf(slot);
		check(
			'B keyboard takes the ring back without moving focus',
			!keyed.marked && hasRing(keyed),
			JSON.stringify(keyed),
		);

		// C. finger returns to the still-focused button.
		await slot.tap();
		const retapped = await styleOf(slot);
		check(
			'C re-tap hides the ring again',
			retapped.marked && noRing(retapped),
			JSON.stringify(retapped),
		);

		// D. THE DEFECT: explicit visible focus, no blur, no Tab, no event.
		await slot.evaluate((el) => el.focus({ focusVisible: true }));
		const explicit = await styleOf(slot);
		await page.screenshot({ path: `${OUT}/regression-same-element.png` });
		check(
			'D focus({focusVisible:true}) shows the ring on the marked element',
			explicit.active && explicit.fv && !explicit.marked && hasRing(explicit),
			JSON.stringify(explicit),
		);

		// E. control: after a touch elsewhere the same request obviously shows.
		await page.touchscreen.tap(5, 5);
		await slot.evaluate((el) => el.focus({ focusVisible: true }));
		const control = await styleOf(slot);
		check(
			'E control: same request after a background touch',
			hasRing(control),
			JSON.stringify(control),
		);

		// D2. The re-tap at C left the gesture unspent (no focusin consumed
		// it). After an explicit visible focus the pending ownership must be
		// gone, so a real blur + focus pair without any new finger or key is
		// still a non-pointer focus and keeps its ring.
		await slot.tap(); // restore the marked, unspent state
		await slot.evaluate((el) => el.focus({ focusVisible: true }));
		await slot.evaluate((el) => {
			el.blur();
			el.focus({ focusVisible: true });
		});
		const afterBlur = await styleOf(slot);
		await page.screenshot({ path: `${OUT}/regression-blur-focus.png` });
		check(
			'D2 blur + focus({focusVisible:true}) keeps the ring',
			afterBlur.active &&
				afterBlur.fv &&
				!afterBlur.marked &&
				hasRing(afterBlur),
			JSON.stringify(afterBlur),
		);

		// D3. Move focus to another control by an explicit request and back:
		// the old gesture must not claim the return either.
		const play = page.locator('#opening-play');
		await slot.evaluate((el) => {
			el.blur();
		});
		await play.evaluate((el) => el.focus({ focusVisible: true }));
		await slot.evaluate((el) => {
			el.blur();
			el.focus({ focusVisible: true });
		});
		const returned = await styleOf(slot);
		check(
			'D3 focus away and back by explicit requests keeps the ring',
			returned.active && returned.fv && !returned.marked && hasRing(returned),
			JSON.stringify(returned),
		);

		// F. keyboard-only ring in the menu.
		await page.touchscreen.tap(5, 5);
		const menuKey = await tabUntilFocused(page);
		check(
			'F Tab shows the menu ring',
			!!menuKey && hasRing(menuKey) && !menuKey.marked,
			JSON.stringify(menuKey),
		);

		// G. dialogs: touch a field, then type on a physical keyboard.
		await page.touchscreen.tap(5, 5);
		await page.locator('#opening-options').tap();
		await page.locator('#opening-settings').waitFor({ timeout: 15000 });
		await page.locator('#opening-settings').tap();
		const email = page.locator('#settings-email');
		await email.waitFor({ timeout: 15000 });
		await email.tap();
		const emailTapped = await styleOf(email);
		const emailHighlight = await highlightOf(email);
		check(
			'G tap on a dialog field keeps no ring',
			emailTapped.marked &&
				noRing(emailTapped) &&
				transparentHighlight(emailHighlight),
			`${JSON.stringify(emailTapped)} highlight=${emailHighlight}`,
		);
		await page.keyboard.type('a');
		const emailTyped = await styleOf(email);
		check(
			'G physical typing brings the dialog ring back',
			!emailTyped.marked && hasRing(emailTyped),
			JSON.stringify(emailTyped),
		);
		await page.keyboard.press('Escape');
		await page
			.locator('#opening-settings-dialog')
			.waitFor({ state: 'hidden', timeout: 15000 });
		await page.keyboard.press('Escape');
		await page
			.locator('#opening-options-dialog')
			.waitFor({ state: 'hidden', timeout: 15000 });

		// H. match rail: the ring belongs to the keyboard, not to the finger.
		await page.locator('#opening-play').tap();
		await page.waitForFunction(
			() => {
				const el = document.querySelector('#match-resign');
				return el && !el.disabled && !el.hidden;
			},
			{ timeout: 60000 },
		);
		const resign = page.locator('#match-resign');
		const resignHighlight = await highlightOf(resign);
		await resign.evaluate((el) => el.focus({ focusVisible: true }));
		const resignExplicit = await styleOf(resign);
		check(
			'H explicit visible focus on the board rail',
			hasRing(resignExplicit) &&
				!resignExplicit.marked &&
				transparentHighlight(resignHighlight),
			`${JSON.stringify(resignExplicit)} highlight=${resignHighlight}`,
		);

		// I. result window.
		await resign.tap();
		const menuButton = page.locator('[data-result="menu"]');
		await menuButton.waitFor({ timeout: 60000 });
		const resultTap = await styleOf(menuButton);
		const resultHighlight = await highlightOf(menuButton);
		check(
			'I tap focus in the result window keeps no ring',
			noRing(resultTap) && transparentHighlight(resultHighlight),
			`${JSON.stringify(resultTap)} highlight=${resultHighlight}`,
		);
		const resultKey = await tabUntilFocused(page, 3);
		check(
			'I Tab shows the result-window ring',
			!!resultKey && hasRing(resultKey) && !resultKey.marked,
			JSON.stringify(resultKey),
		);
		await page.touchscreen.tap(5, 5);
		await menuButton.evaluate((el) => el.focus({ focusVisible: true }));
		const resultExplicit = await styleOf(menuButton);
		await page.screenshot({ path: `${OUT}/regression-result-element.png` });
		check(
			'I explicit visible focus in the result window',
			resultExplicit.active && hasRing(resultExplicit),
			JSON.stringify(resultExplicit),
		);
		// And a real finger on that result button still shows no ring.
		await page.touchscreen.tap(5, 5);
		await menuButton.tap();
		const back = await styleOf(page.locator('#opening-play'));
		check(
			'J returning by a real tap shows no ring in the menu',
			noRing(back),
			JSON.stringify(back),
		);

		// L. A dialog closed by a finger restores focus to its opener. The
		// browser carries :focus-visible over from the button that had it, so
		// the ring used to reappear on the opener under the finger (round-5
		// defect). The opener is an element the press never touched.
		{
			await page.waitForFunction(
				() =>
					document.querySelector('#match-history')?.dataset.bound === 'true',
			);
			await page.locator('#opening-history').tap();
			await page.locator('#match-history').waitFor({ timeout: 15000 });
			const inDialog = await tabUntilFocused(page, 3);
			check(
				'L history dialog Tab shows a ring',
				!!inDialog && hasRing(inDialog),
				JSON.stringify(inDialog),
			);
			await tapFocused(page);
			const opener = await styleOf(page.locator('#opening-history'));
			await page.screenshot({ path: `${OUT}/regression-history-opener.png` });
			check(
				'L a finger closing the history dialog leaves no ring on the opener',
				opener.active && noRing(opener),
				JSON.stringify(opener),
			);
		}

		// M. Same hand-off through the help dialog, which restores focus hop by
		// hop (help -> options -> menu): every hop is still one finger action.
		{
			await page.locator('#opening-options').tap();
			await page.locator('#opening-help').tap();
			await page.locator('#opening-help-dialog').waitFor({ timeout: 15000 });
			const inHelp = await tabUntilFocused(page, 3);
			check(
				'M help dialog Tab shows a ring',
				!!inHelp && hasRing(inHelp),
				JSON.stringify(inHelp),
			);
			await tapFocused(page);
			const opener = await styleOf(page.locator('#opening-help'));
			await page.screenshot({ path: `${OUT}/regression-help-opener.png` });
			check(
				'M a finger closing the help dialog leaves no ring on the opener',
				opener.active && noRing(opener),
				JSON.stringify(opener),
			);
		}
	} finally {
		await browser.close();
	}

	const failed = results.filter((r) => !r.ok);
	console.log(
		`\n${results.length - failed.length}/${results.length} checks passed`,
	);
	if (failed.length) process.exit(1);
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
