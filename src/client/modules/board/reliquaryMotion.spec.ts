import { expect, it } from 'vitest';
import { MarkerMotion, markerPhase } from './reliquaryMotion';

it('seats and glints once then pulses without restarting geometry or sync', () => {
	const m = new MarkerMotion();
	m.sync('capture-a', false);
	expect(m.elapsed).toBe(0);
	m.advance(250, false);
	m.sync('capture-a', false);
	expect(m.elapsed).toBe(250);
	expect(markerPhase(0).radius).toBe(19);
	expect(markerPhase(300).glint).toBeGreaterThan(0);
	m.advance(1000, false);
	expect(m.active).toBe(true);
	expect(m.elapsed).toBe(1250);
	expect(markerPhase(720).pulse).toBe(0);
	expect(markerPhase(1920).pulse).toBeCloseTo(1);
	expect(markerPhase(3120).pulse).toBeCloseTo(0);
	expect(markerPhase(1920).glint).toBe(0);
	expect(markerPhase(1920).amber).toBe(0);
	expect(markerPhase(m.elapsed).radius).toBe(17.4);
	expect(markerPhase(m.elapsed).opening).toBe(1.5);
	m.sync('capture-b', false);
	expect(m.elapsed).toBe(0);
	m.cancel();
	expect(m.active).toBe(false);
	m.advance(10, false);
	expect(m.active).toBe(false);
});
it('quiet selection ends after its entrance instead of redrawing indefinitely', () => {
	const m = new MarkerMotion();
	m.sync('quiet', false, false);
	m.advance(1000, false);
	expect(m.active).toBe(false);
	expect(m.elapsed).toBe(720);
});
it('reduced motion starts and switches immediately to final state', () => {
	const m = new MarkerMotion();
	m.sync('a', true);
	expect(m.active).toBe(false);
	m.sync('b', false);
	expect(m.active).toBe(true);
	m.advance(1, true);
	expect(m.active).toBe(false);
	m.sync('b', false);
	expect(m.active).toBe(false);
});
