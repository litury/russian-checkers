import {expect,it} from 'vitest';
import {menuClickLevel,menuBackSound} from './menuClickLevel';
it('plays the accepted click at unity so the listened file is not boosted',()=>{
 expect(menuClickLevel).toBe(1);
 expect(0.901*menuClickLevel).toBeLessThan(1);
});
it('uses the accepted click as back, one file per event',()=>{
 expect(menuBackSound).toBe('ui_click');
});
