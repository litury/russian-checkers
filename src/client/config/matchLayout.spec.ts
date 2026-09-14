import { expect, it } from 'vitest';
import { matchLayout } from './matchLayout';
it('fits centered safe-area phone, wide sides and bounded tablet fallback without overlap', () => {
	for (const [w, h, mode] of [
		[390, 844, 'top-bottom'],
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
			expect(p.x + 374 * l.panelScale).toBeLessThanOrEqual(w);
			expect(p.y + 128 * l.panelScale).toBeLessThanOrEqual(h);
			expect(
				p.x + 374 * l.panelScale <= board.x ||
					p.x >= board.x + board.w ||
					p.y + 128 * l.panelScale <= board.y ||
					p.y >= board.y + board.h,
			).toBe(true);
		}
	}
	const s = matchLayout(390, 844, { top: 44, bottom: 34, left: 0, right: 0 });
	expect(s.foe.y).toBeGreaterThanOrEqual(44);
	expect(s.you.y + 128 * s.panelScale).toBeLessThanOrEqual(810);
});
