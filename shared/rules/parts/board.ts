import type { IPiece } from '../types/IPiece';
import type { IPosition } from '../types/IPosition';
import type { ISquare } from '../types/ISquare';
import type { Side } from '../types/Side';

export const BOARD_SIZE = 8;

export const DIAGONALS: ISquare[] = [
	{ row: 1, col: 1 },
	{ row: 1, col: -1 },
	{ row: -1, col: 1 },
	{ row: -1, col: -1 },
];

export function inBounds(square: ISquare): boolean {
	return (
		square.row >= 0 &&
		square.row < BOARD_SIZE &&
		square.col >= 0 &&
		square.col < BOARD_SIZE
	);
}

export function isDarkSquare(square: ISquare): boolean {
	return (square.row + square.col) % 2 === 0;
}

export function isKingRow(square: ISquare, side: Side): boolean {
	return side === 'white' ? square.row === BOARD_SIZE - 1 : square.row === 0;
}

export function squareKey(square: ISquare): string {
	return `${square.row},${square.col}`;
}

export function sameSquare(a: ISquare, b: ISquare): boolean {
	return a.row === b.row && a.col === b.col;
}

export function emptyBoard(): (IPiece | null)[][] {
	return Array.from({ length: BOARD_SIZE }, () =>
		Array.from({ length: BOARD_SIZE }, () => null),
	);
}

export function clonePosition(position: IPosition): IPosition {
	return {
		turn: position.turn,
		squares: position.squares.map((row) =>
			row.map((piece) => (piece ? { ...piece } : null)),
		),
	};
}

export function getPiece(position: IPosition, square: ISquare): IPiece | null {
	if (!inBounds(square)) {
		return null;
	}
	return position.squares[square.row][square.col];
}

export function setPiece(
	position: IPosition,
	square: ISquare,
	piece: IPiece | null,
): void {
	position.squares[square.row][square.col] = piece;
}

export function isVacant(position: IPosition, square: ISquare): boolean {
	return inBounds(square) && getPiece(position, square) === null;
}

export function offset(square: ISquare, dir: ISquare, steps = 1): ISquare {
	return {
		row: square.row + dir.row * steps,
		col: square.col + dir.col * steps,
	};
}
