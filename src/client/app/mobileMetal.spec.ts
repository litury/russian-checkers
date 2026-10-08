import {readFileSync, statSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const css = (name: string) => readFileSync(new URL(`./${name}.css`, import.meta.url), 'utf8');
const asset = (name: string) => new URL(`./ui/mobile-metal/${name}.webp`, import.meta.url);
describe('generated metal plate integration', () => {
 it('separates constant-scale tiled center from unfilled repeated frame, without underlying paint', () => {
  for (const name of ['onlineHub', 'matchHistory']) {
   const source = css(name);
   expect(source).toContain("border-image:url('./ui/mobile-metal/plate.webp') 60 / 18px / 0 repeat;");
   expect(source).toContain("background:url('./ui/mobile-metal/center.webp') 0 0 / 128px 128px repeat padding-box;");
   expect(source).not.toMatch(/mobile-metal\/plate\.webp'\) 60 fill/);
   expect(source).not.toMatch(/mobile-metal\/plate\.webp'\)[^;]*\b(stretch|round|space)\b/);
   expect(source).not.toContain('linear-gradient(#111717a8');
  }
  expect(css('matchHistory')).toContain('.mh-header,#match-history .mh-row,#match-history .mh-record,#match-history .mh-transport,#match-history .mh-state');
 });
 it('keeps mobile, desktop, transport and landscape corner geometry independent of panel dimensions', () => {
  for (const name of ['onlineHub', 'matchHistory']) {
   expect(css(name)).toContain('min-height:90px; border-width:14px; border-image-width:14px;');
  }
  const history = css('matchHistory');
  expect(history).toContain('border-width:12px; border-image-width:12px;');
  expect(history).toContain('min-height:68px; border-width:10px; border-image-width:10px;');
  expect(history).toContain('border-width:8px; border-image-width:8px;');
 });
 it('exports two lossless sprites within DPR2 dimensions and the revised per-element/area budgets', () => {
  let total = 0;
  for (const [name,width,height] of [['plate',136,136],['center',256,256]] as const) {
   const data = readFileSync(asset(name));
   expect(data.subarray(0,4).toString()).toBe('RIFF');
   expect(data.subarray(8,12).toString()).toBe('WEBP');
   let offset = 12, dimensions: number[] | null = null;
   while (offset + 8 <= data.length) {
    const size = data.readUInt32LE(offset + 4);
    if (data.subarray(offset,offset+4).toString() === 'VP8L') {
     expect(data[offset+8]).toBe(0x2f);
     const bits = data.readUInt32LE(offset+9);
     dimensions = [(bits & 0x3fff)+1,((bits >>> 14) & 0x3fff)+1];
    }
    expect(data.subarray(offset,offset+4).toString()).not.toBe('VP8 ');
    offset += 8 + size + (size & 1);
   }
   expect(dimensions).toEqual([width,height]);
   expect(statSync(asset(name)).size).toBeLessThanOrEqual(150000);
   total += statSync(asset(name)).size;
  }
  // Each surface references both assets: enforce combined surface budget too.
  expect(total).toBeLessThanOrEqual(150000);
  expect(total).toBeLessThanOrEqual(400000);
 });
});
