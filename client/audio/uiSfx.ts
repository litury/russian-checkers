/** Semantic UI events only; never bind a blanket document click/hover sound. */
export type UiCue =
	| 'ui-open'
	| 'ui-close'
	| 'ui-tap'
	| 'panel-ready'
	| 'undo-applied'
	| 'draw-result';
let emit: (cue: UiCue) => void = () => {};
export function bindUiSfx(next: typeof emit): void {
	emit = next;
}
export function uiSfx(cue: UiCue): void {
	emit(cue);
}
