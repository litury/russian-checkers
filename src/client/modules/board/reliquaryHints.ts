import type { IMove, ISquare } from '@/rules';
/** Only endpoints are clickable; never advertise intermediate chain landings. */
export function markerDestinations(moves: IMove[]): ISquare[] {
	const destinations = new Map<string, ISquare>();
	for (const move of moves) {
		const end = move.path.at(-1);
		if (end) destinations.set(`${end.row},${end.col}`, end);
	}
	return [...destinations.values()];
}
