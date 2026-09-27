import css from './openingGates.css?raw';
import chronicle from './hangingChronicle.css?raw';
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

it('rail plates carry the menu steel material at the shared button height', () => {
 // One source of truth for the control height: :root, read by the menu and the rail.
 expect(chronicle).toContain(':root{--btn-h:70px;');
 expect(css).toContain('height:var(--btn-h)');
 // Same accepted raster as the menu buttons — no second art, no flat plaque.
 expect(css).toContain("url('./ui/siege/button-steel-rest.webp')");
 expect(css).toContain("url('./ui/siege/button-steel-pressed.webp')");
 // The grey plaque the player reported is gone, not recoloured.
 expect(css).not.toContain('border:1px solid #62635b');
 expect(css).not.toContain('background:#202526');
 // Tap target floor and the keyboard ring survive.
 expect(css).toContain('min-height:44px');
 expect(css).toContain('#match-undo:focus-visible,#match-resign:focus-visible{outline:3px solid #bed9ec');
 expect(css).toContain('-webkit-tap-highlight-color:transparent');
 expect(css).not.toMatch(/-webkit-tap-highlight-color:\s*rgba?\(/);
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
