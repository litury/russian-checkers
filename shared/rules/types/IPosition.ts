import type { IPiece } from './IPiece';
import type { Side } from './Side';

export interface IPosition {
	squares: (IPiece | null)[][];
	turn: Side;
}
