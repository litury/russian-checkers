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

/** One sheet, files then ranks 1–8. Each cell is its own sprite; this card does not animate them. */
export const coordGlyphSheet = { cols: 8, rows: 2 } as const;

export function coordGlyphOrder(): string[] {
	return [
		...fileLabels,
		...Array.from({ length: 8 }, (_, row) => rankLabel(row)),
	];
}

/** CSS sprite position. Percentage maps a flush grid: col / (cols - 1). */
export function coordGlyphPosition(glyph: string): string {
	const index = coordGlyphOrder().indexOf(glyph);
	const col = index < 0 ? 0 : index % coordGlyphSheet.cols;
	const row = index < 0 ? 0 : Math.floor(index / coordGlyphSheet.cols);
	const x =
		coordGlyphSheet.cols <= 1
			? 0
			: (col / (coordGlyphSheet.cols - 1)) * 100;
	const y =
		coordGlyphSheet.rows <= 1
			? 0
			: (row / (coordGlyphSheet.rows - 1)) * 100;
	return `${Number(x.toFixed(6))}% ${Number(y.toFixed(6))}%`;
}

export function stampCoordGlyph(el: HTMLElement, glyph: string) {
	el.classList.add('board-coord-glyph');
	el.dataset.glyph = glyph;
	el.textContent = '';
	el.style.backgroundPosition = coordGlyphPosition(glyph);
}

/** History frame uses the same names. Live ranks are stamped again when facing flips. */
export function paintCoordGlyphs(root: ParentNode | null | undefined) {
	if (!root || typeof root.querySelectorAll !== 'function') return;
	for (const el of root.querySelectorAll<HTMLElement>(
		'.board-coord-glyph[data-glyph]',
	)) {
		const glyph = el.dataset.glyph;
		if (glyph) stampCoordGlyph(el, glyph);
	}
}

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
			stampCoordGlyph(span, file);
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
	const ranks = layer.querySelectorAll<HTMLElement>('.board-coords-ranks span');
	visualRankLabels(facing).forEach((glyph, i) => {
		const span = ranks[i];
		if (span) stampCoordGlyph(span, glyph);
	});
	return layer;
}
