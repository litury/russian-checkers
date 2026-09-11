import { expect, it } from 'vitest';
import { defeatButtonState } from './defeatButtonState';
it.each([0,1])('switches button %i without moving its registered texture', index => {
 const name = index === 0 ? 'primary' : 'secondary';
 expect(defeatButtonState(index,false)).toEqual({key:`defeat_${name}_rest`,textY:0});
 expect(defeatButtonState(index,true)).toEqual({key:`defeat_${name}_pressed`,textY:index===0?3:2});
 expect(defeatButtonState(index,false).textY).toBe(0);
});
