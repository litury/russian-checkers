import {readFileSync, statSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const css = (name: string) => readFileSync(new URL(`./${name}.css`, import.meta.url), 'utf8');
describe('generated metal plate integration', () => {
 it('shares one lossless sprite across all plate types, without underlying paint', () => {
  for (const name of ['onlineHub', 'matchHistory']) {
   const source = css(name);
   expect(source).toContain("border-image:url('./ui/mobile-metal/plate.webp') 60 fill / 18px / 0 stretch; background:transparent;");
   expect(source).not.toContain('linear-gradient(#111717a8');
  }
  const history = css('matchHistory');
  expect(history).toContain('.mh-header,#match-history .mh-row,#match-history .mh-record,#match-history .mh-transport,#match-history .mh-state');
 });
 it('keeps mobile geometry and source corner scaling independent of panel dimensions', () => {
  expect(css('onlineHub')).toContain('min-height:90px; border-width:14px; border-image-width:14px;');
  expect(css('matchHistory')).toContain('min-height:90px; border-width:14px; border-image-width:14px;');
  expect(css('matchHistory')).toContain('border-width:12px; border-image-width:12px;');
 });
 it('fits the revised element and whole-area byte budgets', () => {
  const path = new URL('./ui/mobile-metal/plate.webp', import.meta.url);
  const data=readFileSync(path);
  expect(data.subarray(0,4).toString()).toBe('RIFF');
  expect(data.subarray(8,12).toString()).toBe('WEBP');
  expect(data.includes(Buffer.from('VP8L'))).toBe(true);
  expect(statSync(path).size).toBeLessThanOrEqual(150000);
  expect(statSync(path).size).toBeLessThanOrEqual(400000);
 });
});
