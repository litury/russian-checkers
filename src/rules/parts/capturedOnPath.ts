import type { IPosition } from '../types/IPosition';
import type { ISquare } from '../types/ISquare';
import { getPiece, inBounds, sameSquare } from './board';

export function squaresBetween(from: ISquare, to: ISquare): ISquare[] | null {
	const rowDelta = to.row - from.row;
	const colDelta = to.col - from.col;
	if (rowDelta === 0 || colDelta === 0) {
		return null;
	}
	if (Math.abs(rowDelta) !== Math.abs(colDelta)) {
		return null;
	}
	const steps = Math.abs(rowDelta);
	const dir = {
		row: Math.sign(rowDelta),
		col: Math.sign(colDelta),
	};
	const between: ISquare[] = [];
	for (let i = 1; i < steps; i += 1) {
		const square = {
			row: from.row + dir.row * i,
			col: from.col + dir.col * i,
		};
		if (!inBounds(square)) {
			return null;
		}
		between.push(square);
	}
	return between;
}

export function capturedOnSegment(
	position: IPosition,
	from: ISquare,
	to: ISquare,
): ISquare | null {
	const between = squaresBetween(from, to);
	if (!between) {
		return null;
	}
	const occupied = between.filter((square) => getPiece(position, square));
	if (occupied.length !== 1) {
		return null;
	}
	const piece = getPiece(position, occupied[0]);
	if (!piece || piece.side === position.turn) {
		return null;
	}
	if (sameSquare(occupied[0], from) || sameSquare(occupied[0], to)) {
		return null;
	}
	return occupied[0];
}
