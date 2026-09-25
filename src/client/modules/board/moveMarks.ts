import type { IMove, IPosition, ISquare, Side } from '@/rules';

export type MarkTone = 'amber' | 'copper';

export type MoveMarks = {
	arrows: { from: ISquare; to: ISquare; tone: MarkTone }[];
	circles: { square: ISquare; tone: MarkTone }[];
	victims: ISquare[];
};

const key = (square: ISquare): string => `${square.row},${square.col}`;

/** First enemy strictly between two squares of one diagonal hop. */
export function segmentEnemy(
	position: IPosition,
	from: ISquare,
	land: ISquare,
	side: Side,
): ISquare | null {
	const dr = Math.sign(land.row - from.row);
	const dc = Math.sign(land.col - from.col);
	const steps = Math.abs(land.row - from.row);
	if (!dr || !dc || steps !== Math.abs(land.col - from.col)) return null;
	for (let i = 1; i < steps; i++) {
		const square = { row: from.row + dr * i, col: from.col + dc * i };
		const piece = position.squares[square.row]?.[square.col];
		if (piece && piece.side !== side) return square;
	}
	return null;
}

/**
 * One arrow per diagonal from the piece. A circle on every path cell,
 * including far king landings and later hops — not only path[0].
 * Capture hops are copper; quiet hops are amber.
 */
export function planMoveMarks(position: IPosition, moves: IMove[]): MoveMarks {
	const arrows = new Map<string, MoveMarks['arrows'][number]>();
	const circles = new Map<string, MoveMarks['circles'][number]>();
	const victims = new Map<string, ISquare>();
	for (const move of moves) {
		const side = position.squares[move.from.row]?.[move.from.col]?.side;
		if (!side || move.path.length === 0) continue;
		let from = move.from;
		let first = true;
		for (const land of move.path) {
			const enemy = segmentEnemy(position, from, land, side);
			const tone: MarkTone = enemy ? 'copper' : 'amber';
			if (enemy) victims.set(key(enemy), enemy);
			const marked = circles.get(key(land));
			if (!marked || tone === 'copper')
				circles.set(key(land), { square: land, tone });
			if (first) {
				const dir = `${Math.sign(land.row - move.from.row)},${Math.sign(land.col - move.from.col)}`;
				const id = `${key(move.from)}:${dir}`;
				const arrow = arrows.get(id);
				if (!arrow || (arrow.tone === 'amber' && tone === 'copper'))
					arrows.set(id, { from: move.from, to: land, tone });
				first = false;
			}
			from = land;
		}
	}
	return {
		arrows: [...arrows.values()],
		circles: [...circles.values()],
		victims: [...victims.values()],
	};
}
