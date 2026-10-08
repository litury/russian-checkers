import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/client/app/matchActions.css', 'utf8');
import hud from './createHud.ts?raw';
import { clockFrame } from './clockFrame';
it('docks only through the ready rail gate with the shared clock duration', () => {
 expect(clockFrame.enterMs).toBe(420);
 expect(hud).toContain("actions.style.setProperty('--action-enter-ms', `${clockFrame.enterMs}ms`)");
 expect(css).toContain('#match-actions[aria-hidden="false"] .match-action{animation:match-action-dock');
 expect(css).toContain('cubic-bezier(.25,.75,.5,1)');
 expect(css).toContain('from{translate:0 28px;clip-path:inset(0 0 100% 0)}');
 expect(css).toContain('to{translate:0 0;clip-path:inset(0)}');
});
it('has an immediate static reduced-motion endpoint without modifying dialog actions', () => {
 expect(css).toContain('@media(prefers-reduced-motion:reduce)');
 expect(css).toContain('#match-actions[aria-hidden="false"] .match-action{animation:none;translate:none;clip-path:none}');
 expect(css).not.toContain('#resign-confirmation .match-action{animation:');
});
