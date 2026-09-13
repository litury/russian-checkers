import { expect, it } from 'vitest';
import { MarkerMotion, markerPhase } from './reliquaryMotion';

it('seats, glints once, opens destinations then holds; repeated sync does not restart', () => {
	const m = new MarkerMotion();
	m.sync('capture-a', false);
	expect(m.elapsed).toBe(0);
	m.advance(250, false);
	m.sync('capture-a', false);
	expect(m.elapsed).toBe(250);
	expect(markerPhase(0).radius).toBe(19);
	expect(markerPhase(300).glint).toBeGreaterThan(0);
	m.advance(1000, false);
	expect(m.active).toBe(false);
	expect(markerPhase(m.elapsed)).toEqual(markerPhase(10000));
	expect(markerPhase(m.elapsed).radius).toBe(17.4);
	expect(markerPhase(m.elapsed).opening).toBe(1.5);
	m.sync('capture-b', false);
	expect(m.elapsed).toBe(0);
	m.cancel();
	expect(m.active).toBe(false);
	m.advance(10, false);
	expect(m.active).toBe(false);
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
