import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
const root=new URL('./ui/siege/',import.meta.url);
const provenance=JSON.parse(readFileSync(new URL('menu-search-generated-provenance.json',root),'utf8'));
const css=readFileSync(new URL('./openingGates.css',import.meta.url),'utf8');
describe('generated menu/search plate contract',()=>{
 it('registers distinct real files for all five states and each aspect',()=>{
  expect(provenance.tool).toBe('Codex built-in image_gen via cx');
  expect(provenance.files).toHaveLength(50);
  const hashes=new Set();
  for(const file of provenance.files){
   const bytes=readFileSync(new URL(file.file,root));
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
   expect(bytes.byteLength).toBe(file.bytes);
   hashes.add(file.sha256);
   expect(css).toContain(file.file);
   expect(file.bytes).toBeLessThan(85000);
  }
  expect(hashes.size).toBe(50);
  expect(provenance.files.reduce((sum:number,file:{bytes:number})=>sum+file.bytes,0)).toBeLessThan(1100000);
 });
 it('uses independent artwork, native focus outline and stable aspect selectors',()=>{
  for(const state of ['hover','focus','pressed','disabled'])expect(css).toContain(`--plate-state:var(--plate-${state})`);
  expect(css).toContain('background-image:var(--plate-state,var(--plate-rest))');
  expect(css).toContain('#opening-search-actions button:focus-visible { outline:3px solid #bed9ec');
  expect(css).toContain('padding:0 18px;');
  expect(css).toContain('@media (min-width:970px) and (min-height:501px)');
 });
});
