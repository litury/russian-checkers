import { expect, it } from 'vitest';
import {
	selectionOverlayFrame,
	selectionOverlayOrder,
	selectionOverlayTexture,
} from './selectionOverlay';

it('starts and ends the progress without any overlay frame', () => {
	expect(selectionOverlayFrame(0, true)).toBe('none');
	expect(selectionOverlayFrame(0, false)).toBe('none');
	expect(selectionOverlayFrame(-1, true)).toBe('none');
	// Delivered pack: the first frame and the last one carry no ink at all.
	expect(selectionOverlayOrder[0]).toBe('none');
	expect(selectionOverlayOrder[selectionOverlayOrder.length - 1]).toBe(
		'exit-03',
	);
});

it('holds with one static frame once the progress is complete', () => {
	expect(selectionOverlayFrame(1, true)).toBe('hold-01');
	expect(selectionOverlayFrame(1, false)).toBe('hold-01');
	expect(selectionOverlayFrame(4, true)).toBe('hold-01');
});

it('opens through the four enter frames and closes through the exit frames', () => {
	expect(selectionOverlayFrame(0.1, true)).toBe('enter-01');
	expect(selectionOverlayFrame(0.3, true)).toBe('enter-02');
	expect(selectionOverlayFrame(0.6, true)).toBe('enter-03');
	expect(selectionOverlayFrame(0.9, true)).toBe('enter-04');
	// Closing keeps the pack's own order: exit-01 is the most revealed frame.
	expect(selectionOverlayFrame(0.9, false)).toBe('exit-01');
	expect(selectionOverlayFrame(0.5, false)).toBe('exit-02');
	expect(selectionOverlayFrame(0.2, false)).toBe('exit-03');
	// Never the other ladder's frames.
	for (let p = 0.01; p < 1; p += 0.01) {
		expect(selectionOverlayFrame(p, true)).toMatch(/^enter-0[1-4]$/);
		expect(selectionOverlayFrame(p, false)).toMatch(/^exit-0[1-3]$/);
	}
});

it('maps every pack frame to its own texture key', () => {
	const keys = selectionOverlayOrder.map(selectionOverlayTexture);
	expect(new Set(keys).size).toBe(selectionOverlayOrder.length);
	expect(selectionOverlayTexture('none')).toBe('selection_overlay_none');
	expect(selectionOverlayTexture('hold-01')).toBe('selection_overlay_hold-01');
	expect(selectionOverlayTexture('exit-03')).toBe('selection_overlay_exit-03');
});

it('treats a non-finite progress as the closed end', () => {
	expect(selectionOverlayFrame(Number.NaN, true)).toBe('none');
	expect(selectionOverlayFrame(Number.POSITIVE_INFINITY, true)).toBe('none');
	expect(selectionOverlayFrame(Number.NEGATIVE_INFINITY, false)).toBe('none');
});
