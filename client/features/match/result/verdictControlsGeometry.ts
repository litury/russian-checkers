import { matchLayout, type SafeInsets } from '@/client/features/match/hud/matchLayout';

/** Same free bay as live actions, anchored above the immutable status line.
 * Targets stay CSS-sized, independent of Phaser's backing-store density. */
export function verdictControlsGeometry(width: number, height: number, safe: SafeInsets) {
	const l = matchLayout(width, height, safe);
	const primaryWidth = Math.min(120, 203 * l.panelScale - 72);
	const top = l.you.y + 89 * l.panelScale - 48;
	// A short viewport cannot contain 44 CSS px in the scaled clock bay.
	// Keep the board/clocks intact: put a full-size row after the canvas and
	// allow the finished view to scroll, rather than cover cells or clock text.
	if (primaryWidth < 88 || top < l.you.y + 27 * l.panelScale) {
		return {
			left: safe.left + (width - safe.left - safe.right - 192) / 2,
			top: height + 8,
			primaryWidth: 120,
			dock: true,
		};
	}
	return {
		left: l.you.x + 20 * l.panelScale,
		top,
		primaryWidth,
		dock: false,
	};
}
