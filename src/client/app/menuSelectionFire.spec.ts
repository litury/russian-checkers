import { describe, it, expect } from 'vitest';
import { menuFireFrame, MENU_FIRE } from './menuSelectionFire';
import runtime from './siegeOpening.ts?raw';
import html from '../../../index.html?raw';
import overlay from './openingOverlay.ts?raw';

describe('menu selection release', () => {
 it('has a stable cyclic frame and reduced motion endpoint', () => {
  expect(menuFireFrame(0, false)).toBe(0);
  expect(menuFireFrame(MENU_FIRE.loopMs, false)).toBe(0);
  expect(menuFireFrame(200, true)).toBe(0);
  expect(menuFireFrame(999999, false)).toBeLessThan(MENU_FIRE.frames);
 });
 it('isolates fire from the board and keeps the checker face unobscured', () => {
  expect(runtime).not.toContain('king-fire-polish');
  expect(runtime).not.toContain('drawFire(context, side, true)');
  expect(runtime.indexOf('drawFire(context, side)')).toBeLessThan(runtime.indexOf('context.drawImage(images[0]'));
 });
 it('shows true counts with captions and selected-only identity-free status', () => {
  expect(html).toContain('opening-win-count');
  expect(html).toContain('побед');
  expect(html).toContain('ТВОЙ ЦВЕТ');
  expect(html).not.toContain('opening-guest-');
  expect(overlay).not.toContain('guestTag');
  expect(overlay).toContain("colorStatLabel(stats, 'white')");
 });
});
