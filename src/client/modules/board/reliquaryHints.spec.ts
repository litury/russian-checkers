import { expect, it } from 'vitest';
import { markerDestinations } from './reliquaryHints';

it('marks only the final endpoint of every legal chain, deduplicating shared endpoints', () => {
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
	).toEqual([a, b]);
});
