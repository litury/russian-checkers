import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { canUndoBot } from './botUndo';
import scene from './gameScene.ts?raw';
import html from '../../../index.html?raw';

it('undo is bot-only, one gesture, after over too', () => {
 expect(canUndoBot(true, 3)).toBe(false);
 expect(canUndoBot(false, 0)).toBe(false);
 expect(canUndoBot(false, 1)).toBe(true);
 expect(scene).toContain('undoBot');
 expect(scene).toContain('canUndoBot');
 expect(scene).toMatch(/if \(this\.online\) return/);
 expect(html).toContain('id="match-undo"');
 expect(html).toContain('Отменить ход');
 expect(readFileSync(new URL('./openingGates.css', import.meta.url), 'utf8')).toContain('z-index:10000');
 expect(scene).toContain('hide(true)');
 expect(scene).toContain('resultGen');
 expect(scene).toContain('seatResume');
});
