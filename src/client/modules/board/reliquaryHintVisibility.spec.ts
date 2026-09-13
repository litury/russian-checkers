import { expect, it } from 'vitest';
import board from './createReliquaryBoardView.ts?raw';
import { markerMoves } from './reliquaryHints';
import markers from './reliquaryMarkers.ts?raw';

it('shows no routes before selection and only the selected piece complete routes afterward', () => {
	const a = { row: 2, col: 2 },
		b = { row: 2, col: 6 };
	const routes = [
		{
			from: a,
			path: [
				{ row: 4, col: 4 },
				{ row: 6, col: 6 },
			],
		},
		{ from: a, path: [{ row: 4, col: 0 }] },
		{ from: b, path: [{ row: 4, col: 4 }] },
	];
	expect(markerMoves(routes, null)).toEqual([]);
	expect(markerMoves(routes, a)).toEqual(routes.slice(0, 2));
	expect(markerMoves(routes, b)).toEqual([routes[2]]);
});
it('removes history glyphs and their board state rather than hiding them', () => {
	expect(markers).not.toContain("state === 'start'");
	expect(markers).not.toContain("| 'end'");
	expect(board).not.toContain('history');
});
