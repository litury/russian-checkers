import { matchActionGeometry } from '../actions/matchActionGeometry';
import { matchLayout, type SafeInsets } from '../hud/matchLayout';
import { playerPanelLayout } from '../hud/playerPanelLayout';

export function verdictControlsGeometry(
	width: number,
	height: number,
	safe: SafeInsets,
) {
	const layout = matchLayout(width, height, safe);
	const card = playerPanelLayout(layout, width, height, safe);
	return matchActionGeometry(card);
}
