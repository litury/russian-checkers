import type { IPiece } from './IPiece';
import type { Side } from './Side';

export interface DrawCounters {
	stable: Record<Side, number>;
	kingsOnly: Record<Side, number>;
	stronger: Side | null;
	strongerMoves: number;
}

export interface IPosition {
	squares: (IPiece | null)[][];
	turn: Side;
	drawCounters?: DrawCounters;
}
