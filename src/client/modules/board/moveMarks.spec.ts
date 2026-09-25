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
const id = (square: ISquare): string => `${square.row},${square.col}`;

describe('planMoveMarks', () => {
	it('puts an amber bracket on every quiet king landing, and one arrow per diagonal', () => {
		const from = at(2, 2);
		const plan = planMoveMarks(position([[from, 'king', 'white']]), [
			{ from, path: [at(3, 3)] },
			{ from, path: [at(4, 4)] },
			{ from, path: [at(5, 5)] },
			{ from, path: [at(3, 1)] },
		]);
		expect(plan.brackets).toEqual([
			{ square: at(3, 3), tone: 'amber' },
			{ square: at(4, 4), tone: 'amber' },
			{ square: at(5, 5), tone: 'amber' },
			{ square: at(3, 1), tone: 'amber' },
		]);
		expect(plan.arrows).toHaveLength(2);
		expect(plan.arrows.every((arrow) => arrow.from.row === 2 && arrow.from.col === 2)).toBe(true);
		expect(plan.arrows.every((arrow) => arrow.tone === 'amber')).toBe(true);
		expect(plan.victims).toEqual([]);
	});

	it('marks every capture landing, including cells after the first hop, in copper', () => {
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
		expect(plan.brackets).toEqual([
			{ square: at(4, 4), tone: 'copper' },
			{ square: at(6, 6), tone: 'copper' },
			{ square: at(5, 5), tone: 'copper' },
		]);
		expect(plan.victims).toEqual([victim, next]);
		const arrowAt = (square: ISquare) => plan.arrows.filter((arrow) => id(arrow.from) === id(square));
		expect(arrowAt(from)).toEqual([{ from, to: at(4, 4), tone: 'copper' }]);
		expect(arrowAt(at(4, 4))).toEqual([{ from: at(4, 4), to: at(6, 6), tone: 'copper' }]);
		expect(arrowAt(victim)).toEqual([]);
		expect(arrowAt(next)).toEqual([]);
		expect(arrowAt(at(6, 6))).toEqual([]);
	});

	it('puts the same arrow on every empty cell of a capture chain, aimed at the next jump', () => {
		const from = at(0, 0);
		const first = at(2, 2);
		const second = at(5, 5);
		const plan = planMoveMarks(
			position([
				[from, 'king', 'white'],
				[first, 'man', 'black'],
				[second, 'man', 'black'],
			]),
			[{ from, path: [at(3, 3), at(6, 6)] }],
		);
		const aimed = plan.arrows.map((arrow) => `${id(arrow.from)}->${id(arrow.to)}:${arrow.tone}`);
		expect(aimed).toEqual([
			'0,0->3,3:copper',
			'1,1->3,3:copper',
			'3,3->6,6:copper',
			'4,4->6,6:copper',
		]);
		expect(plan.arrows.some((arrow) => id(arrow.from) === '2,2' || id(arrow.from) === '5,5')).toBe(false);
		expect(plan.arrows.some((arrow) => id(arrow.from) === '6,6')).toBe(false);
		expect(plan.brackets.map((cell) => id(cell.square))).toEqual(['3,3', '6,6']);
	});
});
