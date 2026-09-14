import { describe, expect, it } from 'vitest';
import { PanelReveal, revealPose } from './panelReveal';

describe('bunker preparation', () => {
	it('owns one completion at 2800ms, cancels stale runs, and freezes while paused', () => {
		const reveal = new PanelReveal();
		let starts = 0;
		reveal.start(() => starts++);
		reveal.advance(1400);
		expect(starts).toBe(0);
		reveal.advance(2000, true);
		expect(reveal.elapsed).toBe(1400);
		reveal.advance(1399);
		expect(starts).toBe(0);
		reveal.advance(1);
		reveal.advance(1000);
		expect(starts).toBe(1);
		reveal.start(() => starts++);
		reveal.cancel();
		reveal.advance(3000);
		expect(starts).toBe(1);
		reveal.start(() => starts++);
		reveal.advance(2800);
		expect(starts).toBe(2);
	});
	it('matches the approved monotonic 2.8s timeline and static reduced state', () => {
		expect(revealPose(0, false).lift).toBe(112);
		expect(revealPose(1140, false).doors).toBe(181);
		expect(revealPose(2480, false).lift).toBe(0);
		expect(revealPose(120, false).steam).toBe(0);
		expect(revealPose(720, false).steam).toBe(-1);
		let previous = 112;
		for (let t = 0; t <= 2800; t += 10) {
			const p = revealPose(t, false);
			expect(p.lift).toBeLessThanOrEqual(previous);
			previous = p.lift;
		}
		expect(revealPose(0, true)).toEqual({
			lift: 0,
			doors: 181,
			steam: -1,
			light: 0,
		});
	});
});
