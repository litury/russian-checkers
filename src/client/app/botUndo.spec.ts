import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
 // Rail keeps its label width. Each label has its own plate, contained, not stretched to 100% 100%.
 expect(css).toContain("url('./ui/siege/button-steel-rail-undo-rest.webp')");
 expect(css).toContain("url('./ui/siege/button-steel-rail-resign-rest.webp')");
 expect(css).toContain("url('./ui/siege/button-steel-rail-undo-pressed.webp')");
 expect(css).toContain("url('./ui/siege/button-steel-rail-resign-pressed.webp')");
 expect(css).toMatch(/#match-rail \.opening-utility\{[^}]*min-width:132px/);
 expect(css).toMatch(/#match-rail \.opening-utility\{[^}]*contain no-repeat/);
 expect(css).not.toMatch(/#match-rail \.opening-utility\{[^}]*100% 100%/);
 expect(css).not.toMatch(/#match-rail \.opening-utility\{[^}]*736 \/ 295/);
 // `contain` must be fitted to the border box, otherwise it is fitted to the padded content
 // area and the measured box edges show through. Guards the padding-box regression.
 expect(css).toMatch(/#match-rail \.opening-utility\{[^}]*background-origin:border-box/);
 expect(css).toMatch(/#match-rail \.opening-utility\{[^}]*background-clip:border-box/);
 expect(css).not.toMatch(/#match-rail \.opening-utility\{[^}]*background-origin:padding-box/);
 // Each label has its own drawing with no large left bolt, so the label sits on the recessed
 // panel and not on a bolt.
 expect(css).toContain("url('./ui/siege/button-steel-rail-undo-rest.webp')");
 // The grey plaque the player reported is gone, not recoloured.
 expect(css).not.toContain('border:1px solid #62635b');
 expect(css).not.toContain('background:#202526');
 // Tap target floor and the keyboard ring survive.
 expect(css).toContain('min-height:44px');
 expect(css).toContain('#match-undo:focus-visible,#match-resign:focus-visible{outline:3px solid #bed9ec');
 expect(css).toContain('-webkit-tap-highlight-color:transparent');
 expect(css).not.toMatch(/-webkit-tap-highlight-color:\s*rgba?\(/);
});

function readWebp(path: string) {
 const data = readFileSync(path);
 expect(data.toString('ascii', 0, 4)).toBe('RIFF');
 expect(data.toString('ascii', 8, 12)).toBe('WEBP');
 const tag = data.toString('ascii', 12, 16);
 if (tag === 'VP8 ') {
  // Lossy keyframe: 3-byte frame tag, the 0x9d012a start code, then two 14-bit sizes.
  expect(data[23]).toBe(0x9d);
  expect(data[24]).toBe(0x01);
  expect(data[25]).toBe(0x2a);
  return { width: data[26] | ((data[27] & 0x3f) << 8), height: data[28] | ((data[29] & 0x3f) << 8), hasAlpha: false };
 }
 if (tag === 'VP8X') {
  return {
   width: 1 + (data[24] | (data[25] << 8) | (data[26] << 16)),
   height: 1 + (data[27] | (data[28] << 8) | (data[29] << 16)),
   hasAlpha: (data[20] & 0x10) !== 0,
  };
 }
 throw new Error(`unexpected webp chunk ${tag}`);
}

// `contain` fits the whole drawing into the border box, so the rail plate closes its box only when
// it was drawn for that box: opaque to the edge and at the measured box aspect. A stretched or
// re-used plate fails here even while the CSS still says `contain`.
it('draws one opaque rail plate per measured label box', () => {
 const boxes: [string, number][] = [
  ['button-steel-rail-undo', 135.88],
  ['button-steel-rail-resign', 132],
 ];
 for (const [stem, boxWidth] of boxes) {
  for (const state of ['rest', 'pressed']) {
   const size = readWebp(fileURLToPath(new URL(`./ui/siege/${stem}-${state}.webp`, import.meta.url)));
   expect(size.hasAlpha, `${stem}-${state} must be opaque`).toBe(false);
   // 1% off the box aspect already leaves a visible band on a 70px button.
   expect(Math.abs(size.width / size.height - boxWidth / 70)).toBeLessThan(0.01);
  }
 }
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
