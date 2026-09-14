import { expect, it } from 'vitest';
import { markerDestinations } from './reliquaryHints';

it('marks the next landing of every legal chain, deduplicating shared first hops', () => {
	const from = { row: 2, col: 2 },
		mid = { row: 4, col: 4 },
		a = { row: 6, col: 6 },
		b = { row: 6, col: 2 };
	expect(
		markerDestinations([
			{ from, path: [mid, a] },
			{ from, path: [mid, b] },
			{ from, path: [{ row: 4, col: 0 }, a] },
		]),
	).toEqual([mid, { row: 4, col: 0 }]);
});

it('unions future landings including origin/repeats, with current cells taking priority', () => {
	const from = { row: 2, col: 2 }, a = { row: 4, col: 4 }, b = { row: 2, col: 6 };
	const routes = [{ from, path: [a, b, from, b] }, { from, path: [b, a, from] }];
	expect(markerDestinations(routes, true)).toEqual([from]);
});
