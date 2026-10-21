import { matchLayout, readSafeInsets } from '../hud/matchLayout';
export function reliquaryLayout(width: number, height: number) {
	return matchLayout(width, height, readSafeInsets());
}
