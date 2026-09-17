import type { IMove, IPosition, ISquare, Side } from '@/rules';

export interface IBoardView {
	startOpeningHint: (position: IPosition, local: Side) => void;
	paintOpeningHint: (progress: number, reduced: boolean) => void;
	clearOpeningHint: () => void;
	sync: (
		position: IPosition,
		highlights: ISquare[],
		selected: ISquare | null,
		options?: IMove[],
		availability?: IMove[],
	) => void;
	layout: (width: number, height: number) => void;
	setFacing: (side: Side) => void;
	press: (square: ISquare) => void;
	deny: (square: ISquare) => void;
	playMove: (
		move: IMove,
		onDone: () => void,
		onLand?: (took: boolean) => void,
		onTakeoff?: (took: boolean) => void,
		/** Human hops keep all victims until the full rules move commits. */
		retainCaptured?: boolean,
	) => void;
	playFlagBurst: (square: ISquare, onDone: () => void) => void;
	reset: () => void;
	setPlayfieldVisible: (on: boolean) => void;
	setWaitingIdle: (on: boolean) => void;
	notePly: () => void;
}
