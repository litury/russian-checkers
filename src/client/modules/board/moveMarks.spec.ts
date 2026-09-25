import { describe, expect, it } from 'vitest';
import type { IPosition, ISquare } from '@/rules';
import { planMoveMarks } from './moveMarks';

const empty = (): IPosition['squares'] =>
	Array.from({ length: 8 }, () => Array(8).fill(null));

function position(
	pieces: [ISquare, 'man' | 'king', 'white' | 'black'][],
): IPosition {
	const squares = empty();
	for (const [square, kind, side] of pieces)
		squares[square.row][square.col] = { kind, side };
	return { squares, turn: 'white' };
}

const at = (row: number, col: number): ISquare => ({ row, col });

describe('planMoveMarks', () => {
	it('puts an amber circle on every quiet king landing, and one arrow per diagonal', () => {
		const from = at(2, 2);
		const plan = planMoveMarks(position([[from, 'king', 'white']]), [
			{ from, path: [at(3, 3)] },
			{ from, path: [at(4, 4)] },
			{ from, path: [at(5, 5)] },
			{ from, path: [at(3, 1)] },
		]);
		expect(plan.circles).toEqual([
			{ square: at(3, 3), tone: 'amber' },
			{ square: at(4, 4), tone: 'amber' },
			{ square: at(5, 5), tone: 'amber' },
			{ square: at(3, 1), tone: 'amber' },
		]);
		expect(plan.arrows).toHaveLength(2);
		expect(plan.arrows.every((arrow) => arrow.tone === 'amber')).toBe(true);
		expect(plan.victims).toEqual([]);
	});

	it('marks every capture landing, including cells after path[0], in copper', () => {
		const from = at(2, 2);
		const victim = at(3, 3);
		const next = at(5, 5);
		const plan = planMoveMarks(
			position([
				[from, 'king', 'white'],
				[victim, 'man', 'black'],
				[next, 'man', 'black'],
			]),
			[
				{ from, path: [at(4, 4), at(6, 6)] },
				{ from, path: [at(5, 5)] },
			],
		);
		expect(plan.circles).toEqual([
			{ square: at(4, 4), tone: 'copper' },
			{ square: at(6, 6), tone: 'copper' },
			{ square: at(5, 5), tone: 'copper' },
		]);
		expect(plan.arrows).toEqual([{ from, to: at(4, 4), tone: 'copper' }]);
		expect(plan.victims).toEqual([victim, next]);
	});
});
