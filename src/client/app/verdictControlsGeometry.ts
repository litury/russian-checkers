import { matchLayout, type SafeInsets } from '@/client/config/matchLayout';

/** Same free bay as live actions, anchored above the immutable status line.
 * Targets stay CSS-sized, independent of Phaser's backing-store density. */
export function verdictControlsGeometry(width: number, height: number, safe: SafeInsets) {
	const l = matchLayout(width, height, safe);
	return {
		left: l.you.x + 20 * l.panelScale,
		top: l.you.y + 89 * l.panelScale - 48,
		primaryWidth: Math.min(120, 203 * l.panelScale - 72),
	};
}
