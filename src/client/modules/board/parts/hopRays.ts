import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, ISquare } from '@/rules';

export type HopRay = {
	from: ISquare;
	land: ISquare;
};

function hopKey(from: ISquare, land: ISquare): string {
	return `${from.row},${from.col}:${land.row},${land.col}`;
}

function rayKey(from: ISquare, land: ISquare): string {
	const dirRow = Math.sign(land.row - from.row);
	const dirCol = Math.sign(land.col - from.col);
	return `${from.row},${from.col}:${dirRow},${dirCol}`;
}

function hopSteps(from: ISquare, land: ISquare): number {
	return Math.abs(land.row - from.row);
}

export function hopMovesForSelection(
	moves: IMove[],
	selected: ISquare | null,
): IMove[] {
	if (!selected) {
		return [];
	}
	return moves.filter((move) => sameSquare(move.from, selected));
}

export function uniqueHopRays(moves: IMove[]): HopRay[] {
	const hops = new Map<string, HopRay>();
	for (const move of moves) {
		let from = move.from;
		for (const land of move.path) {
			const key = hopKey(from, land);
			if (!hops.has(key)) {
				hops.set(key, { from, land });
			}
			from = land;
		}
	}
	const rays = new Map<string, HopRay>();
	for (const hop of hops.values()) {
		const key = rayKey(hop.from, hop.land);
		const prev = rays.get(key);
		const farther =
			!prev || hopSteps(prev.from, prev.land) < hopSteps(hop.from, hop.land);
		if (farther) {
			rays.set(key, hop);
		}
	}
	return [...rays.values()];
}

export function uniqueHopLands(moves: IMove[]): ISquare[] {
	const seen = new Set<string>();
	const lands: ISquare[] = [];
	for (const move of moves) {
		const dest = move.path[move.path.length - 1];
		if (!dest) {
			continue;
		}
		const key = `${dest.row},${dest.col}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		lands.push(dest);
	}
	return lands;
}
