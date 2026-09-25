import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import type Phaser from 'phaser';
import { boardFrame } from './boardCoords';
import { drawReliquaryMarker } from './reliquaryMarkers';
import markers from './reliquaryMarkers.ts?raw';
import board from './createReliquaryBoardView.ts?raw';
import scene from '@/client/app/gameScene.ts?raw';

const LIGHT_SQUARE = 157;
const DARK_SQUARE = 79;

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
		if (filt === 1) {
			for (let x = 0; x < stride; x++) row[x] = (row[x] + (x >= 4 ? row[x - 4] : 0)) & 255;
		} else if (filt === 2) {
			for (let x = 0; x < stride; x++) row[x] = (row[x] + prev[x]) & 255;
		} else if (filt === 3) {
			for (let x = 0; x < stride; x++) {
				const left = x >= 4 ? row[x - 4] : 0;
				row[x] = (row[x] + ((left + prev[x]) >> 1)) & 255;
			}
		} else if (filt === 4) {
			for (let x = 0; x < stride; x++) {
				const a = x >= 4 ? row[x - 4] : 0;
				const b = prev[x];
				const c = x >= 4 ? prev[x - 4] : 0;
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
				row[x] = (row[x] + pr) & 255;
			}
		}
		rows.push(row);
		prev = row;
	}
	return { width, height, rows };
}

function lum(px: Buffer): number {
	return (px[0] * 3 + px[1] * 4 + px[2]) / 8;
}

function rel(value: number): number {
	const s = value / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function ratio(a: number, b: number): number {
	const L1 = rel(Math.max(a, b));
	const L2 = rel(Math.min(a, b));
	return (L1 + 0.05) / (L2 + 0.05);
}

it('keeps a light opaque staple, wider dark backing, four corners, no frame and no ring', () => {
	const png = readPng(fileURLToPath(new URL('./markers/staples.png', import.meta.url)));
	expect(png.width).toBe(176);
	expect(png.height).toBe(176);
	const opaque: boolean[][] = Array.from({ length: png.height }, () => Array(png.width).fill(false));
	for (let y = 0; y < png.height; y++) {
		for (let x = 0; x < png.width; x++) opaque[y][x] = png.rows[y][x * 4 + 3] > 40;
	}
	const seen = opaque.map(row => row.map(() => false));
	const comps: { x: number; y: number }[][] = [];
	for (let y = 0; y < png.height; y++) {
		for (let x = 0; x < png.width; x++) {
			if (!opaque[y][x] || seen[y][x]) continue;
			const cells: { x: number; y: number }[] = [];
			const stack = [[x, y]];
			seen[y][x] = true;
			while (stack.length) {
				const [cx, cy] = stack.pop()!;
				cells.push({ x: cx, y: cy });
				for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
					if (nx < 0 || ny < 0 || nx >= png.width || ny >= png.height) continue;
					if (!opaque[ny][nx] || seen[ny][nx]) continue;
					seen[ny][nx] = true;
					stack.push([nx, ny]);
				}
			}
			comps.push(cells);
		}
	}
	expect(comps).toHaveLength(4);
	const quadrants = new Set(comps.map(cells => {
		const cx = cells.reduce((s, p) => s + p.x, 0) / cells.length;
		const cy = cells.reduce((s, p) => s + p.y, 0) / cells.length;
		return `${cx < png.width / 2 ? 'L' : 'R'}${cy < png.height / 2 ? 'T' : 'B'}`;
	}));
	expect(quadrants).toEqual(new Set(['LT', 'RT', 'LB', 'RB']));
	let center = 0;
	for (let y = Math.floor(png.height * 0.3); y < png.height * 0.7; y++) {
		for (let x = Math.floor(png.width * 0.3); x < png.width * 0.7; x++) {
			if (png.rows[y][x * 4 + 3] > 40) center++;
		}
	}
	expect(center).toBe(0);
	for (const [x0, y0, x1, y1] of [
		[png.width / 2 - 4, 0, png.width / 2 + 4, 8],
		[png.width / 2 - 4, png.height - 8, png.width / 2 + 4, png.height],
		[0, png.height / 2 - 4, 8, png.height / 2 + 4],
		[png.width - 8, png.height / 2 - 4, png.width, png.height / 2 + 4],
	]) {
		let edge = 0;
		for (let y = y0; y < y1; y++) {
			for (let x = x0; x < x1; x++) if (png.rows[y][x * 4 + 3] > 40) edge++;
		}
		expect(edge).toBe(0);
	}
	for (const cells of comps) {
		const light: number[] = [];
		const dark: number[] = [];
		for (const p of cells) {
			const px = png.rows[p.y].subarray(p.x * 4, p.x * 4 + 4);
			const L = lum(px);
			if (px[3] >= 250 && L > 170) light.push(L);
			if (px[3] > 200 && L < 80) dark.push(L);
		}
		const lightMean = light.reduce((s, n) => s + n, 0) / light.length;
		const darkMean = dark.reduce((s, n) => s + n, 0) / dark.length;
		expect(light.length).toBeGreaterThan(80);
		expect(lightMean).toBeGreaterThan(190);
		expect(dark.length).toBeGreaterThan(light.length);
		expect(darkMean).toBeLessThan(70);
		expect(ratio(lightMean, DARK_SQUARE)).toBeGreaterThan(3);
		expect(ratio(darkMean, LIGHT_SQUARE)).toBeGreaterThan(3);
	}
});

