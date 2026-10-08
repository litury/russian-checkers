import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import css from './hangingChronicle.css?raw';
import gates from './openingGates.css?raw';
import html from '../../../index.html?raw';

/**
 * The steel button frame is a raster stretched to the button box (`background-size:100% 100%`),
 * so every horizontal line of the frame scales with the button height. The fractions below are
 * measured on the accepted `ui/siege/button-steel-rest.png` (736x295): the opaque silhouette
 * spans rows 29..254, the recessed stone plate spans rows 61..216.
 */
const RASTER_HEIGHT = 295;
const FRAME_EDGE_TOP = 29 / RASTER_HEIGHT;
const FRAME_EDGE_BOTTOM = 254 / RASTER_HEIGHT;
const PLATE_TOP = 61 / RASTER_HEIGHT;
const PLATE_BOTTOM = 216 / RASTER_HEIGHT;

const BASE_HEIGHT = Number(css.match(/--btn-h:(\d+)px/)![1]);
const NAME_SIZE = Number(css.match(/opening-cta-label\{font-size:calc\(var\(--btn-h\) \* ([.\d]+)\)/)![1]);
const ONLINE_PAD_TOP = Number(css.match(/opening-online\{flex-direction:[^}]*padding-top:calc\(var\(--btn-h\) \* ([.\d]+)\)/)![1]);

function readPng(path: string) {
	const data = readFileSync(path);
	let pos = 8;
	let width = 0;
	let height = 0;
	const idat: Buffer[] = [];
	while (pos < data.length) {
		const length = data.readUInt32BE(pos);
		const type = data.toString('ascii', pos + 4, pos + 8);
		const chunk = data.subarray(pos + 8, pos + 8 + length);
		pos += 12 + length;
		if (type === 'IHDR') {
			width = chunk.readUInt32BE(0);
			height = chunk.readUInt32BE(4);
		} else if (type === 'IDAT') idat.push(chunk);
		else if (type === 'IEND') break;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const rows: Buffer[] = [];
	let i = 0;
	const stride = width * 4;
	let prev = Buffer.alloc(stride);
	for (let y = 0; y < height; y++) {
		const filt = raw[i++];
		const row = Buffer.from(raw.subarray(i, i + stride));
		i += stride;
		if (filt === 1) for (let x = 0; x < stride; x++) row[x] = (row[x] + (x >= 4 ? row[x - 4] : 0)) & 255;
		else if (filt === 2) for (let x = 0; x < stride; x++) row[x] = (row[x] + prev[x]) & 255;
		else if (filt === 3) for (let x = 0; x < stride; x++) row[x] = (row[x] + (((x >= 4 ? row[x - 4] : 0) + prev[x]) >> 1)) & 255;
		else if (filt === 4) for (let x = 0; x < stride; x++) {
			const a = x >= 4 ? row[x - 4] : 0;
			const b = prev[x];
			const c = x >= 4 ? prev[x - 4] : 0;
			const p = a + b - c;
			const pa = Math.abs(p - a);
			const pb = Math.abs(p - b);
			const pc = Math.abs(p - c);
			row[x] = (row[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
		}
		rows.push(row);
		prev = row;
	}
	return { width, height, rows };
}

it('gives all four menu buttons one height token and one fluid width token', () => {
	expect(BASE_HEIGHT).toBeGreaterThanOrEqual(44); // touch-target floor from the task
	expect(css).toContain('--btn-w:min(clamp(177px,33vw,320px),calc((100vw - 36px)/2))');
	expect(css).toContain('){width:var(--btn-w);height:var(--btn-h);');
	expect(css).toContain('left:calc(50% - var(--btn-w) - 6px)');
	expect(css).toContain('left:calc(50% + 6px)');
	// Utility buttons must not carry a height of their own any more: that is what made the
	// four buttons differ in the first place.
	for (const rule of css.matchAll(/#opening :is\(#opening-history,#opening-options\)\{([^}]*)\}/g))
		expect(rule[1]).not.toContain('height:');
	// Row pitch and the error status both follow the shared token, so a taller button cannot
	// run into the row below or into #opening-status.
	expect(css).toContain('top:calc(var(--play-y) + var(--btn-h) + 4px)');
	expect(css).toContain('top:calc(var(--play-y) + 2 * var(--btn-h) + 12px)');
});

it('keeps the single online label inside the recessed plate with a >=6px rim gap', () => {
	const labelHeight = BASE_HEIGHT * (NAME_SIZE * 1.15);
	const top = BASE_HEIGHT * ONLINE_PAD_TOP;
	const above = top - BASE_HEIGHT * PLATE_TOP;
	const below = BASE_HEIGHT * PLATE_BOTTOM - (top + labelHeight);
	expect(above).toBeGreaterThanOrEqual(6);
	expect(below).toBeGreaterThanOrEqual(6);
	// Centred on the plate, so both rim gaps stay equal as the frame scales.
	expect(Math.abs(above - below)).toBeLessThanOrEqual(0.5);
	// Shrinking the button must not break the clearance: the frame fraction is linear in height.
	for (const shortHeight of [56, 52]) {
		const shortTop = shortHeight * ONLINE_PAD_TOP;
		const shortAbove = shortTop - shortHeight * PLATE_TOP;
		const shortBelow = shortHeight * PLATE_BOTTOM - (shortTop + shortHeight * NAME_SIZE * 1.15);
		expect(shortAbove).toBeGreaterThanOrEqual(6);
		expect(shortBelow).toBeGreaterThanOrEqual(6);
	}
});

it('gives the online button one label only: no live dot, no second badge line', () => {
	expect(css).toContain('#opening #opening-online{flex-direction:column;');
	expect(css).toContain('white-space:nowrap');
	expect(css).not.toContain('opening-live-badge');
	expect(css).not.toContain('opening-live-dot');
});

it('keeps the online button name without a number and puts the count inside the search screen', () => {
	const button = html.match(/<button id="opening-online"[\s\S]*?<\/button>/)![0];
	expect(button).toContain('opening-cta-label');
	expect(button).toContain('В сети');
	expect(button).not.toMatch(/opening-live|opening-online-count/);
	const search = html.match(/<div id="opening-search"[\s\S]*?<div id="opening-search-actions">/)![0];
	// Заголовок стоит на спрайт-пластине главного названия, счёт — отдельная строка под ней.
	expect(search).toMatch(/<div class="opening-search-title">\s*<img class="opening-search-plate" src="\/src\/client\/app\/ui\/delivery\/cassette-title-560\.webp"[^>]*\/>\s*<p id="opening-search-copy"[^>]*>[^<]*<\/p>\s*<\/div>\s*<p id="opening-online-count"[^>]*hidden><\/p>/);
});

it('keeps the search card and its buttons at the main geometry while the count row appears', () => {
	// The count row belongs to the card but must not resize it (task acceptance: card and buttons
	// keep the geometry of main). The header reserves the row in every presence state and the row
	// itself is taken out of flow, right under the heading: measured on 390x844 and 1440x900 the
	// card stays 366x283 / 430x307 and the action row keeps --btn-h.
	expect(gates).toMatch(/#opening-search \{ position:absolute[^}]*width:min\(430px,calc\(100% - 24px\)\)[^}]*padding:calc\(var\(--frame-corner\) \+ 4px\) calc\(var\(--frame-corner\) \+ 2px\);/);
	expect(gates).not.toContain('scrollbar-width:none');
	expect(gates).not.toMatch(/#opening-search::-webkit-scrollbar \{ width:0/);
	// Short desktop keeps the fourth plate inside the chronicle cap without shrinking the boxes.
	expect(gates).toMatch(/@media \(max-height:860px\) and \(min-width:454px\) \{\s*#opening-search \{ padding-top:var\(--frame-corner\); padding-bottom:var\(--frame-corner\); \}/);
	expect(gates).toContain('.opening-search-title { width:min(40%,120px); }');
	expect(gates).toMatch(/#opening-search-head \{ position:relative; margin:0 0 20px; \}/);
	expect(gates).toMatch(/#opening-online-count \{ position:absolute; top:100%; left:0; right:0;/);
	expect(gates).toMatch(/#opening-online-count\[hidden\] \{ display:none; \}/);
	expect(gates).toContain("border-image:url('./ui/siege/panel-revision2/frame.webp') 180 / var(--frame-corner) / 0 stretch;");
	expect(gates).toMatch(/#opening-search-actions button \{[^}]*height:var\(--btn-h\);/);
	// Плашки поиска держат прежний flex и свою пластину под коробку. Телефонное меню остаётся на старой.
	expect(gates).toContain("background:transparent url('./ui/siege/button-steel-rest.webp') center/100% 100% no-repeat;");
	expect(gates).toMatch(/#opening-search-actions button \{[^}]*flex:1 1 calc\(33\.333% - 7px\)/);
	expect(gates).toMatch(/#opening-search-actions button \{[^}]*center\/contain no-repeat/);
	expect(gates).not.toMatch(/#opening-search-actions button \{[^}]*100% 100%/);
	expect(gates).not.toMatch(/#opening-search-actions button \{[^}]*736 \/ 295/);
	expect(gates).toContain("url('./ui/siege/button-steel-search-98-rest.webp')");
	expect(gates).toContain("url('./ui/siege/button-steel-search-314-rest.webp')");
	expect(gates).toContain("url('./ui/siege/button-steel-search-366-rest.webp')");
	expect(gates).toContain("url('./ui/siege/button-steel-search-378-rest.webp')");
	expect(gates).toContain("url('./ui/siege/button-steel-search-184-rest.webp')");
	expect(gates).toContain("url('./ui/siege/button-steel-search-119-rest.webp')");
	const mid = gates.slice(gates.indexOf("@media (min-width:454px)"), gates.indexOf("@media (min-width:700px)"));
	expect(mid).toContain("button-steel-search-378-rest.webp");
	expect(mid).toContain("button-steel-search-184-rest.webp");
	expect(mid).toContain("button-steel-search-119-rest.webp");
	expect(mid).not.toContain("button-steel-search-314-rest.webp");
	expect(gates).toContain('background-size:contain');
	// `contain` is measured from the background positioning area, and that must be the border
	// box: with the default padding-box it is fitted to the padded content area, which is
	// smaller than the measured box, so the box edges show through. Guards the padding-box bug.
	expect(gates).toMatch(/#opening-search-actions button \{[^}]*background-origin:border-box; background-clip:border-box;/);
	expect(gates).toMatch(/background-size:contain;\s*background-origin:border-box; background-clip:border-box;/);
	expect(gates).not.toMatch(/#opening-search-actions button \{[^}]*background-origin:padding-box/);
	expect(gates).toContain("background-image:url('./ui/siege/button-steel-pressed.webp')");
	// Короткие экраны: карточка не закрывает соседние половины «Летописи»/«Битв» и не прячет их.
	// Она ограничена по высоте свободным местом над их верхом и прокручивается внутри.
	expect(gates).toMatch(/#opening-search \{[^}]*max-height:calc\(100% - var\(--play-y\) - var\(--piece\) - 182px\)/);
	expect(gates).not.toMatch(/chronicle-half\s*\{[^}]*visibility:hidden/);
	// The row sits between the heading plate and the buttons in the DOM, so a screen reader reads it
	// as plain text of the card rather than as part of the menu button.
	const panel = html.match(/<div id="opening-search"[\s\S]*?<button id="opening-retry"/)![0];
	expect(panel).toMatch(
		/<p id="opening-search-copy"[^>]*>[^<]*<\/p>\s*<\/div>\s*<p id="opening-online-count"[^>]*hidden><\/p>\s*<\/div>\s*<div id="opening-search-actions">/,
	);
});

function readWebp(path: string) {
	const data = readFileSync(path);
	expect(data.toString('ascii', 0, 4)).toBe('RIFF');
	expect(data.toString('ascii', 8, 12)).toBe('WEBP');
	const tag = data.toString('ascii', 12, 16);
	if (tag === 'VP8 ') {
		// Lossy keyframe: 3-byte frame tag, the 0x9d012a start code, then two 14-bit sizes.
		expect(data[23]).toBe(0x9d);
		expect(data[24]).toBe(0x01);
		expect(data[25]).toBe(0x2a);
		return { width: data[26] | ((data[27] & 0x3f) << 8), height: data[28] | ((data[29] & 0x3f) << 8), hasAlpha: false };
	}
	if (tag === 'VP8X') {
		return {
			width: 1 + (data[24] | (data[25] << 8) | (data[26] << 16)),
			height: 1 + (data[27] | (data[28] << 8) | (data[29] << 16)),
			hasAlpha: (data[20] & 0x10) !== 0,
		};
	}
	throw new Error(`unexpected webp chunk ${tag}`);
}

/**
 * A plate closes the box only when it was drawn for that box: `contain` fits the whole drawing
 * into the border box, so the drawing's own aspect must be the measured box aspect and the
 * gives the contained raster the measured box aspect. Generated end hardware has native alpha
 * around its silhouette, rather than a baked opaque black rectangle; test all five states.
 */
it('gives search and desktop plates the measured aspect and native alpha in all five states', () => {
	// Measured boxes (px at --btn-h:70): search at 390 is 314/152/98, at 600 (card
	// capped, frame-corner still 24) it is 378/184/119.33, at 700+ it is
	// 366/178/115.33; the desktop menu is 320.
	const boxes: [string, number][] = [
		['button-steel-search-98', 98],
		['button-steel-search-152', 152],
		['button-steel-search-314', 314],
		['button-steel-search-119', 119.33],
		['button-steel-search-184', 184],
		['button-steel-search-378', 378],
		['button-steel-search-115', 115.33],
		['button-steel-search-178', 178],
		['button-steel-search-366', 366],
		['button-steel-desk', 320],
	];
	for (const [stem, boxWidth] of boxes) {
		for (const state of ['rest', 'hover', 'pressed', 'focus', 'disabled']) {
			const url = new URL(`./ui/siege/${stem}-${state}.webp`, import.meta.url);
			const size = readWebp(fileURLToPath(url));
			// Generated complete silhouettes use native alpha instead of an opaque black box.
			expect(size.hasAlpha, `${stem}-${state} preserves native alpha`).toBe(true);
			// 1% off the box aspect already leaves a visible band on a 70px button.
			expect(Math.abs(size.width / size.height - boxWidth / BASE_HEIGHT)).toBeLessThan(0.01);
		}
	}
	// The desktop menu rule (>=970px) fits its own 320x70 plate with contain, to the border box.
	expect(gates).toMatch(
		/#opening :is\(#opening-play,#opening-online,#opening-retry,#opening-history,#opening-options\) \{\s*background-image:url\('\.\/ui\/siege\/button-steel-desk-rest\.webp'\);[^}]*background-size:contain;\s*background-origin:border-box; background-clip:border-box;/,
	);
});

it('keeps the accepted steel raster geometry the frame fractions were read from', () => {
	const png = readPng(fileURLToPath(new URL('./ui/siege/button-steel-rest.png', import.meta.url)));
	expect(png.width).toBe(736);
	expect(png.height).toBe(RASTER_HEIGHT);
	const centre = Math.floor(png.width / 2);
	let first = -1;
	let last = -1;
	for (let y = 0; y < png.height; y++) {
		if (png.rows[y][centre * 4 + 3] > 10) {
			if (first < 0) first = y;
			last = y;
		}
	}
	expect(first).toBe(29);
	expect(last).toBe(254);
	expect(Math.floor(FRAME_EDGE_TOP * RASTER_HEIGHT)).toBe(29);
	expect(Math.floor(FRAME_EDGE_BOTTOM * RASTER_HEIGHT)).toBe(254);
});
