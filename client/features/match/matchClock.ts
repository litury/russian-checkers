import type { MatchSnapshot } from '@/shared/protocol/matchState';
import {
	afterMoveBank,
	blitzStartMs,
	remainingMs,
	type Side,
} from '@/shared/rules';
import { remainingForHud } from './hud/matchClock';
import type { MatchPhase } from './matchSession';
export class MatchClock {
	banks: Record<Side, number> = { white: blitzStartMs, black: blitzStartMs };
	startedAt = 0;
	remotePaused = false;
	remaining(
		side: Side,
		now: number,
		state: {
			phase: MatchPhase;
			countingIn: boolean;
			paused: boolean;
			turn: Side;
		},
	): number {
		return remainingForHud({
			...state,
			side,
			bankMs: this.banks[side],
			startedAt: this.startedAt,
			now,
			paused: state.paused || this.remotePaused,
		});
	}
	settle(side: Side, now: number, paused: boolean): void {
		this.banks[side] = afterMoveBank(
			remainingMs(this.banks[side], this.startedAt, now, paused),
		);
		this.startedAt = now;
	}
	applySnapshot(
		clocks: NonNullable<MatchSnapshot['clocks']>,
		now: number,
	): void {
		this.banks = { ...clocks.banks };
		this.remotePaused = clocks.paused;
		this.startedAt = this.remotePaused
			? now
			: now - Math.max(0, clocks.serverNow - clocks.turnStarted);
	}
}