it('does not hang vector staples or circles under the sprite, and does not grow the board frame', () => {
	const styles: number[][] = [];
	const g = {
		lineStyle: (...v: number[]) => styles.push(v),
		beginPath() {},
		moveTo() {},
		lineTo() {},
		strokePath() {},
		fillStyle() {},
		fillEllipse() { throw new Error('circle layer'); },
	};
	for (const state of ['available', 'selected', 'target', 'move', 'landing', 'futureLanding'] as const)
		drawReliquaryMarker(g as unknown as Phaser.GameObjects.Graphics, { x: 22, y: 22, w: 44, h: 44 }, state);
	expect(styles).toEqual([]);
	expect(markers).not.toContain('fillEllipse');
	expect(board).toContain('MARKER_STAPLES');
	expect(board).toContain('placeArrow');
	expect(board).toContain('planMoveMarks');
	expect(board).not.toContain('placeCircle');
	expect(board).not.toContain('MARKER_CIRCLE');
	expect(board).not.toContain('circle-amber');
	expect(board).not.toContain('move.path[0]');
	expect(board).not.toContain('fillEllipse');
	expect(board).not.toContain("paint(land, victim ? 'landing' : 'move')");
	expect(board).not.toContain('selectionV2Frame');
	expect(board).not.toContain('selectionReady');
	expect((board.match(/setTint/g) ?? []).length).toBe(1);
	expect(scene).toContain("this.load.image('marker_staples'");
	expect(scene).toContain("this.load.image('marker_staples_amber'");
	expect(scene).toContain("this.load.image('marker_arrow_amber'");
	expect(scene).toContain("this.load.image('marker_arrow_copper'");
	expect(scene).not.toContain("this.load.image('marker_circle_amber'");
	expect(scene).not.toContain("this.load.image('marker_circle_copper'");
	expect(scene).not.toContain("this.load.image('marker_arrow',");
	expect(boardFrame).toEqual({ width: 380, height: 418, field: 352, padX: 14, padTop: 33 });
});

it('recolors only the light metal of the same bracket and arrow', () => {
	const soleSame = (painted: string, source: string) => {
		const next = readPng(fileURLToPath(new URL(painted, import.meta.url)));
		const prev = readPng(fileURLToPath(new URL(source, import.meta.url)));
		let same = 0;
		let total = 0;
		for (let y = 0; y < prev.height; y++) {
			for (let x = 0; x < prev.width; x++) {
				const a = prev.rows[y].subarray(x * 4, x * 4 + 4);
				const b = next.rows[y].subarray(x * 4, x * 4 + 4);
				if (a[3] > 200 && lum(a) < 110) {
					total++;
					if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]) same++;
				}
			}
		}
		expect(total).toBeGreaterThan(100);
		expect(same).toBe(total);
	};
	for (const file of ['./markers/staples-amber.png', './markers/staples-copper.png'])
		soleSame(file, './markers/staples.png');
	for (const file of ['./markers/arrow-amber.png', './markers/arrow-copper.png'])
		soleSame(file, './markers/arrow.png');
});
