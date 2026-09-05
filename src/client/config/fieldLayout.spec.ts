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
		expect(field.originY).toBeGreaterThanOrEqual(layout.hudBar + 24);
		expect(layout.boardBottomGap).toBe(80);
		expect(layout.hudStripInset).toBe(8);
		expect(field.originY + field.fieldSize).toBe(694 - layout.boardBottomGap);
	});

	it('sizes 16:9 board with top gap for the foe clock', () => {
		const field = computeFieldLayout(1280, 720);
		const topGap = layout.hudBar + 24;
		expect(field.portrait).toBe(false);
		expect(field.originY).toBe(topGap);
		expect(field.fieldSize).toBe(720 - topGap - layout.boardBottomGap);
		expect(field.originX).toBe(Math.round((1280 - field.fieldSize) / 2));
		expect(field.originY).toBeGreaterThanOrEqual(topGap);
	});

	it('shrinks portrait field so HUD does not cover cells', () => {
		const field = computeFieldLayout(390, 400);
		expect(field.fieldSize).toBe(400 - (layout.hudBar + 24) - layout.boardBottomGap);
		expect(field.originY).toBe(layout.hudBar + 24);
		expect(field.originY + field.fieldSize).toBe(400 - layout.boardBottomGap);
	});
});

describe('formatClock', () => {
	it('formats M:SS for bullet banks', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(60)).toBe('1:00');
		expect(formatClock(75)).toBe('1:15');
	});
});
