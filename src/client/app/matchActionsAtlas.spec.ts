import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
const css = readFileSync(fileURLToPath(new URL('./matchActions.css', import.meta.url)), 'utf8');
const html = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');
function losslessSize(name: string) {
 const data = readFileSync(fileURLToPath(new URL(`./ui/match-actions/${name}`, import.meta.url)));
 expect(data.toString('ascii', 0, 4)).toBe('RIFF');
 expect(data.toString('ascii', 8, 12)).toBe('WEBP');
 // exact alpha can require VP8X; locate the lossless VP8L chunk.
 let offset = 12;
 while (offset < data.length && data.toString('ascii', offset, offset + 4) !== 'VP8L') {
  const length = data.readUInt32LE(offset + 4);
  offset += 8 + length + (length % 2);
 }
 expect(data.toString('ascii', offset, offset + 4)).toBe('VP8L');
 expect(data[offset + 8]).toBe(0x2f);
 const bits = data.readUInt32LE(offset + 9);
 return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, bytes: data.length };
}
it('ships two padded DPR2 lossless atlases within 100000-byte budgets', () => {
 for (const action of ['undo', 'resign']) {
  const size = losslessSize(`${action}-atlas.webp`);
  expect([size.width, size.height]).toEqual([200, 440]);
  expect(size.bytes).toBeLessThanOrEqual(100000);
  expect(css).toContain(`#match-actions [data-art="${action}"]{--action-atlas:url('./ui/match-actions/${action}-atlas.webp')}`);
 }
});
it('uses all five rows with 2 CSS px padding and a rail-only pseudo-element', () => {
 expect(css).toContain('#match-actions .match-action::before');
 expect(css).toContain('left:0;top:2px;width:96px;height:40px');
 expect(css).toContain('/100px 220px no-repeat');
 for (const y of [-2, -46, -90, -134, -178]) expect(css).toContain(`--action-y:${y}px`);
 expect(css).toContain('hover:not(:disabled)');
 expect(css).toContain('#match-actions .match-action:focus-visible{--action-y:-134px}');
 expect(css).toContain('#match-actions .match-action:active:not(:disabled){--action-y:-90px}');
 expect(css).toContain('#match-actions .match-action:disabled{--action-y:-178px}');
 expect(css).toContain('dialog-neutral.png');
 expect(css).toContain('dialog-copper.png');
});
it('ships DPR2 icons within 6000 bytes without PNG runtime references', () => {
 for (const action of ['undo', 'resign']) {
  const size = losslessSize(`${action}-icon.webp`);
  expect([size.width, size.height]).toEqual([44, 48]);
  expect(size.bytes).toBeLessThanOrEqual(6000);
  expect(html).toContain(`${action}-icon.webp`);
  expect(html).not.toContain(`${action}-icon.png`);
 }
});
