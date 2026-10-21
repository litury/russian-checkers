import { collectCaptureMoves } from './parts/findCaptures';
import { collectQuietMoves } from './parts/findQuietMoves';
import type { IMove } from './types/IMove';
import type { IPosition } from './types/IPosition';

export function legalMoves(position: IPosition): IMove[] {
	const captures = collectCaptureMoves(position);
	if (captures.length > 0) {
		return captures;
	}
	return collectQuietMoves(position);
}
