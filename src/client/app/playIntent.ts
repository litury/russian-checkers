/**
 * Play intent on the HTML-first start path.
 *
 * «Играть» can be pressed before the engine module exists: the HTML script owns
 * that click and stores its raw `event.timeStamp`. The engine replays the same
 * instant on flush, so `play-intent` is the press and not the module wake-up —
 * the wait stays visible even while the main thread is busy decoding.
 */
import { markPerf, markPerfAt } from './perfMarks';

/** Click instant stored by the HTML CTA before the engine was loaded. */
export type PendingPlayStamp = number | null | undefined;

/** Synthetic event that forwards a stored instant to the real click handler. */
export function playIntentEvent(value: PendingPlayStamp): Event | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		return undefined;
	}
	return { timeStamp: value } as unknown as Event;
}

/** Records the press and the moment its handler actually ran. */
export function notePlayIntent(event?: Event | null): void {
	const stamp = event?.timeStamp;
	if (typeof stamp === 'number' && Number.isFinite(stamp)) {
		markPerfAt('play-intent', stamp);
	} else {
		markPerf('play-intent');
	}
	markPerf('play-handled');
}
