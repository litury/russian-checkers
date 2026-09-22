import {expect,it} from 'vitest';
import {MenuTouchMotion} from './menuTouchMotion';
it('holds rigid contact indefinitely and returns continuously from release',()=>{
 const m=new MenuTouchMotion();m.press();m.advance(9000,false);expect(m.offset).toBe(34);
 m.release();expect(m.offset).toBe(34);m.advance(90,false);expect(m.offset).toBe(17);
 m.advance(90,false);expect(m.offset).toBe(0);expect(m.moving).toBe(false);
});
it('rapid recontact and reduced motion do not leave a stale depression',()=>{
 const m=new MenuTouchMotion();m.press();m.release();m.advance(50,false);m.press();expect(m.offset).toBe(34);
 m.release(true);expect(m.offset).toBe(0);m.press();m.advance(500,true);expect(m.offset).toBe(34);m.release();m.advance(1,true);expect(m.offset).toBe(0);
});
