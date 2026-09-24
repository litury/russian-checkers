import { expect, it } from 'vitest';
import { clockFrameWidthPx, matchLayout } from './matchLayout';
import { computeFieldLayout } from './fieldLayout';

const boardOf = (l: ReturnType<typeof matchLayout>) => ({
	x: l.originX - 14 * l.scale,
	y: l.originY - 33 * l.scale,
	w: 380 * l.scale,
	h: 418 * l.scale,
});

/** Same numbers as cb79ba6 top-bottom, before compact HUD. */
function baselineField(w: number, h: number) {
	const original = computeFieldLayout(w, h);
	const native = Math.max(
		8,
		Math.min(
			w - 38,
			Math.floor((w * 352) / 380),
			Math.floor((h * 352) / 418),
			original.fieldSize - (original.portrait ? 0 : 66),
		),
	);
	const gap = 20;
	let panelScale = Math.min(1, (w - 16) / 374);
	let fieldSize = Math.min(
		native,
		Math.floor(((h - 24 - 256 * panelScale - 2 * gap) * 352) / 418),
	);
	if (fieldSize < 352) {
		const budget = h - 24 - 2 * gap;
		const need = Math.ceil((352 * 418) / 352);
		panelScale = Math.min(panelScale, Math.max(0.45, (budget - need) / 256));
		fieldSize = Math.min(
			native,
			Math.floor(((h - 24 - 256 * panelScale - 2 * gap) * 352) / 418),
		);
	}
	return Math.max(8, fieldSize);
}

it('fits centered safe-area phone, wide sides and bounded tablet fallback without overlap', () => {
	for (const [w, h, mode] of [
		[390, 844, 'top-bottom'],
		[1280, 720, 'sides'],
		[1024, 768, 'above'],
	] as const) {
		const l = matchLayout(w, h);
		expect(l.mode).toBe(mode);
		if (w === 1280) {
			expect(l.panelScale).toBeGreaterThanOrEqual(0.85);
			expect(l.fieldSize).toBe(506);
		}
		if (w === 390) expect(l.fieldSize).toBe(352);
		const board = boardOf(l);
		const pw = 374 * l.panelScale;
		const ph = 128 * l.panelScale;
		for (const p of [l.foe, l.you]) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeGreaterThanOrEqual(0);
			expect(p.x + pw).toBeLessThanOrEqual(w + 0.01);
			expect(p.y + ph).toBeLessThanOrEqual(h + 0.01);
			expect(
				p.x + pw <= board.x + 0.01 ||
					p.x >= board.x + board.w - 0.01 ||
					p.y + ph <= board.y + 0.01 ||
					p.y >= board.y + board.h - 0.01,
			).toBe(true);
		}
	}
	const s = matchLayout(390, 844, { top: 44, bottom: 34, left: 0, right: 0 });
	expect(s.foe.y).toBeGreaterThanOrEqual(44);
	expect(s.you.y + 128 * s.panelScale).toBeLessThanOrEqual(810);
	const r = matchLayout(390, 844, { top: 0, bottom: 64, left: 0, right: 0 });
	expect(r.fieldSize).toBe(352);
	expect(r.cell).toBe(44);
	expect(r.originY + r.fieldSize).toBeLessThanOrEqual(780);
	expect(r.you.y + 128 * r.panelScale).toBeLessThanOrEqual(780);
});

it('keeps the pre-compact field and parks timers above and below without a side column', () => {
	for (const [w, h] of [
		[390, 844],
		[360, 740],
		[320, 640],
		[844, 390],
	]) {
		const l = matchLayout(w, h);
		const board = boardOf(l);
		const pw = 374 * l.panelScale;
		const ph = 128 * l.panelScale;
		expect(l.mode).toBe('top-bottom');
		expect(l.fieldSize).toBeGreaterThanOrEqual(baselineField(w, h));
		expect(l.fieldSize).toBe(baselineField(w, h));
		expect(l.foe.y + ph).toBeLessThanOrEqual(board.y + 0.01);
		expect(l.you.y).toBeGreaterThanOrEqual(board.y + board.h - 0.01);
		expect(l.you.x).toBeCloseTo(l.foe.x);
		expect(l.foe.x + pw / 2).toBeCloseTo(w / 2, 0);
		expect(l.foe.x).toBeGreaterThanOrEqual(0);
		expect(l.foe.x + pw).toBeLessThanOrEqual(w + 0.01);
		expect(l.you.y + ph).toBeLessThanOrEqual(h + 0.01);
		expect(clockFrameWidthPx * l.panelScale).toBeLessThanOrEqual(w - 16);
		if (h > w) {
			expect(l.foe.y).toBeLessThanOrEqual(12);
			expect(l.fieldSize).toBe(w - 38);
		}
	}
	expect(matchLayout(390, 844).fieldSize).toBe(352);
	expect(matchLayout(360, 740).fieldSize).toBe(322);
	expect(matchLayout(844, 390).fieldSize).toBe(baselineField(844, 390));
});

it('fits the button lip and safe areas by shrinking timers, not the board', () => {
	for (const [w, h] of [
		[320, 640],
		[360, 740],
		[390, 844],
		[844, 390],
	]) {
		const safe = { top: 44, bottom: 34, left: 12, right: 12 };
		const l = matchLayout(w, h, safe);
		const contentW = w - safe.left - safe.right;
		const contentH = h - safe.top - safe.bottom;
		const board = boardOf(l);
		const pw = 374 * l.panelScale;
		const ph = 128 * l.panelScale;
		expect(l.fieldSize).toBeGreaterThanOrEqual(baselineField(contentW, contentH));
		expect(l.originY - 33 * l.scale).toBeGreaterThanOrEqual(safe.top);
		expect(l.you.y + ph).toBeLessThanOrEqual(h - safe.bottom + 0.01);
		expect(l.originX - 14 * l.scale).toBeGreaterThanOrEqual(safe.left - 0.01);
		expect(l.originX + l.fieldSize + 14 * l.scale).toBeLessThanOrEqual(
			w - safe.right + 0.01,
		);
		expect(l.foe.x).toBeGreaterThanOrEqual(safe.left - 0.01);
		expect(l.foe.x + pw).toBeLessThanOrEqual(w - safe.right + 0.01);
		expect(l.foe.y + ph).toBeLessThanOrEqual(board.y + 0.01);
		expect(l.you.y).toBeGreaterThanOrEqual(board.y + board.h - 0.01);
		expect(clockFrameWidthPx * l.panelScale).toBeLessThanOrEqual(contentW);
		if (h > w) expect(l.fieldSize).toBe(contentW - 38);
	}
	const lip = matchLayout(360, 740, { top: 0, bottom: 64, left: 0, right: 0 });
	expect(lip.fieldSize).toBe(baselineField(360, 676));
	expect(lip.you.y + 128 * lip.panelScale).toBeLessThanOrEqual(740 - 64 + 0.01);
});
