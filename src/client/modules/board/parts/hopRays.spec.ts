import { describe, expect, it } from 'vitest';
import { hopMovesForSelection, uniqueHopLands, uniqueHopRays } from './hopRays';

const origin = { row: 2, col: 2 };

describe('hopMovesForSelection', () => {
	const moves = [
		{ from: origin, path: [{ row: 3, col: 3 }] },
		{ from: { row: 5, col: 1 }, path: [{ row: 6, col: 2 }] },
	];

	it('returns no hops until a piece is selected', () => {
		expect(hopMovesForSelection(moves, null)).toEqual([]);
	});

	it('keeps only hops that start on the selected square', () => {
		expect(hopMovesForSelection(moves, origin)).toEqual([moves[0]]);
	});
});

describe('uniqueHopRays', () => {
	it('collapses several king landings on one diagonal into one ray', () => {
		const moves = [
			{ from: origin, path: [{ row: 3, col: 3 }] },
			{ from: origin, path: [{ row: 4, col: 4 }] },
			{ from: origin, path: [{ row: 5, col: 5 }] },
			{ from: origin, path: [{ row: 3, col: 1 }] },
		];
		expect(uniqueHopRays(moves)).toEqual([
			{ from: origin, land: { row: 5, col: 5 } },
			{ from: origin, land: { row: 3, col: 1 } },
		]);
	});

	it('dedups the same from+land hop used by several moves', () => {
		const hop = { from: origin, path: [{ row: 4, col: 4 }] };
		expect(uniqueHopRays([hop, hop])).toEqual([
			{ from: origin, land: { row: 4, col: 4 } },
		]);
	});

	it('keeps chain-capture hops as separate rays', () => {
		const move = {
			from: origin,
			path: [
				{ row: 4, col: 4 },
				{ row: 6, col: 2 },
			],
		};
		expect(uniqueHopRays([move])).toEqual([
			{ from: origin, land: { row: 4, col: 4 } },
			{ from: { row: 4, col: 4 }, land: { row: 6, col: 2 } },
		]);
	});
});

describe('uniqueHopLands', () => {
	it('puts one landing pit per unique destination', () => {
		const moves = [
			{ from: origin, path: [{ row: 3, col: 3 }] },
			{ from: origin, path: [{ row: 4, col: 4 }] },
			{ from: origin, path: [{ row: 4, col: 4 }] },
			{
				from: origin,
				path: [
					{ row: 4, col: 0 },
					{ row: 6, col: 2 },
				],
			},
		];
		expect(uniqueHopLands(moves)).toEqual([
			{ row: 3, col: 3 },
			{ row: 4, col: 4 },
			{ row: 4, col: 0 },
			{ row: 6, col: 2 },
		]);
	});
});
