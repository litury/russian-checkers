import { describe, expect, it } from 'vitest';
import { blitzStartMs } from '@/rules';
import { remainingForHud } from './matchClock';

describe('remainingForHud', () => {
	it('holds the opening bank until countdown ends, then ticks at once', () => {
		expect(
			remainingForHud({
				countingIn: true,
				phase: 'human',
				bankMs: blitzStartMs,
				startedAt: 0,
				now: 4_000,
				paused: false,
				side: 'white',
				turn: 'white',
			}),
		).toBe(blitzStartMs);
		expect(
			remainingForHud({
				countingIn: false,
				phase: 'human',
				bankMs: blitzStartMs,
				startedAt: 2_800,
				now: 4_800,
				paused: false,
				side: 'white',
				turn: 'white',
			}),
		).toBe(58_000);
	});
});
