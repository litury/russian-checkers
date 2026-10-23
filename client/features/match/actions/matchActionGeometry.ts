import { actionTarget, compactPanelHeight } from './actionLayout';
export { actionTarget } from './actionLayout';
export type CardTransform = {
	x: number;
	y: number;
	scaleX: number;
	scaleY: number;
};
export function matchActionGeometry(card: CardTransform) {
	const compact = 128 * card.scaleY < compactPanelHeight;
	const top =
		card.y +
		(compact
			? 8
			: Math.max(
					34 * card.scaleY + 2,
					89 * card.scaleY - actionTarget.height - 4,
				));
	const width = Math.min(actionTarget.width * 2, 203 * card.scaleX - 8);
	return {
		// Inner card edge is local x=10; heading starts at x=20.
		// Share its 10-unit breathing room rather than sitting on the frame.
		left: card.x + 20 * card.scaleX,
		top,
		tooltipBelow: top < 90,
		width,
		height: actionTarget.height,
	};
}
