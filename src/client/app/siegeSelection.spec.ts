import { describe, it, expect } from 'vitest';
import { SiegeSelection } from './siegeSelection';
import runtime from './siegeOpening.ts?raw';
import html from '../../../index.html?raw';

describe('Siege selection progress', () => {
 it('starts at the actual current side, holds endpoints and preserves the contact pivot', () => {
  const state = new SiegeSelection('black');
  expect([state.displacement('white'), state.displacement('black')]).toEqual([0, 55]);
  state.advance(5000, false);
  expect(state.settled).toBe(true);
  expect(runtime).toContain('context.drawImage(images[1], 141, 160 - displacement)');
  expect(runtime).toContain('context.drawImage(images[2], 0, 0)');
 });
 it('reverses both pieces from their current progress on rapid changes', () => {
  const state = new SiegeSelection('white');
  state.select('black', false);
  state.advance(240, false);
  const before = [state.pieces.white.progress, state.pieces.black.progress];
  expect(before[0]).toBeGreaterThan(0);
  expect(before[0]).toBeLessThan(1);
  state.select('white', false);
  expect([state.pieces.white.progress, state.pieces.black.progress]).toEqual(before);
  state.advance(30, false);
  expect(state.pieces.white.progress).toBeGreaterThan(before[0]);
  for (let i = 0; i < 10; i++) { state.select(i % 2 ? 'white' : 'black', false); state.advance(20, false); }
  state.select('black', false); state.advance(1000, false);
  expect([state.displacement('white'), state.displacement('black')]).toEqual([0, 55]);
 });
 it('keeps latest choice across delayed artwork readiness and reduced-motion changes', () => {
  const state = new SiegeSelection('white');
  state.select('black', false); state.advance(100, false);
  state.select('white', false); state.select('black', true);
  expect([state.displacement('white'), state.displacement('black')]).toEqual([0, 55]);
  state.select('white', false); state.advance(10, false); state.advance(0, true);
  expect([state.displacement('white'), state.displacement('black')]).toEqual([55, 0]);
  expect(runtime).toContain('painters[side]!(state.displacement(side))');
 });
 it('loads only layers and fallback endpoints without changing the early Play gate', () => {
  expect(runtime).toContain('frames/*/*-{00,55}.webp');
  expect(runtime).not.toContain('checkersStartup');
  expect(runtime).toContain("button.dataset.art = 'static'");
  expect(html.indexOf('window.checkersStartup.unlock()')).toBeLessThan(html.indexOf("import('/src/client/app/main.ts')"));
 });
});
