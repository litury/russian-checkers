import { describe, expect, it } from 'vitest';
import { apply } from './apply';
import {
	afterFlagBank,
	afterMoveBank,
	blitzHoldMs,
	blitzStartMs,
	countdownBeats,
	explodeFlag,
	ownPieceSquares,
	remainingMs,
} from './blitz';
import { createInitialPosition } from './createInitialPosition';
import { legalMoves } from './legalMoves';
import { emptyBoard, getPiece, inBounds } from './parts/board';
import type { IMove } from './types/IMove';
import type { IPiece } from './types/IPiece';
import type { IPosition } from './types/IPosition';
import type { ISquare } from './types/ISquare';
import type { Side } from './types/Side';
import { winner } from './winner';

function sq(row: number, col: number): ISquare {
	return { row, col };
}

function man(side: Side): IPiece {
	return { side, kind: 'man' };
}

function king(side: Side): IPiece {
	return { side, kind: 'king' };
}

function position(turn: Side, placements: Array<[ISquare, IPiece]>): IPosition {
	const squares = emptyBoard();
	for (const [square, piece] of placements) {
		squares[square.row][square.col] = piece;
	}
	return { squares, turn };
}

function lastSquare(move: IMove): ISquare {
	return move.path[move.path.length - 1];
}

function hasMove(moves: IMove[], from: ISquare, path: ISquare[]): boolean {
	return moves.some(
		(move) =>
			move.from.row === from.row &&
			move.from.col === from.col &&
			move.path.length === path.length &&
			move.path.every(
				(square, index) =>
					square.row === path[index].row && square.col === path[index].col,
			),
	);
}

function isCapture(move: IMove): boolean {
	const rowDelta = Math.abs(lastSquare(move).row - move.from.row);
	return rowDelta >= 2 || move.path.length > 1;
}

describe('createInitialPosition', () => {
	it('places 12 men per side on dark squares with white to move', () => {
		const start = createInitialPosition();
		let white = 0;
		let black = 0;
		for (let row = 0; row < 8; row += 1) {
			for (let col = 0; col < 8; col += 1) {
				const piece = start.squares[row][col];
				if (!piece) {
					continue;
				}
				expect((row + col) % 2).toBe(0);
				if (piece.side === 'white') {
					white += 1;
					expect(row).toBeLessThanOrEqual(2);
				} else {
					black += 1;
					expect(row).toBeGreaterThanOrEqual(5);
				}
				expect(piece.kind).toBe('man');
			}
		}
		expect(white).toBe(12);
		expect(black).toBe(12);
		expect(start.turn).toBe('white');
	});
});

