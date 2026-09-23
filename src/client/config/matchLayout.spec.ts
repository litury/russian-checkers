import { expect, it } from 'vitest';
import { compactHudHeight, compactPortraitTopInset, matchLayout } from './matchLayout';
it('fits centered safe-area phone, wide sides and bounded tablet fallback without overlap', () => {
	for (const [w, h, mode] of [
		[390, 844, 'compact'],
		[1280, 720, 'sides'],
		[1024, 768, 'above'],
	] as const) {
		const l = matchLayout(w, h);
		expect(l.mode).toBe(mode);
		expect(l.panelScale).toBeGreaterThanOrEqual(0.85);
		if (w === 390) expect(l.fieldSize).toBe(352);
		if (w === 1280) expect(l.fieldSize).toBe(506);
		const board = {
			x: l.originX - 14 * l.scale,
			y: l.originY - 33 * l.scale,
			w: 380 * l.scale,
			h: 418 * l.scale,
		};
		for (const p of [l.foe, l.you]) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeGreaterThanOrEqual(0);
			const pw = l.mode === 'compact' ? w - 16 : 374 * l.panelScale;
			const ph = l.mode === 'compact' ? 84 : 128 * l.panelScale;
			expect(p.x + pw).toBeLessThanOrEqual(w);
			expect(p.y + ph).toBeLessThanOrEqual(h);
			expect(
				p.x + pw <= board.x ||
					p.x >= board.x + board.w ||
					p.y + ph <= board.y ||
					p.y >= board.y + board.h,
			).toBe(true);
		}
	}
	const s = matchLayout(390, 844, { top: 44, bottom: 34, left: 0, right: 0 });
	expect(s.foe.y).toBeGreaterThanOrEqual(44);
	expect(s.you.y + 68).toBeLessThanOrEqual(810);
	const r = matchLayout(390, 844, { top: 0, bottom: 64, left: 0, right: 0 });
	expect(r.fieldSize).toBe(352);
	expect(r.cell).toBe(44);
	expect(r.originY + r.fieldSize).toBeLessThanOrEqual(780);
	expect(r.you.y + 68).toBeLessThanOrEqual(780);
});

it('keeps mobile width and maximizes landscape without interactive board overlap', () => {
	for (const [w, h, size] of [[390, 844, 352], [360, 740, 322], [320, 640, 282], [844, 390, Math.floor(230 * 352 / 418)]]) {
		const l = matchLayout(w, h);
		expect(l.mode).toBe('compact');
		expect(l.fieldSize).toBe(size);
		expect(l.cell * 8).toBe(size);
		expect(l.originY - 33 * l.scale).toBeGreaterThanOrEqual(0);
		expect(l.originY + size + 33 * l.scale + 8).toBeCloseTo(l.foe.y);
		expect(l.you.x + (w - 128)).toBeLessThanOrEqual(w - 112);
		const topGap = l.originY - 33 * l.scale;
		const bottomGap = h - (l.foe.y + compactHudHeight);
		if (h > w) {
			expect(topGap).toBeCloseTo(compactPortraitTopInset);
			expect(bottomGap).toBeGreaterThan(topGap);
		} else {
			expect(topGap).toBeCloseTo(bottomGap);
			expect(topGap).toBeGreaterThanOrEqual(8);
		}
	}
});

it('fits nonzero safe areas and keeps portrait squares at their width limit', () => {
	for (const [w, h] of [[320, 640], [360, 740], [390, 844], [844, 390]]) {
		const safe = { top: 44, bottom: 34, left: 12, right: 12 };
		const l = matchLayout(w, h, safe);
		expect(l.originY - 33 * l.scale).toBeGreaterThanOrEqual(safe.top + 8);
		expect(l.foe.y + compactHudHeight).toBeLessThanOrEqual(h - safe.bottom - 8);
		expect(l.originX - 14 * l.scale).toBeGreaterThanOrEqual(safe.left);
		expect(l.originX + l.fieldSize + 14 * l.scale).toBeLessThanOrEqual(w - safe.right);
		if (h > w) expect(l.fieldSize).toBe(w - safe.left - safe.right - 38);
	}
});
