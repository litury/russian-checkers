import { describe, expect, it } from 'vitest';
import { computeFieldLayout, formatClock } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';

describe('computeFieldLayout', () => {
	it('pins 9:16 board above the action moat and leaves HUD clear', () => {
		const field = computeFieldLayout(390, 694);
		expect(field.portrait).toBe(true);
		expect(field.fieldSize).toBe(390);
		expect(field.originX).toBe(0);
		expect(field.originY).toBe(224);
		expect(field.cell).toBeCloseTo(48.75);
		expect(field.cell).toBeGreaterThanOrEqual(layout.minCellPx);
		expect(field.originY).toBeGreaterThanOrEqual(layout.hudBar);
		expect(layout.boardBottomGap).toBe(80);
		expect(layout.hudStripInset).toBe(8);
		expect(field.originY + field.fieldSize).toBe(694 - layout.boardBottomGap);
	});

	it('sizes 16:9 board by height minus the action strip and keeps side gutters', () => {
		const field = computeFieldLayout(1280, 720);
		expect(field.portrait).toBe(false);
		expect(field.fieldSize).toBe(640);
		expect(field.originX).toBe(320);
		expect(field.originY).toBe(0);
		expect(field.cell).toBe(80);
		expect(1280 - field.originX - field.fieldSize).toBe(320);
		expect(720 - field.fieldSize).toBe(layout.boardBottomGap);
	});

	it('shrinks portrait field so HUD does not cover cells', () => {
		const field = computeFieldLayout(390, 400);
		expect(field.fieldSize).toBe(400 - layout.hudBar - layout.boardBottomGap);
		expect(field.originY).toBe(layout.hudBar);
		expect(field.originY + field.fieldSize).toBe(400 - layout.boardBottomGap);
	});
});

describe('formatClock', () => {
	it('shows a large shot-clock second', () => {
		expect(formatClock(0)).toBe('0');
		expect(formatClock(5)).toBe('5');
		expect(formatClock(1.2)).toBe('1');
	});
});
