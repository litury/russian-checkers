import { expect, it } from 'vitest';
import { clockFrameAlphas, clockFrameStep, clockFrameWanted } from './clockFrame';

it('stays off while bunker doors still opening or preparing', () => {
	expect(clockFrameWanted(0, 112, true, false)).toBe(false);
	expect(clockFrameWanted(181, 0, true, true)).toBe(false);
	expect(clockFrameWanted(181, 0, false, false)).toBe(false);
	expect(clockFrameWanted(181, 0, true, false)).toBe(true);
});

it('enters and leaves without overshoot; reduced snaps', () => {
	expect(clockFrameStep(0, true, 210, false)).toBe(0.5);
	expect(clockFrameStep(1, false, 160, false)).toBe(0.5);
	expect(clockFrameStep(0.2, true, 0, true)).toBe(1);
	expect(clockFrameStep(0.8, false, 0, true)).toBe(0);
});

it('crossfades metal then amber; reduced uses static amber only', () => {
	expect(clockFrameAlphas(0.2, false, 1).metal).toBeGreaterThan(
		clockFrameAlphas(0.2, false, 1).amber,
	);
	expect(clockFrameAlphas(1, false, 0.8)).toEqual({
		metal: 1,
		amber: 1,
		lights: 0.8,
	});
	expect(clockFrameAlphas(1, true, 0.8)).toEqual({
		metal: 0,
		amber: 1,
		lights: 0,
	});
});
