import { playerPanelGeometry } from '../hud/playerPanelGeometry';

export { actionTarget } from './actionLayout';
export type CardTransform = {
	x: number;
	y: number;
	scaleX: number;
	scaleY: number;
};
export function matchActionGeometry(card: CardTransform) {
	const { actions } = playerPanelGeometry(374 * card.scaleX, 128 * card.scaleY);
	const top = card.y + actions.y;
	return {
		left: card.x + actions.x,
		top,
		tooltipBelow: top < 90,
		width: actions.width,
		height: actions.height,
	};
}
