import { expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import manifest from './ui/verdict/manifest.json';
const css=readFileSync(new URL('./boardVerdict.css',import.meta.url),'utf8');
it('uses generated frames and four state plates without CSS metal painting',()=>{
 expect(css).not.toContain('linear-gradient');
 expect(css).not.toContain('box-shadow: 0');
 expect(manifest).toHaveLength(11);
 for(const asset of manifest){
  expect(existsSync(new URL(`./ui/verdict/${asset.name}.webp`,import.meta.url))).toBe(true);
  expect(css).toContain(`${asset.name}.webp`);
  expect(asset.slice).toBe(asset.name.startsWith('secondary')?32:48);
 }
 expect(css).toContain('min-height: 44px');
 expect(css).toContain(':focus-visible');
 expect(css).toContain('prefers-reduced-motion');
});
