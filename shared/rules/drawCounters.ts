import type { DrawCounters, IPosition } from './types/IPosition';
import type { Side } from './types/Side';

export function material(position: IPosition) {
	const counts = {
		white: { men: 0, kings: 0, mainDiagonal: false },
		black: { men: 0, kings: 0, mainDiagonal: false },
	};
	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 8; col++) {
			const piece = position.squares[row][col];
			if (!piece) continue;
			const side = counts[piece.side];
			if (piece.kind === 'king') side.kings++;
			else side.men++;
			if (row === col) side.mainDiagonal = true;
		}
	}
	return counts;
}

function strongerSide(position: IPosition): Side | null {
	const counts = material(position);
	for (const side of ['white', 'black'] as const) {
		const own = counts[side];
		const other = counts[side === 'white' ? 'black' : 'white'];
		if (own.kings >= 3 && other.kings === 1 && other.men === 0) return side;
	}
	return null;
}

export function advanceDrawCounters(
	before: IPosition,
	after: IPosition,
	kingMove: boolean,
	capture: boolean,
	promotion: boolean,
): DrawCounters {
	const previous = before.drawCounters;
	const stable =
		capture || promotion
			? { white: 0, black: 0 }
			: { ...(previous?.stable ?? { white: 0, black: 0 }) };
	const kingsOnly =
		capture || !kingMove
			? { white: 0, black: 0 }
			: { ...(previous?.kingsOnly ?? { white: 0, black: 0 }) };
	if (!capture && !promotion) stable[before.turn]++;
	if (!capture && kingMove) kingsOnly[before.turn]++;
	const stronger = strongerSide(after);
	const continued =
		stronger !== null &&
		stronger === strongerSide(before) &&
		!capture &&
		!promotion;
	return {
		stable,
		kingsOnly,
		stronger,
		strongerMoves: continued
			? (previous?.strongerMoves ?? 0) + Number(before.turn === stronger)
			: 0,
	};
}

export function hasCountedDraw(position: IPosition): boolean {
	const counters = position.drawCounters;
	if (!counters) return false;
	const counts = material(position);
	const total =
		counts.white.men +
		counts.white.kings +
		counts.black.men +
		counts.black.kings;
	const stableMoves = Math.min(counters.stable.white, counters.stable.black);
	const kingMoves = Math.min(
		counters.kingsOnly.white,
		counters.kingsOnly.black,
	);
	if (counts.white.kings && counts.black.kings) {
		const limit = total <= 3 ? 5 : total <= 5 ? 30 : total <= 7 ? 60 : Infinity;
		if (stableMoves >= limit) return true;
	}
	const kingLimit =
		total >= 4 && total <= 5 ? 15 : total >= 6 && total <= 7 ? 25 : Infinity;
	if (kingMoves >= kingLimit) return true;
	if (counters.stronger && counters.strongerMoves >= 15) {
		const own = counts[counters.stronger];
		if (own.kings + own.men > 3 || own.mainDiagonal) return true;
	}
	return false;
}
