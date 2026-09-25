import { afterEach, expect, it } from 'vitest';
import { readPerf, resetPerf } from './perfMarks';
import { notePlayIntent, playIntentEvent } from './playIntent';

afterEach(() => resetPerf());

it('keeps the press instant when the engine replays an HTML-captured stamp', async () => {
	const pressed = performance.now();
	await new Promise((resolve) => setTimeout(resolve, 5));
	notePlayIntent(playIntentEvent(pressed));
	const { marks, measures } = readPerf();
	expect(marks['play-intent']).toBeCloseTo(pressed, 2);
	expect(marks['play-handled']).toBeGreaterThan(pressed);
	// The wait for the engine stays visible instead of collapsing to zero.
	expect(measures['play-input-delay']).toBeGreaterThanOrEqual(4);
});

it('falls back to the handler moment when no press instant was stored', () => {
	notePlayIntent(undefined);
	const { marks, measures } = readPerf();
	expect(marks['play-intent']).toBeGreaterThanOrEqual(0);
	expect(measures['play-input-delay']).toBeGreaterThanOrEqual(0);
});

it('refuses a stamp that is not a real past instant', () => {
	expect(playIntentEvent(null)).toBeUndefined();
	expect(playIntentEvent(undefined)).toBeUndefined();
	expect(playIntentEvent(Number.NaN)).toBeUndefined();
	expect(playIntentEvent(Number.POSITIVE_INFINITY)).toBeUndefined();
	expect(playIntentEvent(-1)).toBeUndefined();
	// A bad stamp must not fabricate a press: the handler moment is used instead.
	notePlayIntent(playIntentEvent(Number.NaN));
	expect(readPerf().marks['play-intent']).toBeGreaterThanOrEqual(0);
});

it('forwards the stored instant unchanged', () => {
	expect(playIntentEvent(137)?.timeStamp).toBe(137);
	expect(playIntentEvent(0)?.timeStamp).toBe(0);
});
