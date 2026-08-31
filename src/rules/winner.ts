import { legalMoves } from './legalMoves';
import { oppositeSide } from './parts/oppositeSide';
import type { IPosition } from './types/IPosition';
import type { Side } from './types/Side';

export function winner(position: IPosition): Side | null {
	if (legalMoves(position).length === 0) {
		return oppositeSide(position.turn);
	}
	return null;
}
