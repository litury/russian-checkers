/** CSS targets keep their size; the card's Phaser transform owns their position. */
export const actionTarget = { width: 96, height: 44 } as const;
export type CardTransform = { x: number; y: number; scaleX: number; scaleY: number };
export function matchActionGeometry(card: CardTransform) {
	const top = card.y + 89 * card.scaleY - actionTarget.height - 4;
	return {
		left: card.x + 10 * card.scaleX,
		top,
		tooltipBelow: top < 90,
		width: actionTarget.width * 2,
		height: actionTarget.height,
	};
}
