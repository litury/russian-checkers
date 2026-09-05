import { blitzStartMs, remainingMs, type Side } from '@/rules';

export type MatchClockPhase = 'title' | 'human' | 'bot' | 'over';

export function remainingForHud(opts: {
	countingIn: boolean;
	phase: MatchClockPhase;
	bankMs: number;
	startedAt: number;
	now: number;
	paused: boolean;
	side: Side;
	turn: Side;
}): number {
	if (opts.phase === 'title' || opts.countingIn) {
		return blitzStartMs;
	}
	if (opts.phase === 'over' || opts.paused || opts.side !== opts.turn) {
		return opts.bankMs;
	}
	return remainingMs(opts.bankMs, opts.startedAt, opts.now, false);
}
