import { afterEach, expect, it } from 'vitest';
import { markPerf, markPerfAt, readPerf, resetPerf } from './perfMarks';

afterEach(() => resetPerf());

it('keeps the first timestamp for a repeated mark', () => {
	const first = markPerf('play-intent');
	const second = markPerf('play-intent');
	expect(second).toBe(first);
	expect(readPerf().marks['play-intent']).toBe(first);
});

it('publishes derived startup durations once both ends exist', () => {
	markPerf('play-intent');
	expect(readPerf().measures['play-intent-to-playfield-ready']).toBeUndefined();
	markPerf('playfield-ready');
	const bridge = readPerf();
	const ready = bridge.marks['playfield-ready'] ?? 0;
	const intent = bridge.marks['play-intent'] ?? 0;
	expect(bridge.measures['play-intent-to-playfield-ready']).toBeCloseTo(
		ready - intent,
		3,
	);
	expect(ready).toBeGreaterThanOrEqual(intent);
});

it('covers the approved first-match timeline', () => {
	const state = readPerf();
	for (const name of [
		'play-intent',
		'play-handled',
		'playfield-ready',
		'board-first-frame',
		'counting-in-false',
		'first-move-allowed',
		'first-move-played',
	]) {
		markPerf(name as Parameters<typeof markPerf>[0]);
	}
	const { marks, measures } = readPerf();
	expect(Object.keys(marks)).toHaveLength(7);
	for (const pair of [
		'play-input-delay',
		'play-intent-to-playfield-ready',
		'play-intent-to-board-first-frame',
		'play-intent-to-first-move-allowed',
		'play-intent-to-first-move-played',
	]) {
		expect(measures[pair]).toBeGreaterThanOrEqual(0);
	}
	expect(state.marks).toEqual({});
});

it('keeps the click instant as the intent mark so a busy thread cannot hide it', () => {
	const dispatched = performance.now() - 137;
	markPerfAt('play-intent', dispatched);
	markPerf('play-handled');
	const { marks, measures } = readPerf();
	expect(marks['play-intent']).toBeCloseTo(dispatched, 2);
	expect(measures['play-input-delay']).toBeGreaterThanOrEqual(137);
	// A repeated or invalid stamp never rewrites the recorded instant.
	markPerfAt('play-intent', 0);
	markPerfAt('play-intent', Number.NaN);
	expect(readPerf().marks['play-intent']).toBeCloseTo(dispatched, 2);
});

it('resets for a warm run without reloading the page', () => {
	markPerf('play-intent');
	resetPerf();
	expect(readPerf().marks).toEqual({});
	expect(readPerf().measures).toEqual({});
});
