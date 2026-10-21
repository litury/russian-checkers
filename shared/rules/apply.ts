import { legalMoves } from './legalMoves';
import { clonePosition, getPiece, isKingRow, setPiece } from './parts/board';
import { capturedOnSegment } from './parts/capturedOnPath';
import { moveKey } from './parts/moveKey';
import { oppositeSide } from './parts/oppositeSide';
import type { IMove } from './types/IMove';
import type { IPosition } from './types/IPosition';
import type { ISquare } from './types/ISquare';

export function apply(position: IPosition, move: IMove): IPosition | null {
	const isLegal = legalMoves(position).some(
		(candidate) => moveKey(candidate) === moveKey(move),
	);
	if (!isLegal) {
		return null;
	}
	const next = clonePosition(position);
	const piece = getPiece(next, move.from);
	if (!piece) {
		return null;
	}
	setPiece(next, move.from, null);
	const captured: ISquare[] = [];
	let current = move.from;
	let kind = piece.kind;
	for (const land of move.path) {
		const over = capturedOnSegment(next, current, land);
		if (over) {
			captured.push(over);
		}
		current = land;
		if (kind === 'man' && isKingRow(land, piece.side)) {
			kind = 'king';
		}
	}
	for (const square of captured) {
		setPiece(next, square, null);
	}
	setPiece(next, current, { side: piece.side, kind });
	next.turn = oppositeSide(position.turn);
	return next;
}
