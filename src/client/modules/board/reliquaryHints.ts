import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, ISquare } from '@/rules';
/** Preserve complete routes, but disclose them only for the chosen own piece. */
export function markerMoves(moves: IMove[], selected: ISquare | null): IMove[] {
	return selected
		? moves.filter((move) => sameSquare(move.from, selected))
		: [];
}
/** Separate clickable next hops from the union of future route cells.
 * A cell occurring in both groups always keeps its current, stronger style.
 * Do not exclude the origin: a legal capture can return there.
 */
export function markerDestinations(moves: IMove[], future = false): ISquare[] {
	const key = (s: ISquare) => `${s.row},${s.col}`;
	const current = new Set(moves.flatMap(move => move.path.slice(0, 1)).map(key));
	const destinations = new Map<string, ISquare>();
	for (const move of moves) {
		for (const land of future ? move.path.slice(1) : move.path.slice(0, 1)) {
			if (!future || !current.has(key(land))) destinations.set(key(land), land);
		}
	}
	return [...destinations.values()];
}
