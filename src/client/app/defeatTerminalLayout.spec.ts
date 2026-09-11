import { expect, it } from 'vitest';
import { defeatTerminalLayout } from './defeatTerminalLayout';

it.each([[390,844],[1280,720],[320,568],[844,390]])('fits terminal and non-overlapping touch targets in %sx%s', (w,h) => {
 const l = defeatTerminalLayout(w,h);
 expect(l.x).toBeGreaterThanOrEqual(12);
 expect(l.y).toBeGreaterThanOrEqual(12);
 expect(l.x + 324*l.scale).toBeLessThanOrEqual(w-12);
 expect(l.y + 432*l.scale).toBeLessThanOrEqual(h-12);
 expect(l.buttons[0].height).toBeGreaterThanOrEqual(44);
 expect(l.buttons[1].height).toBeGreaterThanOrEqual(44);
 expect(l.buttons[0].y+l.buttons[0].height).toBeLessThanOrEqual(l.buttons[1].y);
 expect(l.buttons[1].y+l.buttons[1].height).toBeLessThanOrEqual(h);
});
