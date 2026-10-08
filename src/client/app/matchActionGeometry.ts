/** CSS targets keep their size; the card's Phaser transform owns their position. */
export const actionTarget = { width: 96, height: 44 } as const;
export type CardTransform = { x: number; y: number; scaleX: number; scaleY: number };
export function matchActionGeometry(card: CardTransform) {
	const top = card.y + 89 * card.scaleY - actionTarget.height - 4;
	return {
		// Inner card edge is local x=10; heading starts at x=20.
		// Share its 10-unit breathing room rather than sitting on the frame.
		left: card.x + 20 * card.scaleX,
		top,
		tooltipBelow: top < 90,
		width: actionTarget.width * 2,
		height: actionTarget.height,
	};
}
