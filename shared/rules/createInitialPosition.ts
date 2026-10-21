import { BOARD_SIZE, emptyBoard, isDarkSquare } from './parts/board';
import type { IPosition } from './types/IPosition';

export function createInitialPosition(): IPosition {
	const squares = emptyBoard();
	for (let row = 0; row < BOARD_SIZE; row += 1) {
		for (let col = 0; col < BOARD_SIZE; col += 1) {
			const square = { row, col };
			if (!isDarkSquare(square)) {
				continue;
			}
			if (row <= 2) {
				squares[row][col] = { side: 'white', kind: 'man' };
			} else if (row >= 5) {
				squares[row][col] = { side: 'black', kind: 'man' };
			}
		}
	}
	return { squares, turn: 'white' };
}
