import type { MatchSnapshot } from '@/shared/protocol/matchState';
import {
	afterMoveBank,
	blitzStartMs,
	remainingMs,
	type Side,
} from '@/shared/rules';
import { remainingForHud } from './hud/matchClock';
import type { MatchPhase } from './matchSession';
import {
	defaultTimeControl,
	timeControls,
	type TimeControlId,
} from '@/shared/rules/timeControl';
export class MatchClock {
	timeControl: TimeControlId = defaultTimeControl;
	banks: Record<Side, number> = { white: blitzStartMs, black: blitzStartMs };
	completedAt: number | null = null;
	reset(timeControl: TimeControlId): void {
		this.timeControl = timeControl;
		const initialMs = timeControls[timeControl].initialMs;
		this.banks = { white: initialMs, black: initialMs };
		this.startedAt = 0;
		this.completedAt = null;
		this.remotePaused = false;
	}
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
			now: this.completedAt ?? now,
			paused: state.paused || this.remotePaused,
		});
	}
	settle(side: Side, now: number, paused: boolean): void {
		this.banks[side] = afterMoveBank(
			remainingMs(this.banks[side], this.startedAt, this.completedAt ?? now, paused),
			timeControls[this.timeControl].incrementMs,
		);
		this.startedAt = now;
		this.completedAt = null;
	}
	applySnapshot(
		clocks: NonNullable<MatchSnapshot['clocks']>,
		now: number,
	): void {
		this.timeControl = clocks.timeControl ?? '1+0';
		this.completedAt = null;
		this.banks = { ...clocks.banks };
		this.remotePaused = clocks.paused;
		this.startedAt = this.remotePaused
			? now
			: now - Math.max(0, clocks.serverNow - clocks.turnStarted);
	}
}
