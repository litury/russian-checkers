import { describe, expect, it } from 'vitest';
import { computeFieldLayout, formatClock } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';

describe('computeFieldLayout', () => {
	it('pins 9:16 board to canvas minus 14 and leaves HUD clear', () => {
		const field = computeFieldLayout(390, 694);
		expect(field.portrait).toBe(true);
		expect(field.fieldSize).toBe(390);
		expect(field.originX).toBe(0);
		expect(field.originY).toBe(290);
		expect(field.cell).toBeCloseTo(48.75);
		expect(field.cell).toBeGreaterThanOrEqual(layout.minCellPx);
		expect(field.originY).toBeGreaterThanOrEqual(layout.hudBar);
		expect(field.originY + field.fieldSize).toBe(694 - layout.boardBottomGap);
	});

	it('pins 390x844 board to canvas minus 14 with HUD 44 clear', () => {
		const field = computeFieldLayout(390, 844);
		expect(field.portrait).toBe(true);
		expect(field.fieldSize).toBe(390);
		expect(field.originX).toBe(0);
		expect(field.originY).toBe(440);
		expect(field.originY).toBeGreaterThanOrEqual(layout.hudBar);
		expect(field.originY + field.fieldSize).toBe(844 - layout.boardBottomGap);
	});
	it('sizes 16:9 board by height and keeps side gutters', () => {
		const field = computeFieldLayout(1280, 720);
		expect(field.portrait).toBe(false);
		expect(field.fieldSize).toBe(720);
		expect(field.originX).toBe(280);
		expect(field.originY).toBe(0);
		expect(field.cell).toBe(90);
		expect(1280 - field.originX - field.fieldSize).toBe(280);
	});

	it('shrinks portrait field so HUD does not cover cells', () => {
		const field = computeFieldLayout(390, 400);
		expect(field.fieldSize).toBe(400 - layout.hudBar - layout.boardBottomGap);
		expect(field.originY).toBe(layout.hudBar);
		expect(field.originY + field.fieldSize).toBe(400 - layout.boardBottomGap);
	});
});

describe('formatClock', () => {
	it('formats mm:ss from zero', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(75)).toBe('1:15');
	});
});
