import { describe, expect, it } from 'vitest';
import {
	clockHudLayout,
	computeFieldLayout,
	formatClock,
	hudClockEH,
	hudClockEWellNativeX,
	hudClockEWellNativeY,
	hudClockEW,
	hudClockSafeInset,
} from '@/client/config/fieldLayout';
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

describe('clockHudLayout', () => {
	it('keeps portrait clocks at the top with screen inset and 44pt hit', () => {
		const field = computeFieldLayout(390, 694);
		const clocks = clockHudLayout(390, 694, field);
		expect(hudClockEW).toBe(112);
		expect(hudClockEH).toBe(70);
		expect(hudClockSafeInset).toBeGreaterThanOrEqual(16);
		expect(clocks.foe.x).toBe(hudClockSafeInset);
		expect(clocks.you.x).toBe(390 - hudClockSafeInset);
		expect(clocks.foe.y).toBe(field.originY);
		expect(clocks.you.y).toBe(field.originY);
		expect(clocks.foe.originX).toBe(0);
		expect(clocks.foe.originY).toBe(1);
		expect(clocks.you.originX).toBe(1);
		expect(clocks.you.originY).toBe(1);
		expect(hudClockEWellNativeX).toBe(40);
		expect(hudClockEWellNativeY).toBe(26);
	});

	it('puts landscape clocks on the sides of the board', () => {
		const field = computeFieldLayout(1280, 720);
		const clocks = clockHudLayout(1280, 720, field);
		const midY = field.originY + field.fieldSize / 2;
		expect(clocks.foe.x).toBeLessThan(field.originX);
		expect(clocks.you.x).toBeGreaterThan(field.originX + field.fieldSize);
		expect(clocks.foe.y).toBe(midY);
		expect(clocks.you.y).toBe(midY);
		expect(clocks.foe.originX).toBe(1);
		expect(clocks.you.originX).toBe(0);
	});
});

describe('formatClock', () => {
	it('formats whole seconds for a 60s bank', () => {
		expect(formatClock(0)).toBe('0');
		expect(formatClock(60)).toBe('60');
		expect(formatClock(7)).toBe('7');
	});
});
