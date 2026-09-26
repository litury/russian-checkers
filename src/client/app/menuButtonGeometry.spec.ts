import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import css from './hangingChronicle.css?raw';

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
const BADGE_SIZE = Number(css.match(/opening-live-badge\{position:static;font-size:calc\(var\(--btn-h\) \* ([.\d]+)\)/)![1]);
const ONLINE_GAP = Number(css.match(/opening-online\{flex-direction:[^}]*gap:calc\(var\(--btn-h\) \* ([.\d]+)\)/)![1]);
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

it('keeps the online label inside the recessed plate with a >=6px gap above the inner rim', () => {
	const content = BASE_HEIGHT * (NAME_SIZE * 1.15 + ONLINE_GAP + BADGE_SIZE);
	const top = BASE_HEIGHT * ONLINE_PAD_TOP;
	const clearance = BASE_HEIGHT * PLATE_BOTTOM - (top + content);
	expect(top).toBeGreaterThanOrEqual(BASE_HEIGHT * PLATE_TOP - 0.5);
	expect(clearance).toBeGreaterThanOrEqual(6);
	// Shrinking the button must not break the clearance: the frame fraction is linear in height.
	const shortHeight = 56;
	const shortClearance = shortHeight * (PLATE_BOTTOM - ONLINE_PAD_TOP) - shortHeight * (NAME_SIZE * 1.15 + ONLINE_GAP + BADGE_SIZE);
	expect(shortClearance).toBeGreaterThanOrEqual(6);
});

it('lays the online label out as two lines inside the frame instead of an absolute badge', () => {
	expect(css).toContain('#opening #opening-online{flex-direction:column;');
	expect(css).toContain('opening-live-badge{position:static;');
	expect(css).not.toContain('opening-live-badge{position:absolute');
	expect(css).toContain('white-space:nowrap');
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
