import type { IMove } from '../types/IMove';
import type { IPiece } from '../types/IPiece';
import type { IPosition } from '../types/IPosition';
import type { ISquare } from '../types/ISquare';
import {
	BOARD_SIZE,
	clonePosition,
	DIAGONALS,
	getPiece,
	inBounds,
	isKingRow,
	isVacant,
	offset,
	setPiece,
	squareKey,
} from './board';

export function collectCaptureMoves(position: IPosition): IMove[] {
	const moves: IMove[] = [];
	for (let row = 0; row < BOARD_SIZE; row += 1) {
		for (let col = 0; col < BOARD_SIZE; col += 1) {
			const from = { row, col };
			const piece = getPiece(position, from);
			if (!piece || piece.side !== position.turn) {
				continue;
			}
			const lifted = clonePosition(position);
			setPiece(lifted, from, null);
			searchCaptures(lifted, from, from, piece, new Set(), [], moves);
		}
	}
	return moves;
}

function searchCaptures(
	position: IPosition,
	origin: ISquare,
	at: ISquare,
	piece: IPiece,
	captured: Set<string>,
	path: ISquare[],
	moves: IMove[],
): void {
	const options = captureOptions(position, at, piece, captured);
	if (options.length === 0) {
		if (path.length > 0) {
			moves.push({ from: origin, path: [...path] });
		}
		return;
	}
	for (const step of options) {
		const nextCaptured = new Set(captured);
		nextCaptured.add(squareKey(step.over));
		const nextPiece =
			piece.kind === 'man' && isKingRow(step.land, piece.side)
				? { ...piece, kind: 'king' as const }
				: piece;
		searchCaptures(
			position,
			origin,
			step.land,
			nextPiece,
			nextCaptured,
			[...path, step.land],
			moves,
		);
	}
}

function captureOptions(
	position: IPosition,
	at: ISquare,
	piece: IPiece,
	captured: Set<string>,
): { over: ISquare; land: ISquare }[] {
	if (piece.kind === 'man') {
		return manCaptureOptions(position, at, piece, captured);
	}
	return kingCaptureOptions(position, at, piece, captured);
}

function manCaptureOptions(
	position: IPosition,
	at: ISquare,
	piece: IPiece,
	captured: Set<string>,
): { over: ISquare; land: ISquare }[] {
	const options: { over: ISquare; land: ISquare }[] = [];
	for (const dir of DIAGONALS) {
		const over = offset(at, dir);
		const land = offset(at, dir, 2);
		if (!inBounds(over) || !inBounds(land)) {
			continue;
		}
		if (!isEnemy(position, over, piece.side, captured)) {
			continue;
		}
		if (!isVacant(position, land)) {
			continue;
		}
		options.push({ over, land });
	}
	return options;
}

function kingCaptureOptions(
	position: IPosition,
	at: ISquare,
	piece: IPiece,
	captured: Set<string>,
): { over: ISquare; land: ISquare }[] {
	const options: { over: ISquare; land: ISquare }[] = [];
	for (const dir of DIAGONALS) {
		let steps = 1;
		while (true) {
			const scan = offset(at, dir, steps);
			if (!inBounds(scan)) {
				break;
			}
			const occupant = getPiece(position, scan);
			if (!occupant) {
				steps += 1;
				continue;
			}
			if (occupant.side === piece.side) {
				break;
			}
			if (captured.has(squareKey(scan))) {
				break;
			}
			let landSteps = steps + 1;
			while (true) {
				const land = offset(at, dir, landSteps);
				if (!inBounds(land) || !isVacant(position, land)) {
					break;
				}
				options.push({ over: scan, land });
				landSteps += 1;
			}
			break;
		}
	}
	return options;
}

function isEnemy(
	position: IPosition,
	square: ISquare,
	side: IPiece['side'],
	captured: Set<string>,
): boolean {
	const piece = getPiece(position, square);
	if (!piece || piece.side === side) {
		return false;
	}
	return !captured.has(squareKey(square));
}
