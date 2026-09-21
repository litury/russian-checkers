import css from './openingGates.css?raw';
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
 expect(html).toContain('id="match-resign"');
 expect(html).toContain('Отменить ход');
 expect(html).toContain('Сдаться');
 expect(css).toContain('z-index:10000');
 expect(css).not.toContain('#game{height:calc(100% - 72px');
 expect(scene).toContain('hide(true)');
 expect(scene).toContain('this.live?.resign()');
 expect(scene).toContain('resultGen');
 expect(scene).toContain('seatResume');
});
