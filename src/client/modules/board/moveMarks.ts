import type { IMove, IPosition, ISquare, Side } from '@/rules';

export type MarkTone = 'amber' | 'copper';

export type MoveMarks = {
	arrows: { from: ISquare; to: ISquare; tone: MarkTone }[];
	brackets: { square: ISquare; tone: MarkTone }[];
	victims: ISquare[];
	/** One slash per victim, aimed along the hop that takes it. Not a landing mark. */
	cuts: { square: ISquare; from: ISquare; to: ISquare }[];
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

function diagonalSquares(from: ISquare, land: ISquare): ISquare[] {
	const dr = Math.sign(land.row - from.row);
	const dc = Math.sign(land.col - from.col);
	const steps = Math.abs(land.row - from.row);
	if (!dr || !dc || steps !== Math.abs(land.col - from.col)) return [];
	const squares: ISquare[] = [];
	for (let i = 1; i <= steps; i++)
		squares.push({ row: from.row + dr * i, col: from.col + dc * i });
	return squares;
}

/**
 * Brackets on every path cell, including far king landings.
 * Quiet hops are amber; capture hops are copper.
 * One arrow from the piece along each first diagonal.
 * A multi-capture also puts that same arrow on every empty cell of the
 * chain, aimed at the next jump. Never on a victim, and never a cross.
 */
export function planMoveMarks(position: IPosition, moves: IMove[]): MoveMarks {
	const arrows = new Map<string, MoveMarks['arrows'][number]>();
	const brackets = new Map<string, MoveMarks['brackets'][number]>();
	const victims = new Map<string, ISquare>();
	const cuts = new Map<string, MoveMarks['cuts'][number]>();
	const hops: {
		side: Side;
		from: ISquare;
		path: ISquare[];
	}[] = [];
	for (const move of moves) {
		const side = position.squares[move.from.row]?.[move.from.col]?.side;
		if (!side || move.path.length === 0) continue;
		hops.push({ side, from: move.from, path: move.path });
		let from = move.from;
		for (const land of move.path) {
			const enemy = segmentEnemy(position, from, land, side);
			const tone: MarkTone = enemy ? 'copper' : 'amber';
			if (enemy) {
				victims.set(key(enemy), enemy);
				if (!cuts.has(key(enemy)))
					cuts.set(key(enemy), { square: enemy, from, to: land });
			}
			const marked = brackets.get(key(land));
			if (!marked || tone === 'copper')
				brackets.set(key(land), { square: land, tone });
			from = land;
		}
	}
	const putArrow = (from: ISquare, to: ISquare, tone: MarkTone): void => {
		if (victims.has(key(from))) return;
		const dr = Math.sign(to.row - from.row);
		const dc = Math.sign(to.col - from.col);
		if (!dr || !dc) return;
		const id = `${key(from)}:${dr},${dc}`;
		const arrow = arrows.get(id);
		if (!arrow || (arrow.tone === 'amber' && tone === 'copper'))
			arrows.set(id, { from, to, tone });
	};
	for (const move of hops) {
		const first = move.path[0];
		const firstEnemy = segmentEnemy(position, move.from, first, move.side);
		putArrow(move.from, first, firstEnemy ? 'copper' : 'amber');
		if (move.path.length < 2) continue;
		let from = move.from;
		for (let hop = 0; hop < move.path.length; hop++) {
			const land = move.path[hop];
			const next = move.path[hop + 1];
			const enemy = segmentEnemy(position, from, land, move.side);
			const tone: MarkTone = enemy ? 'copper' : 'amber';
			for (const square of diagonalSquares(from, land)) {
				if (victims.has(key(square))) continue;
				const isLand = square.row === land.row && square.col === land.col;
				if (isLand && !next) continue;
				if (isLand && next) {
					const nextEnemy = segmentEnemy(position, land, next, move.side);
					putArrow(land, next, nextEnemy ? 'copper' : 'amber');
					continue;
				}
				putArrow(square, land, tone);
			}
			from = land;
		}
	}
	return {
		arrows: [...arrows.values()],
		brackets: [...brackets.values()],
		victims: [...victims.values()],
		cuts: [...cuts.values()],
	};
}