describe('legalMoves', () => {
	it('closes quiet moves when a capture exists (mandatory capture)', () => {
		const pos = position('white', [
			[sq(2, 2), man('white')],
			[sq(3, 3), man('black')],
		]);
		const moves = legalMoves(pos);
		expect(moves.length).toBeGreaterThan(0);
		expect(moves.every(isCapture)).toBe(true);
		expect(hasMove(moves, sq(2, 2), [sq(4, 4)])).toBe(true);
		expect(hasMove(moves, sq(2, 2), [sq(3, 1)])).toBe(false);
	});

	it('allows a man to capture backward', () => {
		const pos = position('white', [
			[sq(4, 4), man('white')],
			[sq(3, 3), man('black')],
		]);
		const moves = legalMoves(pos);
		expect(hasMove(moves, sq(4, 4), [sq(2, 2)])).toBe(true);
	});

	it('lets a flying king capture across empty squares and choose a landing', () => {
		const pos = position('white', [
			[sq(0, 0), king('white')],
			[sq(3, 3), man('black')],
		]);
		const moves = legalMoves(pos);
		expect(hasMove(moves, sq(0, 0), [sq(4, 4)])).toBe(true);
		expect(hasMove(moves, sq(0, 0), [sq(5, 5)])).toBe(true);
		expect(hasMove(moves, sq(0, 0), [sq(7, 7)])).toBe(true);
		expect(hasMove(moves, sq(0, 0), [sq(2, 2)])).toBe(false);
	});

	it('does not jump the same piece twice (turkish strike)', () => {
		const pos = position('white', [
			[sq(0, 0), king('white')],
			[sq(2, 2), man('black')],
		]);
		const moves = legalMoves(pos);
		expect(moves.every((move) => move.path.length === 1)).toBe(true);
		expect(
			moves.some((move) =>
				move.path.some((square, index) => {
					if (index === 0) {
						return false;
					}
					return square.row === 4 && square.col === 4;
				}),
			),
		).toBe(false);
		for (const move of moves) {
			const keys = move.path.map((square) => `${square.row},${square.col}`);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it('keeps the captured man as a blocker so the king cannot bounce back', () => {
		const pos = position('white', [
			[sq(0, 0), king('white')],
			[sq(2, 2), man('black')],
		]);
		const moves = legalMoves(pos);
		expect(hasMove(moves, sq(0, 0), [sq(3, 3)])).toBe(true);
		expect(hasMove(moves, sq(0, 0), [sq(4, 4), sq(0, 0)])).toBe(false);
		expect(hasMove(moves, sq(0, 0), [sq(4, 4), sq(1, 1)])).toBe(false);
	});

	it('allows a man a quiet step only forward', () => {
		const pos = position('white', [[sq(4, 4), man('white')]]);
		const moves = legalMoves(pos);
		expect(hasMove(moves, sq(4, 4), [sq(5, 3)])).toBe(true);
		expect(hasMove(moves, sq(4, 4), [sq(5, 5)])).toBe(true);
		expect(hasMove(moves, sq(4, 4), [sq(3, 3)])).toBe(false);
		expect(hasMove(moves, sq(4, 4), [sq(3, 5)])).toBe(false);
	});

	it('lets a king slide any open distance on a diagonal', () => {
		const pos = position('white', [[sq(0, 0), king('white')]]);
		const moves = legalMoves(pos);
		expect(hasMove(moves, sq(0, 0), [sq(1, 1)])).toBe(true);
		expect(hasMove(moves, sq(0, 0), [sq(7, 7)])).toBe(true);
	});

	it('does not fly through two adjacent enemies', () => {
		const pos = position('white', [
			[sq(0, 0), king('white')],
			[sq(2, 2), man('black')],
			[sq(3, 3), man('black')],
		]);
		const moves = legalMoves(pos);
		expect(hasMove(moves, sq(0, 0), [sq(4, 4)])).toBe(false);
		expect(hasMove(moves, sq(0, 0), [sq(1, 1)])).toBe(true);
	});

	it('offers every complete capture branch, not only the longest', () => {
		const pos = position('white', [
			[sq(2, 2), man('white')],
			[sq(3, 3), man('black')],
			[sq(3, 5), man('black')],
			[sq(5, 5), man('black')],
		]);
		const moves = legalMoves(pos);
		expect(hasMove(moves, sq(2, 2), [sq(4, 4)])).toBe(false);
		expect(hasMove(moves, sq(2, 2), [sq(4, 4), sq(2, 6)])).toBe(true);
		expect(hasMove(moves, sq(2, 2), [sq(4, 4), sq(6, 6)])).toBe(true);
	});

	it('never emits squares outside the board', () => {
		const start = createInitialPosition();
		for (const move of legalMoves(start)) {
			expect(inBounds(move.from)).toBe(true);
			for (const square of move.path) {
				expect(inBounds(square)).toBe(true);
			}
		}
		const edge = position('white', [
			[sq(0, 0), man('white')],
			[sq(1, 1), man('black')],
		]);
		for (const move of legalMoves(edge)) {
			expect(inBounds(move.from)).toBe(true);
			for (const square of move.path) {
				expect(inBounds(square)).toBe(true);
			}
		}
	});
});

describe('apply', () => {
	it('removes captured pieces only after the whole series', () => {
		const pos = position('white', [
			[sq(2, 2), man('white')],
			[sq(3, 3), man('black')],
			[sq(3, 5), man('black')],
		]);
		const move: IMove = { from: sq(2, 2), path: [sq(4, 4), sq(2, 6)] };
		expect(hasMove(legalMoves(pos), move.from, move.path)).toBe(true);
		const next = apply(pos, move);
		expect(next).not.toBeNull();
		if (!next) {
			return;
		}
		expect(getPiece(next, sq(3, 3))).toBeNull();
		expect(getPiece(next, sq(3, 5))).toBeNull();
		expect(getPiece(next, sq(2, 2))).toBeNull();
		expect(getPiece(next, sq(4, 4))).toBeNull();
		expect(getPiece(next, sq(2, 6))).toEqual(man('white'));
		expect(next.turn).toBe('black');
	});

	it('promotes a man mid-series and continues as a king', () => {
		const pos = position('white', [
			[sq(5, 2), man('white')],
			[sq(6, 3), man('black')],
			[sq(6, 5), man('black')],
		]);
		const move: IMove = { from: sq(5, 2), path: [sq(7, 4), sq(5, 6)] };
		expect(hasMove(legalMoves(pos), move.from, move.path)).toBe(true);
		const next = apply(pos, move);
		expect(next).not.toBeNull();
		if (!next) {
			return;
		}
		expect(getPiece(next, sq(6, 3))).toBeNull();
		expect(getPiece(next, sq(6, 5))).toBeNull();
		expect(getPiece(next, sq(5, 6))).toEqual(king('white'));
	});

	it('rejects an illegal quiet move when a capture exists', () => {
		const pos = position('white', [
			[sq(2, 2), man('white')],
			[sq(3, 3), man('black')],
		]);
		const illegal: IMove = { from: sq(2, 2), path: [sq(3, 1)] };
		expect(apply(pos, illegal)).toBeNull();
		expect(getPiece(pos, sq(2, 2))).toEqual(man('white'));
		expect(getPiece(pos, sq(3, 3))).toEqual(man('black'));
	});

	it('rejects moving from an empty square', () => {
		const pos = createInitialPosition();
		expect(apply(pos, { from: sq(4, 4), path: [sq(5, 5)] })).toBeNull();
	});

	it('does not mutate the input position', () => {
		const pos = position('white', [
			[sq(2, 2), man('white')],
			[sq(3, 3), man('black')],
		]);
		const snapshot = structuredClone(pos);
		const move: IMove = { from: sq(2, 2), path: [sq(4, 4)] };
		const next = apply(pos, move);
		expect(next).not.toBeNull();
		expect(pos).toEqual(snapshot);
		expect(getPiece(pos, sq(2, 2))).toEqual(man('white'));
		expect(getPiece(pos, sq(3, 3))).toEqual(man('black'));
	});

	it('promotes a quiet man that lands on the king row', () => {
		const pos = position('white', [[sq(6, 2), man('white')]]);
		const move: IMove = { from: sq(6, 2), path: [sq(7, 1)] };
		expect(hasMove(legalMoves(pos), move.from, move.path)).toBe(true);
		const next = apply(pos, move);
		expect(next).not.toBeNull();
		if (!next) {
			return;
		}
		expect(getPiece(next, sq(7, 1))).toEqual(king('white'));
		expect(getPiece(next, sq(6, 2))).toBeNull();
	});
});

describe('bounds', () => {
	it('reads out-of-bounds squares as empty, not a throw', () => {
		const pos = createInitialPosition();
		expect(getPiece(pos, sq(-1, 0))).toBeNull();
		expect(getPiece(pos, sq(0, -1))).toBeNull();
		expect(getPiece(pos, sq(8, 0))).toBeNull();
		expect(getPiece(pos, sq(0, 8))).toBeNull();
		expect(inBounds(sq(-1, 3))).toBe(false);
		expect(inBounds(sq(3, 8))).toBe(false);
	});
});

describe('winner', () => {
	it('awards the win when the side to move has no pieces', () => {
		const pos = position('black', [[sq(2, 2), man('white')]]);
		expect(winner(pos)).toBe('white');
	});

	it('awards the win when the side to move has no legal move', () => {
		const pos = position('black', [
			[sq(0, 0), man('black')],
			[sq(1, 1), man('white')],
			[sq(2, 2), man('white')],
		]);
		expect(legalMoves(pos)).toEqual([]);
		expect(winner(pos)).toBe('white');
	});

	it('returns null while both sides can still move', () => {
		expect(winner(createInitialPosition())).toBeNull();
	});
});

describe('bullet 1+0', () => {
	it('gives each side 1:00, hold 3s, then bank, no increment', () => {
		expect(blitzStartMs).toBe(60_000);
		expect(blitzHoldMs).toBe(3_000);
		expect(afterMoveBank(45_000)).toBe(45_000);
		expect(remainingMs(60_000, 0, 2_000, false)).toBe(60_000);
		expect(remainingMs(60_000, 0, 4_000, false)).toBe(59_000);
		expect(remainingMs(60_000, 10_000, 12_000, true)).toBe(60_000);
		expect(countdownBeats).toEqual(['3', '2', '1', 'ГО']);
	});

	it('explodes a random own piece and keeps the same turn', () => {
		const pos = position('white', [
			[sq(2, 2), man('white')],
			[sq(2, 4), man('white')],
			[sq(5, 5), man('black')],
		]);
		const { next, victim } = explodeFlag(pos, () => 0);
		expect(victim).toEqual(sq(2, 2));
		expect(getPiece(next, sq(2, 2))).toBeNull();
		expect(getPiece(next, sq(2, 4))?.side).toBe('white');
		expect(next.turn).toBe('white');
		expect(ownPieceSquares(next, 'white')).toHaveLength(1);
	});

	it('does not instantly lose while a piece remains', () => {
		const pos = position('white', [
			[sq(2, 2), man('white')],
			[sq(2, 4), man('white')],
			[sq(5, 5), man('black')],
		]);
		const { next } = explodeFlag(pos, () => 0);
		expect(winner(next)).toBeNull();
	});
});
