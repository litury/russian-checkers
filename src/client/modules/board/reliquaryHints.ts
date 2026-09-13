import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, ISquare } from '@/rules';
/** Preserve complete routes, but disclose them only for the chosen own piece. */
export function markerMoves(moves: IMove[], selected: ISquare | null): IMove[] {
	return selected
		? moves.filter((move) => sameSquare(move.from, selected))
		: [];
}
/** Human input chooses one hop at a time, including shared intermediate landings. */
export function markerDestinations(moves: IMove[]): ISquare[] {
	const destinations = new Map<string, ISquare>();
	for (const move of moves) {
		const end = move.path[0];
		if (end) destinations.set(`${end.row},${end.col}`, end);
	}
	return [...destinations.values()];
}
