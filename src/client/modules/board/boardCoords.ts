import { squareAlg } from '@/online/notation';
import type { Side } from '@/rules';

/** One sheet: white frame left, black frame right. Files do not flip. */
export const boardFrameSheet = 'reliquary_board-frames';

export function boardFrameName(facing: Side): 'white' | 'black' {
	return facing === 'black' ? 'black' : 'white';
}

/** board.webp frame. Facing sprites use the same bezel; they must not grow it. */
export const boardFrame = {
	width: 380,
	height: 418,
	field: 352,
	padX: 14,
	padTop: 33,
} as const;

/** Lower metal of the bottom ornament, shared with the history frame CSS. */
export const fileBottomRatio = 0.018;

export const fileLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export function rankLabel(row: number): string {
	return squareAlg({ row, col: 0 }).slice(1);
}

/** Top-to-bottom rank digits. Columns do not flip; only the vertical does. */
export function visualRankLabels(facing: Side): string[] {
	const rows =
		facing === 'black' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
	return rows.map(rankLabel);
}

export function boardFrameRect(field: {
	originX: number;
	originY: number;
	scale: number;
}) {
	return {
		x: field.originX - boardFrame.padX * field.scale,
		y: field.originY - boardFrame.padTop * field.scale,
		width: boardFrame.width * field.scale,
		height: boardFrame.height * field.scale,
	};
}


