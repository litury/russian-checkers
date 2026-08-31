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
	});
});
