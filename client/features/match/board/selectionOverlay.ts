/**
 * Selection overlay (card t_3bdb17f4): a separate layer above the real piece.
 *
 * The delivered pack holds ten 132x132 RGBA frames (44 CSS px cell at DPR3,
 * anchor = cell centre). They are composited normal-alpha above the piece, so
 * the piece keeps its own texture and never whitens. Both the `none` frame and
 * the final `exit-03` frame carry no ink at all: the selection progress starts
 * and ends without any overlay.
 */
export const selectionOverlayKeys = {
	none: 'selection_overlay_none',
	'enter-01': 'selection_overlay_enter-01',
	'enter-02': 'selection_overlay_enter-02',
	'enter-03': 'selection_overlay_enter-03',
	'enter-04': 'selection_overlay_enter-04',
	'hold-01': 'selection_overlay_hold-01',
	'hold-02': 'selection_overlay_hold-02',
	'exit-01': 'selection_overlay_exit-01',
	'exit-02': 'selection_overlay_exit-02',
	'exit-03': 'selection_overlay_exit-03',
} as const;

export type SelectionOverlayFrame = keyof typeof selectionOverlayKeys;

/** Pack order. `hold-02` is the optional idle breath; the hold itself stays static. */
export const selectionOverlayOrder: readonly SelectionOverlayFrame[] = [
	'none',
	'enter-01',
	'enter-02',
	'enter-03',
	'enter-04',
	'hold-01',
	'hold-02',
	'exit-01',
	'exit-02',
	'exit-03',
];

export const selectionOverlayTexture = (frame: SelectionOverlayFrame): string =>
	selectionOverlayKeys[frame];

const ENTER: readonly SelectionOverlayFrame[] = [
	'enter-01',
	'enter-02',
	'enter-03',
	'enter-04',
];
const EXIT: readonly SelectionOverlayFrame[] = [
	'exit-01',
	'exit-02',
	'exit-03',
];

/**
 * Frame for the 650 ms select/deselect progress. `opening` picks the ladder:
 * the pack draws the closing reveal as its own sequence, so one progress
 * number cannot serve both. Both endpoints of the progress carry no overlay.
 */
export function selectionOverlayFrame(
	progress: number,
	opening: boolean,
): SelectionOverlayFrame {
	const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
	if (p <= 0) return 'none';
	if (p >= 1) return 'hold-01';
	if (opening) return ENTER[Math.min(ENTER.length, Math.ceil(p * 4)) - 1];
	// Closing runs the same 162 ms ladder backwards: exit-01 is the most open.
	return EXIT[EXIT.length - Math.min(EXIT.length, Math.ceil(p * 3))];
}
