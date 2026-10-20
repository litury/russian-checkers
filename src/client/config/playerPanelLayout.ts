import type { matchLayout, SafeInsets } from './matchLayout';

export function playerPanelLayout(
	layout: ReturnType<typeof matchLayout>,
	width: number,
	height: number,
	safe: SafeInsets,
	side: 'you' | 'foe' = 'you',
) {
	const contentWidth = width - safe.left - safe.right;
	const panelWidth = Math.min(
		contentWidth - 4,
		Math.max(374, 380 * layout.scale),
	);
	const boardTop = layout.originY - 33 * layout.scale;
	const boardBottom = layout.originY + layout.fieldSize + 33 * layout.scale;
	const panelHeight = Math.min(
		128,
		boardTop - safe.top - 8,
		height - safe.bottom - boardBottom - 8,
	);
	return {
		x: safe.left + (contentWidth - panelWidth) / 2,
		y: side === 'foe' ? boardTop - 4 - panelHeight : boardBottom + 4,
		scaleX: panelWidth / 374,
		scaleY: panelHeight / 128,
	};
}
