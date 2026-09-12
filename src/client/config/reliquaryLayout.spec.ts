import {it,expect} from 'vitest';
import {reliquaryLayout} from './reliquaryLayout';
it('provides 44px cells at 390 and bounded frame at narrow widths',()=>{
 for(const [w,h] of [[390,844],[320,568],[1280,720],[844,390]]) {
 const f=reliquaryLayout(w,h); expect(f.originX-14*f.scale).toBeGreaterThanOrEqual(0);
 expect(f.originY+f.fieldSize+33*f.scale).toBeLessThanOrEqual(h);
 if(w===390) expect(f.cell).toBe(44);
 if(w===320) expect(f.cell).toBeLessThan(44);
 }
});
it('keeps the complete frame inside a 768x1024 viewport',()=>{
 const w=768,h=1024;
 const f=reliquaryLayout(w,h);
 expect(f.originX-14*f.scale).toBeGreaterThanOrEqual(0);
 expect(f.originX+f.fieldSize+14*f.scale).toBeLessThanOrEqual(w);
 expect(f.originY-33*f.scale).toBeGreaterThanOrEqual(0);
 expect(f.originY+f.fieldSize+33*f.scale).toBeLessThanOrEqual(h);
});
