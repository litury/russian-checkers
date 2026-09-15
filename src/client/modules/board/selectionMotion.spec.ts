import { expect, it } from 'vitest';
import { SelectionMotion } from './selectionMotion';

it('reverses from fractional progress with duration proportional to the remaining distance', () => {
 const m = new SelectionMotion();
 m.select(true, false); m.advance(325, false);
 expect(m.progress).toBeCloseTo(0.5);
 m.select(false, false);
 expect(m.progress).toBeCloseTo(0.5);
 m.advance(162.5, false);
 expect(m.progress).toBeCloseTo(0.25);
 m.select(true, false);
 expect(m.progress).toBeCloseTo(0.25);
 m.advance(243.75, false);
 expect(m.progress).toBeCloseTo(0.625);
 m.advance(243.75, false);
 expect(m.frame).toBe(20);
 m.select(false, false); m.advance(325, false);
 expect(m.frame).toBe(10);
 m.advance(325, false); expect(m.frame).toBe(0);
});
it('a live reduced-motion toggle settles without replay when motion is restored', () => {
 const m = new SelectionMotion();
 m.select(true, false); m.advance(100, false); m.advance(1, true);
 expect(m.frame).toBe(20);
 m.advance(1, false); expect(m.frame).toBe(20);
 m.select(false, true); expect(m.frame).toBe(0);
 m.advance(1, false); expect(m.frame).toBe(0);
});
it('enters with smoothstep over 650ms and holds the last frame indefinitely', () => {
 const motion = new SelectionMotion();
 motion.select(true, false);
 motion.advance(162.5, false);
 expect(motion.progress).toBeCloseTo(0.15625);
 expect(motion.frame).toBe(3);
 motion.advance(487.5, false);
 expect(motion.frame).toBe(20);
 motion.select(true, false);
 motion.advance(10000, false);
 expect(motion.frame).toBe(20);
});
