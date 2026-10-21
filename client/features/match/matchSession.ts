import type { HapticKind } from '@/client/platform/browser/haptics';

import { hashPosition } from '@/shared/protocol/matchState';
import {
	apply,
	createInitialPosition,
	type IMove,
	type IPosition,
	type ISquare,
	resultSide,
	type Side,
} from '@/shared/rules';
import type { StepwiseMove } from './stepwiseMove';

interface PlayedMove extends IMove {
	side: Side;
}
export type MatchPhase = 'title' | 'human' | 'bot' | 'over';
export interface MatchOutcome {
	winner: Side | 'draw';
	humanSide: Side;
	reason: string;
	online: boolean;
}
const transitions: Record<MatchPhase, readonly MatchPhase[]> = {
	title: ['human', 'bot', 'over'],
	human: ['bot', 'over', 'title'],
	bot: ['human', 'over', 'title'],
	over: ['human', 'bot', 'title'],
};
export class MatchSession {
	humanSide: Side = 'white';
	position: IPosition = createInitialPosition();
	selected: ISquare | null = null;
	humanChain: StepwiseMove | null = null;
	paused = false;
	moving = false;
	flagLock = false;
	countingIn = false;
	online = false;
	resultGen = 0;
	acceptedResult: MatchOutcome | null = null;
	resultPresented = false;
	botUndoGen = 0;
	restoringBotUndo = false;
	pendingHaptic: { move: IMove; kind: HapticKind; ply: number } | null = null;
	matchPlies: PlayedMove[] = [];
	posKeys: string[] = [];
	botUndoStack: {
		position: IPosition;
		clocks: { white: number; black: number };
		plies: PlayedMove[];
		keys: string[];
	}[] = [];
	resultKind = 'rules';
	private currentPhase: MatchPhase = 'title';
	preview = false;
	get phase(): MatchPhase {
		return this.currentPhase;
	}
	set phase(next: MatchPhase) {
		if (
			next !== this.currentPhase &&
			!transitions[this.currentPhase].includes(next)
		)
			throw new Error(
				'Invalid match transition ' + this.currentPhase + ' → ' + next,
			);
		this.currentPhase = next;
	}
	commit(move: IMove): boolean {
		const mover = this.position.turn;
		const next = apply(this.position, move);
		if (!next) return false;
		this.matchPlies.push({ side: mover, from: move.from, path: move.path });
		this.position = next;
		this.posKeys.push(hashPosition(next));
		this.selected = null;
		this.humanChain = null;
		return true;
	}
	outcome() {
		return resultSide(this.position, this.posKeys);
	}
	saveUndo(clocks: Record<Side, number>): void {
		if (this.online) return;
		this.botUndoStack.push({
			position: structuredClone(this.position),
			clocks: { ...clocks },
			plies: this.matchPlies.slice(),
			keys: this.posKeys.slice(),
		});
	}
	restoreUndo(): Record<Side, number> | null {
		if (this.online) return null;
		const snapshot = this.botUndoStack.pop();
		if (!snapshot) return null;
		this.position = snapshot.position;
		this.matchPlies = snapshot.plies.slice();
		this.posKeys = snapshot.keys.slice();
		this.selected = null;
		this.humanChain = null;
		this.flagLock = false;
		this.phase = this.position.turn === this.humanSide ? 'human' : 'bot';
		return { ...snapshot.clocks };
	}
}
