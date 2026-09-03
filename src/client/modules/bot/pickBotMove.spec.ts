import { describe, expect, it } from 'vitest';
import type { IPiece, IPosition } from '@/rules';
import { apply, createInitialPosition, legalMoves } from '@/rules';
import { pickBotMove } from './pickBotMove';

function emptySquares(): (IPiece | null)[][] {
	return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

describe('pickBotMove', () => {
	it('picks a legal move uniformly from the starting position', () => {
		const start = createInitialPosition();
		const moves = legalMoves(start);
		const picked = pickBotMove(start, () => 0);
		expect(picked).toBeDefined();
		if (!picked) {
			return;
		}
		expect(picked).toEqual(moves[0]);
		expect(apply(start, picked)).not.toBeNull();
	});

	it('only considers captures when a capture exists', () => {
		const squares = emptySquares();
		squares[2][2] = { side: 'black', kind: 'man' };
		squares[3][3] = { side: 'white', kind: 'man' };
		const position: IPosition = { squares, turn: 'black' };
		const picked = pickBotMove(position, () => 0);
		expect(picked).toEqual({
			from: { row: 2, col: 2 },
			path: [{ row: 4, col: 4 }],
		});
		if (!picked) {
			return;
		}
		expect(apply(position, picked)).not.toBeNull();
	});

	it('stays in range when random returns 1', () => {
		const start = createInitialPosition();
		const moves = legalMoves(start);
		const picked = pickBotMove(start, () => 1);
		expect(picked).toEqual(moves[moves.length - 1]);
		if (!picked) {
			return;
		}
		expect(apply(start, picked)).not.toBeNull();
	});

	it('never returns a move that apply rejects over a random game', () => {
		let pos = createInitialPosition();
		let x = 1;
		const random = (): number => {
			x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
			return x / 2 ** 32;
		};
		for (let ply = 0; ply < 200; ply += 1) {
			const moves = legalMoves(pos);
			if (moves.length === 0) {
				expect(pickBotMove(pos, random)).toBeUndefined();
				break;
			}
			const picked = pickBotMove(pos, random);
			expect(picked).toBeDefined();
			if (!picked) {
				return;
			}
			expect(moves).toContainEqual(picked);
			const next = apply(pos, picked);
			expect(next).not.toBeNull();
			if (!next) {
				return;
			}
			pos = next;
		}
	});
});
