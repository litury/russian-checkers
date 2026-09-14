import {expect,it} from 'vitest';
import {menuClickLevel,menuBackSound} from './menuClickLevel';
it('matches the existing back reference RMS with headroom, not master gain',()=>{
 expect(.016581077066241526*menuClickLevel).toBeCloseTo(.03470765258445707,5);
 expect(.0612475611269474*menuClickLevel).toBeLessThan(.15);
});
it('uses click as provisional back without changing original asset',()=>{
 expect(menuBackSound).toBe('ui_click');
});
