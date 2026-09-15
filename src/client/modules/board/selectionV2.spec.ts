import {expect,it} from 'vitest';
import {selectionV2Frame} from './selectionV2';
it('maps geometric progress to all56 displacements with Python ties-to-even',()=>{
 expect(selectionV2Frame(0)).toBe(0);expect(selectionV2Frame(1)).toBe(55);
 expect(selectionV2Frame(.5)).toBe(28);
 expect(selectionV2Frame(2.5/55)).toBe(2);expect(selectionV2Frame(.1)).toBe(6);
 // IEEE multiplication gives 3.4999999999999996, as in Python: not a tie.
 expect(selectionV2Frame(3.5/55)).toBe(3);
 expect(selectionV2Frame(-1)).toBe(0);expect(selectionV2Frame(2)).toBe(55);
});
