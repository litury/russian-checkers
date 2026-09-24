import { squareAlg } from '@/online/notation';
import type { Side } from '@/rules';

/** board.webp frame. Labels sit in this bezel; they must not grow it. */
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

/** Same label layer as the history frame: letters under files, digits in the left rail. */
export function syncBoardCoords(
	parent: ParentNode | null | undefined,
	field: { originX: number; originY: number; scale: number },
	facing: Side,
	visible: boolean,
): HTMLElement | null {
	if (!parent || typeof document === 'undefined' || !document.createElement)
		return null;
	let layer = parent.querySelector<HTMLElement>('#board-coords');
	if (!layer) {
		layer = document.createElement('div');
		layer.id = 'board-coords';
		layer.hidden = true;
		layer.style.position = 'fixed';
		layer.style.zIndex = '4';
		layer.style.pointerEvents = 'none';
		layer.setAttribute('aria-hidden', 'true');
		const files = document.createElement('div');
		files.className = 'board-coords-files';
		for (const file of fileLabels) {
			const span = document.createElement('span');
			span.textContent = file;
			files.append(span);
		}
		const ranks = document.createElement('div');
		ranks.className = 'board-coords-ranks';
		for (let i = 0; i < 8; i++) ranks.append(document.createElement('span'));
		layer.append(files, ranks);
		parent.append(layer);
	}
	const rect = boardFrameRect(field);
	layer.style.left = `${rect.x}px`;
	layer.style.top = `${rect.y}px`;
	layer.style.width = `${rect.width}px`;
	layer.style.height = `${rect.height}px`;
	layer.hidden = !visible;
	const spans = layer.querySelectorAll('.board-coords-ranks span');
	visualRankLabels(facing).forEach((text, i) => {
		const span = spans[i];
		if (span) span.textContent = text;
	});
	return layer;
}
