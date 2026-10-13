import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const manifest=JSON.parse(readFileSync('artifacts/remaining-sfx/integration-manifest.json','utf8'));
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
describe('remaining SFX delivery',()=>{
 it('routes every authorized replacement to exactly one WAV, preserving legacy masters',()=>{
  const rows=manifest.active_nonvoice.filter((row:any)=>row.status==='integrated-owner-authorized');
  expect(rows).toHaveLength(14);
  for(const row of rows){
   expect(hash(row.runtime_file)).toBe(row.new_sha256);
   if(row.old!==row.runtime_file)expect(existsSync(row.old)).toBe(false);
   expect(hash(`artifacts/remaining-sfx/legacy-masters/${row.old.split('/').pop()}`)).toBe(row.old_sha256);
  }
 });
 it('preserves all accepted cues, speech including ah, and music byte for byte',()=>{
  expect(manifest.preserved_voice_music).toHaveLength(42);
  for(const row of manifest.preserved_voice_music)expect(hash(row.file)).toBe(row.sha256);
  const preserved=manifest.active_nonvoice.filter((row:any)=>row.status==='already-covered-preserve');
  expect(preserved).toHaveLength(11);
  for(const row of preserved)expect(hash(row.old)).toBe(row.old_sha256);
 });
});
