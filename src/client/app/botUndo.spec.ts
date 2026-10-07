import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const css = readFileSync(fileURLToPath(new URL('./matchActions.css', import.meta.url)), 'utf8');
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

it('in-card actions use five distinct raster states and fixed 96 by 44 targets', () => {
 expect(css).toContain('width:96px;height:44px;min-height:44px');
 expect(css).toContain('center/contain no-repeat');
 expect(css).toContain('outline:2px solid #bed9ec');
 expect(css).toContain('opacity:1');
 expect(css).toContain('#match-actions[data-tooltip-below="true"] #match-undo-reason{top:48px;bottom:auto}');
 expect(css).toContain('-webkit-tap-highlight-color:transparent');
 expect(html).toContain('aria-describedby="match-undo-reason"');
 expect(html).toContain('id="resign-confirmation"');
 for (const action of ['undo', 'resign']) {
  const images = new Set<string>();
  for (const state of ['rest', 'hover', 'pressed', 'focus', 'disabled']) {
   const name = `${action}-${state}.png`;
   expect(css).toContain(name);
   const data = readFileSync(fileURLToPath(new URL(`./ui/match-actions/${name}`, import.meta.url)));
   expect(data.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
   // Registered 384×160 art fits at 96×40 inside a 44px touch target.
   expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([384, 160]);
   images.add(data.toString('base64'));
  }
  expect(images.size).toBe(5);
 }
});

it('action labels have explicit pockets separate from the icon and dialog bevels', () => {
 expect(css).toContain('left:15px;top:10px;width:22px;height:24px');
 expect(css).toContain('left:40px;right:14px');
 expect(css).toContain('width:144px;height:48px');
 expect(css).toContain('left:20px;right:20px;font-size:12px');
 expect(css).toContain('dialog-neutral.png');
 expect(css).toContain('dialog-copper.png');
 expect(html.match(/class="action-label"/g)).toHaveLength(4);
});

it('rail reveal waits for the same gate as the board with HUD', () => {
 // Reveal readiness is a shared signal, not a second invention.
 expect(scene).toContain('private railConcealed()');
 expect(scene).toContain('this.countingIn || !this.playfieldReadyDone || !this.boardPainted');
 expect(scene).toContain('this.playfieldReadyDone = true');
 expect(scene).toContain('this.boardPainted = true');
 // The reset belongs to a fresh reveal.
 expect(scene).toContain('this.boardPainted = false');
});
