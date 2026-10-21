import type { IMove } from '../types/IMove';
import type { IPosition } from '../types/IPosition';
import {
	BOARD_SIZE,
	DIAGONALS,
	getPiece,
	inBounds,
	isVacant,
	offset,
} from './board';

export function collectQuietMoves(position: IPosition): IMove[] {
	const moves: IMove[] = [];
	for (let row = 0; row < BOARD_SIZE; row += 1) {
		for (let col = 0; col < BOARD_SIZE; col += 1) {
			const from = { row, col };
			const piece = getPiece(position, from);
			if (!piece || piece.side !== position.turn) {
				continue;
			}
			if (piece.kind === 'man') {
				const forward = piece.side === 'white' ? 1 : -1;
				for (const colDir of [-1, 1]) {
					const land = { row: from.row + forward, col: from.col + colDir };
					if (inBounds(land) && isVacant(position, land)) {
						moves.push({ from, path: [land] });
					}
				}
				continue;
			}
			for (const dir of DIAGONALS) {
				let steps = 1;
				while (true) {
					const land = offset(from, dir, steps);
					if (!inBounds(land) || !isVacant(position, land)) {
						break;
					}
					moves.push({ from, path: [land] });
					steps += 1;
				}
			}
		}
	}
	return moves;
}
