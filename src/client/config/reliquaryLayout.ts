import { matchLayout, readSafeInsets } from './matchLayout';
export function reliquaryLayout(width: number, height: number) {
	return matchLayout(width, height, readSafeInsets());
}
