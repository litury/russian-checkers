import { expect, it } from 'vitest';
import { apply, legalMoves, type IPosition } from '@/rules';
import { StepwiseMove } from './stepwiseMove';
const sq = (s: string) => ({ row: +s[1] - 1, col: s.charCodeAt(0) - 97 });
function position(pieces: Record<string, string>): IPosition {
	const p: IPosition = {
		turn: 'white',
		squares: Array.from({ length: 8 }, () => Array(8).fill(null)),
	};
	for (const [s, piece] of Object.entries(pieces)) {
		const a = sq(s);
		p.squares[a.row][a.col] = {
			side: piece[0] === 'w' ? 'white' : 'black',
			kind: piece[1] === 'k' ? 'king' : 'man',
		};
	}
	return p;
}
it('reveals only next hops, preserves branches and commits no partial position', () => {
	const p = position({ c3: 'w', d4: 'b', f4: 'b', f6: 'b' });
	const chain = new StepwiseMove(p, sq('c3'));
	expect(chain.options).toEqual([{ from: sq('c3'), path: [sq('e5')] }]);
	expect(chain.choose(sq('g7'))).toBeNull();
	const first = chain.choose(sq('e5'))!;
	expect(first.hop).toEqual({ from: sq('c3'), path: [sq('e5')] });
	expect(first.complete).toBeNull();
	expect(chain.selected).toEqual(sq('e5'));
	expect(chain.options.map((m) => m.path[0])).toEqual(
		expect.arrayContaining([sq('g3'), sq('g7')]),
	);
	expect(chain.options).toHaveLength(2);
	expect(chain.visualPosition.turn).toBe('white');
	expect(chain.visualPosition.squares[3][3]?.side).toBe('black');
	expect(chain.visualPosition.squares[4][4]?.side).toBe('white');
	expect(p.squares[2][2]?.side).toBe('white');
	expect(chain.choose(sq('c3'))).toBeNull();
	const last = chain.choose(sq('g3'))!;
	expect(last.complete).toEqual({ from: sq('c3'), path: [sq('e5'), sq('g3')] });
	expect(legalMoves(p)).toContainEqual(last.complete);
});

it('promotes on the intermediate king row without lifting captured blockers or allowing recapture', () => {
	const p = position({ c6: 'w', d7: 'b', f7: 'b' });
	const chain = new StepwiseMove(p, sq('c6'));
	expect(chain.choose(sq('e8'))?.complete).toBeNull();
	expect(chain.visualPosition.squares[7][4]?.kind).toBe('king');
	expect(chain.visualPosition.squares[6][3]?.side).toBe('black');
	expect(chain.choose(sq('c6'))).toBeNull();
	expect(chain.options.map((m) => m.path[0])).toEqual(
		expect.arrayContaining([sq('g6'), sq('h5')]),
	);
	const move = chain.choose(sq('h5'))!.complete!;
	expect(apply(p, move)?.squares[4][7]).toEqual({
		side: 'white',
		kind: 'king',
	});
});

it('keeps full visual continuations of the chosen branch, including the vacated origin', () => {
	const p = position({ c3: 'w', d4: 'b', f4: 'b', f2: 'b', d2: 'b' });
	const chain = new StepwiseMove(p, sq('c3'));
	expect(chain.remainingRoutes).toEqual(legalMoves(p));
	chain.choose(sq('e5'));
	expect(chain.remainingRoutes).toEqual([
		{ from: sq('e5'), path: ['g3', 'e1', 'c3'].map(sq) },
	]);
	expect(chain.options).toEqual([{ from: sq('e5'), path: [sq('g3')] }]);
	expect(chain.choose(sq('e1'))).toBeNull();
	expect(chain.remainingRoutes[0].path).toHaveLength(3);
});

it('keeps distinct routes to the same endpoint selectable, including returning to the origin', () => {
	const p = position({ c3: 'w', d4: 'b', f4: 'b', f2: 'b', d2: 'b' });
	for (const names of [
		['e5', 'g3', 'e1', 'c3'],
		['e1', 'g3', 'e5', 'c3'],
	]) {
		const chain = new StepwiseMove(p, sq('c3'));
		for (const [i, n] of names.entries()) {
			const step = chain.choose(sq(n))!;
			expect(step).not.toBeNull();
			expect(Boolean(step.complete)).toBe(i === names.length - 1);
			if (step.complete)
				expect(apply(p, step.complete)?.squares[2][2]?.side).toBe('white');
		}
	}
});
